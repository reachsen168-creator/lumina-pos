import { useState, useEffect } from "react";
import { format } from "date-fns";
import { subscribe, getState, type SaveStatus } from "@/lib/autoSave";
import { CheckCircle2, Loader2, WifiOff, AlertCircle, Clock } from "lucide-react";

export function AutoSaveIndicator() {
  const [state, setState] = useState(getState());

  useEffect(() => {
    const unsub = subscribe(() => setState({ ...getState() }));
    return unsub;
  }, []);

  const { status, lastSaved, queueLength } = state;

  if (status === "idle" && !lastSaved) return null;

  const configs: Record<SaveStatus, { label: string; icon: React.ReactNode; className: string }> = {
    idle: {
      label: lastSaved ? `Saved ${format(lastSaved, "HH:mm")}` : "",
      icon: <CheckCircle2 className="w-3 h-3" />,
      className: "text-muted-foreground",
    },
    saving: {
      label: "Saving...",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      className: "text-blue-500",
    },
    saved: {
      label: lastSaved ? `Saved ${format(lastSaved, "HH:mm")}` : "Saved",
      icon: <CheckCircle2 className="w-3 h-3" />,
      className: "text-green-600 dark:text-green-400",
    },
    offline: {
      label: queueLength > 0 ? `Offline · ${queueLength} pending` : "Offline",
      icon: <WifiOff className="w-3 h-3" />,
      className: "text-orange-500",
    },
    error: {
      label: "Save error",
      icon: <AlertCircle className="w-3 h-3" />,
      className: "text-red-500",
    },
  };

  const cfg = configs[status];
  if (!cfg.label) return null;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium select-none ${cfg.className}`}>
      {cfg.icon}
      <span className="hidden sm:inline">{cfg.label}</span>
    </span>
  );
}
