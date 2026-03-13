// ── Global Auto-Save State Machine ───────────────────────────────────────────
// Used by fetch interceptor and React hooks without requiring a Context provider

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

export type PendingRequest = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
};

const QUEUE_KEY = "lumina_offline_queue";
const LAST_SAVED_KEY = "lumina_last_saved";

let _status: SaveStatus = navigator.onLine ? "idle" : "offline";
let _lastSaved: Date | null = (() => {
  const v = localStorage.getItem(LAST_SAVED_KEY);
  return v ? new Date(v) : null;
})();
let _queue: PendingRequest[] = (() => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
})();

const _listeners = new Set<() => void>();

function _notify() { _listeners.forEach(fn => fn()); }

function _persistQueue() {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(_queue));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getState() {
  return {
    status: _status,
    lastSaved: _lastSaved,
    queueLength: _queue.length,
  };
}

export function setStatus(s: SaveStatus) {
  _status = s;
  if (s === "saved") {
    _lastSaved = new Date();
    localStorage.setItem(LAST_SAVED_KEY, _lastSaved.toISOString());
  }
  _notify();
}

export function addToQueue(url: string, init: RequestInit) {
  const item: PendingRequest = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    url,
    method: (init.method || "POST").toUpperCase(),
    headers: init.headers
      ? Object.fromEntries(Object.entries(init.headers as Record<string, string>))
      : { "Content-Type": "application/json" },
    body: typeof init.body === "string" ? init.body : null,
    timestamp: Date.now(),
  };
  _queue.push(item);
  _persistQueue();
  _notify();
}

export function clearQueue() {
  _queue = [];
  _persistQueue();
  _notify();
}

export function getQueue(): PendingRequest[] {
  return [..._queue];
}

export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  const snapshot = [..._queue];
  let replayed = 0;
  let failed = 0;

  for (const item of snapshot) {
    try {
      const r = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined,
      });
      if (r.ok) {
        _queue = _queue.filter(q => q.id !== item.id);
        _persistQueue();
        replayed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { replayed, failed };
}

// ── Install fetch interceptor (call once at app boot) ─────────────────────────
let _interceptorInstalled = false;
const _origFetch = window.fetch.bind(window);

export function installFetchInterceptor() {
  if (_interceptorInstalled) return;
  _interceptorInstalled = true;

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = ((init.method || (typeof input !== "string" ? (input as Request).method : "GET")) || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const isAPI = url.includes("/api/") && !url.includes("/api/backup/");

    if (isAPI && isMutation) {
      if (!navigator.onLine) {
        addToQueue(url, init);
        setStatus("offline");
        // Return a synthetic offline response so callers don't crash
        return new Response(
          JSON.stringify({ _offline: true, error: "Offline — change queued for sync" }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      }

      setStatus("saving");
      try {
        const result = await _origFetch(input, init);
        if (result.ok) setStatus("saved");
        else setStatus("error");
        return result;
      } catch (e) {
        setStatus("error");
        throw e;
      }
    }

    return _origFetch(input, init);
  };

  // ── Online / offline events ─────────────────────────────────────────────────
  window.addEventListener("online", async () => {
    setStatus("saving");
    const queue = getQueue();
    if (queue.length > 0) {
      const { replayed } = await replayQueue();
      if (replayed > 0) {
        window.dispatchEvent(new CustomEvent("lumina:synced", { detail: { replayed } }));
        // Reload page so UI reflects replayed data
        setTimeout(() => window.location.reload(), 800);
      }
    }
    setStatus("saved");
  });

  window.addEventListener("offline", () => {
    setStatus("offline");
  });

  // ── beforeunload — warn if offline queue is non-empty ──────────────────────
  window.addEventListener("beforeunload", (e) => {
    if (getQueue().length > 0) {
      e.preventDefault();
      e.returnValue = "You have unsynced changes. Leave anyway?";
    }
  });
}
