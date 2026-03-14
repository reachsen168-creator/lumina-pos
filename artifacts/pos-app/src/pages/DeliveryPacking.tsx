import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Share2, Package, Save, Pencil, Check, X, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeliveryPackingPreview, type PackageGroup } from "@/components/DeliveryPackingPreview";
import type { FullInvoice } from "@/components/InvoicePreview";
import html2canvas from "html2canvas";

/** Common quick-pick types shown as chips — user can still type anything */
const QUICK_TYPES = ["កេះ", "បាវ", "ដប", "កញ្ចប់", "ថង់", "ប្រអប់"];

function uid() { return Math.random().toString(36).slice(2, 9); }

/* ── Inline group-edit row state ── */
interface EditState { type: string; qty: number }

export default function DeliveryPacking() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invoice, setInvoice]   = useState<FullInvoice | null>(null);
  const [loading, setLoading]   = useState(true);

  const [groups, setGroups]             = useState<PackageGroup[]>([]);
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [newPkgType, setNewPkgType]     = useState("កេះ");
  const [newPkgQty, setNewPkgQty]       = useState(1);
  const [sharing, setSharing]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [showDelivery, setShowDelivery] = useState(true);

  /** Which group is being inline-edited and its draft values */
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState<EditState>({ type: "", qty: 1 });

  const previewRef       = useRef<HTMLDivElement>(null);
  const savedGroupsRef   = useRef<string>("[]");

  /* ── Load invoice + saved packing on mount ── */
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/invoices/${id}`).then(r => r.ok ? r.json() : Promise.reject("Invoice not found")),
      fetch(`/api/invoices/${id}/packing`).then(r => r.ok ? r.json() : { groups: [] }),
    ])
      .then(([inv, packing]: [FullInvoice, { groups: PackageGroup[] }]) => {
        setInvoice(inv);
        const saved = Array.isArray(packing.groups) ? packing.groups : [];
        setGroups(saved);
        savedGroupsRef.current = JSON.stringify(saved);
        setLoading(false);
      })
      .catch(err => {
        toast({ title: String(err), variant: "destructive" });
        setLocation("/sales");
      });
  }, [id]);

  /* ── Save helper ── */
  const saveGroups = useCallback(async (groupsToSave: PackageGroup[]) => {
    if (!id) return;
    const json = JSON.stringify(groupsToSave);
    if (json === savedGroupsRef.current) { toast({ title: "Already saved" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/invoices/${id}/packing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groupsToSave }),
      });
      if (!r.ok) throw new Error("Save failed");
      savedGroupsRef.current = json;
      toast({ title: "Packing layout saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [id, toast]);

  if (loading || !invoice) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  }

  /* ── Live groups: merge in-progress edit into preview ── */
  const liveGroups: PackageGroup[] = editingId
    ? groups.map(g =>
        g.id === editingId
          ? { ...g, packageType: editDraft.type.trim() || g.packageType, packageQty: Math.max(1, editDraft.qty) }
          : g
      )
    : groups;

  /* ── Helpers ── */
  const assignedIndices = new Set(groups.flatMap(g => g.itemIndices));

  const toggleItem = (idx: number) => {
    if (assignedIndices.has(idx)) return;
    setSelected(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  };

  const createGroup = () => {
    if (selected.size === 0) return;
    const type = newPkgType.trim() || "កញ្ចប់";
    setGroups(prev => [...prev, {
      id: uid(),
      itemIndices: [...selected].sort((a, b) => a - b),
      packageType: type,
      packageQty:  newPkgQty,
    }]);
    setSelected(new Set());
    setNewPkgQty(1);
  };

  const deleteGroup = (gid: string) => {
    if (editingId === gid) setEditingId(null);
    setGroups(prev => prev.filter(g => g.id !== gid));
  };

  const startEdit = (g: PackageGroup) => {
    setEditingId(g.id);
    setEditDraft({ type: g.packageType, qty: g.packageQty });
  };

  const commitEdit = () => {
    if (!editingId) return;
    const type = editDraft.type.trim() || "កញ្ចប់";
    setGroups(prev => prev.map(g =>
      g.id === editingId ? { ...g, packageType: type, packageQty: Math.max(1, editDraft.qty) } : g
    ));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  /* ── Share image ── */
  const handleShare = async () => {
    if (!previewRef.current) return;
    setSharing(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(previewRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob")), "image/png")
      );
      const filename = `${invoice.invoiceNo}-packing.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        const dataUrl = canvas.toDataURL("image/png");
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${filename}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:16px;gap:12px}img{max-width:100%;height:auto;display:block;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.6)}p{color:#888;font:13px/1.5 sans-serif;text-align:center;padding-bottom:24px}</style>
</head><body><img src="${dataUrl}" alt="${filename}"><p>Long press the image to save.</p></body></html>`);
          win.document.close();
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast({ title: "Failed to share", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  /* ── Send to Telegram ── */
  const handleSendTelegram = async () => {
    const token  = localStorage.getItem("lumina_tg_token")?.trim();
    const chatId = localStorage.getItem("lumina_tg_chat")?.trim();
    if (!token || !chatId) {
      toast({
        title: "Telegram not configured",
        description: "Go to Settings and enter your bot token and chat ID.",
        variant: "destructive",
      });
      return;
    }

    const dateStr = invoice.createdAt ?? invoice.date;
    const d = dateStr ? new Date(dateStr) : null;
    const dateFmt = d && !isNaN(d.getTime())
      ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      : "N/A";

    const lines: string[] = [
      "📦 វេចខ្ចប់ / Packing",
      "",
      `Customer : ${invoice.customerName}`,
      "",
      `Date     : ${dateFmt}`,
      "",
      "─────────────────────",
      "",
    ];

    invoice.items.forEach((item, i) => {
      const grp = liveGroups.find(g => g.itemIndices.includes(i));
      const isLastInGroup = grp
        ? grp.itemIndices[grp.itemIndices.length - 1] === i
        : false;
      const tag = grp && isLastInGroup ? `  [ ${grp.packageQty} ${grp.packageType} ]` : "";
      lines.push(`${i + 1}. ${item.productName} = ${item.qty}${tag}`);
    });

    // Total Package: sum qty per type, joined with " + "
    const typeTotals = new Map<string, number>();
    liveGroups.forEach(g => {
      typeTotals.set(g.packageType, (typeTotals.get(g.packageType) ?? 0) + g.packageQty);
    });
    const totalSummary = typeTotals.size > 0
      ? [...typeTotals.entries()].map(([type, qty]) => `${qty} ${type}`).join(" + ")
      : "—";

    lines.push("", "─────────────────────", "");
    lines.push(`Total Package : ${totalSummary}`);

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), parse_mode: "" }),
        }
      );
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Packing sent to Telegram!" });
      } else {
        toast({ title: `Telegram: ${json.description}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send to Telegram", variant: "destructive" });
    }
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Delivery Packing — ${invoice.invoiceNo}`}
        description={invoice.customerName}
        action={
          <Link href="/sales">
            <Button variant="outline" className="h-10 gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Sales
            </Button>
          </Link>
        }
      />

      {/* ── Step 1: Build Groups ── */}
      <Card className="border-none ring-1 ring-border shadow-md p-5 space-y-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-accent" /> Build Package Groups
        </h2>

        {/* Items checklist */}
        <div className="divide-y divide-border rounded-xl overflow-hidden border border-border">
          {invoice.items.map((item, i) => {
            const inGroup   = assignedIndices.has(i);
            const isChecked = selected.has(i);
            const grpInfo   = inGroup ? groups.find(g => g.itemIndices.includes(i)) : null;

            return (
              <div
                key={i}
                onClick={() => toggleItem(i)}
                className={`flex items-center gap-3 px-4 py-3 text-sm cursor-pointer transition-colors
                  ${inGroup ? "bg-muted/40 cursor-not-allowed" : "hover:bg-muted/30"}
                  ${isChecked ? "bg-accent/5 border-l-4 border-l-accent" : ""}`}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={inGroup}
                  onCheckedChange={() => toggleItem(i)}
                  onClick={e => e.stopPropagation()}
                />
                <span className="w-6 text-muted-foreground text-xs">{i + 1}</span>
                <span className={`flex-1 font-medium ${inGroup ? "text-muted-foreground" : ""}`}>
                  {item.productName}
                </span>
                <span className="font-bold tabular-nums">{item.qty}</span>
                {grpInfo && (
                  <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {grpInfo.packageQty} {grpInfo.packageType}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Package type: free-text input + quick-pick chips */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-medium text-muted-foreground">Package Type</label>
          <Input
            value={newPkgType}
            onChange={e => setNewPkgType(e.target.value)}
            placeholder="Type any package name…"
            className="h-9 max-w-xs"
          />
          {/* Quick-pick chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setNewPkgType(t)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors font-medium
                  ${newPkgType === t
                    ? "bg-accent text-white border-accent"
                    : "bg-background text-muted-foreground border-border hover:border-accent hover:text-accent"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Qty + Add button */}
        <div className="flex items-end gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Qty</label>
            <Input
              type="number"
              min={1}
              value={newPkgQty}
              onChange={e => setNewPkgQty(Math.max(1, Number(e.target.value)))}
              className="h-9 w-20"
            />
          </div>
          <Button
            onClick={createGroup}
            disabled={selected.size === 0}
            className="h-9 gap-2 bg-accent hover:bg-accent/90 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Group ({selected.size} item{selected.size !== 1 ? "s" : ""})
          </Button>
        </div>
      </Card>

      {/* ── Step 2: Groups list with inline editing ── */}
      {groups.length > 0 && (
        <Card className="border-none ring-1 ring-border shadow-md p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Package Groups ({groups.length})</h2>
            <Button
              variant="outline" size="sm"
              disabled={saving}
              className="h-8 gap-2 text-xs"
              onClick={() => saveGroups(groups)}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Layout"}
            </Button>
          </div>

          <div className="space-y-2">
            {groups.map((g, gi) => (
              <div key={g.id} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                {/* Group header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                    Group {gi + 1}
                  </span>
                  <span className="flex-1 text-sm text-foreground truncate">
                    {g.itemIndices.map(idx => invoice.items[idx]?.productName).join(", ")}
                  </span>

                  {editingId === g.id ? (
                    /* ── Inline edit mode ── */
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        value={editDraft.type}
                        onChange={e => setEditDraft(d => ({ ...d, type: e.target.value }))}
                        className="h-7 w-24 text-xs px-2"
                        placeholder="type…"
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={editDraft.qty}
                        onChange={e => setEditDraft(d => ({ ...d, qty: Math.max(1, Number(e.target.value)) }))}
                        className="h-7 w-14 text-xs px-2"
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                      />
                      <button onClick={commitEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    /* ── Display mode ── */
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm">{g.packageQty} {g.packageType}</span>
                      <button
                        onClick={() => startEdit(g)}
                        className="p-1 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteGroup(g.id)}
                        className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick-type chips when editing */}
                {editingId === g.id && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                    {QUICK_TYPES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditDraft(d => ({ ...d, type: t }))}
                        className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors
                          ${editDraft.type === t
                            ? "bg-accent text-white border-accent"
                            : "bg-background text-muted-foreground border-border hover:border-accent"
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Step 3: Preview + Export ── */}
      <Card className="border-none ring-1 ring-border shadow-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Preview</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={showDelivery}
                onCheckedChange={v => setShowDelivery(v === true)}
              />
              Show Delivery Name
            </label>
            <Button
              onClick={handleSendTelegram}
              variant="outline"
              className="h-9 gap-2 border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9]/10"
            >
              <Send className="w-4 h-4" />
              Telegram
            </Button>
            <Button
              onClick={handleShare}
              disabled={sharing}
              className="h-9 gap-2 bg-accent hover:bg-accent/90 text-white"
            >
              <Share2 className="w-4 h-4" />
              {sharing ? "Generating…" : "Share Image"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <DeliveryPackingPreview
            ref={previewRef}
            invoice={invoice}
            groups={liveGroups}
            showDelivery={showDelivery}
          />
        </div>
      </Card>
    </div>
  );
}
