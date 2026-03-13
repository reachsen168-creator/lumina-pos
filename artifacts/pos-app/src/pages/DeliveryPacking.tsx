import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Share2, Package, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeliveryPackingPreview, type PackageGroup } from "@/components/DeliveryPackingPreview";
import type { FullInvoice } from "@/components/InvoicePreview";
import html2canvas from "html2canvas";

const PACKAGE_TYPES = ["កេះ", "បាវ", "កញ្ចប់", "ថង់", "ប្រអប់", "ផ្សេងៗ"];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function DeliveryPacking() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invoice, setInvoice]     = useState<FullInvoice | null>(null);
  const [loading, setLoading]     = useState(true);

  const [groups, setGroups]               = useState<PackageGroup[]>([]);
  const [selected, setSelected]           = useState<Set<number>>(new Set());
  const [newPkgType, setNewPkgType]       = useState(PACKAGE_TYPES[0]);
  const [customType, setCustomType]       = useState("");
  const [newPkgQty, setNewPkgQty]         = useState(1);
  const [sharing, setSharing]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [showDelivery, setShowDelivery]   = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);
  // Track whether groups have been dirty since last save
  const savedGroupsRef = useRef<string>("[]");

  // ── Load invoice + saved packing on mount ──────────────────────────────
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

  // ── Save helper ────────────────────────────────────────────────────────
  const saveGroups = useCallback(async (groupsToSave: PackageGroup[]) => {
    if (!id) return;
    const json = JSON.stringify(groupsToSave);
    if (json === savedGroupsRef.current) return; // no change
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

  // ── Helpers ─────────────────────────────────────────────────────────────
  const assignedIndices = new Set(groups.flatMap(g => g.itemIndices));

  const toggleItem = (idx: number) => {
    if (assignedIndices.has(idx)) return;
    setSelected(prev => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  };

  const createGroup = () => {
    if (selected.size === 0) return;
    const type = newPkgType === "ផ្សេងៗ" ? (customType.trim() || "ផ្សេងៗ") : newPkgType;
    const newGroup: PackageGroup = {
      id: uid(),
      itemIndices: [...selected].sort((a, b) => a - b),
      packageType: type,
      packageQty:  newPkgQty,
    };
    setGroups(prev => [...prev, newGroup]);
    setSelected(new Set());
    setNewPkgQty(1);
  };

  const deleteGroup = (gid: string) => {
    setGroups(prev => prev.filter(g => g.id !== gid));
  };

  // ── Share image ──────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!previewRef.current) return;
    setSharing(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob")), "image/png")
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
</head><body><img src="${dataUrl}" alt="${filename}"><p>Long press the image and choose &ldquo;Save to Photos&rdquo; to save it.</p></body></html>`);
          win.document.close();
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast({ title: "Failed to share", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
            const groupInfo = inGroup ? groups.find(g => g.itemIndices.includes(i)) : null;

            return (
              <div
                key={i}
                onClick={() => toggleItem(i)}
                className={`flex items-center gap-3 px-4 py-3 text-sm cursor-pointer transition-colors
                  ${inGroup ? "bg-muted/50 cursor-not-allowed" : "hover:bg-muted/30"}
                  ${isChecked ? "bg-accent/5 border-l-4 border-accent" : ""}`}
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
                {groupInfo && (
                  <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    {groupInfo.packageQty} {groupInfo.packageType}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Group creation controls */}
        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Package Type</label>
            <select
              value={newPkgType}
              onChange={e => setNewPkgType(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PACKAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {newPkgType === "ផ្សេងៗ" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Custom Type</label>
              <Input
                value={customType}
                onChange={e => setCustomType(e.target.value)}
                placeholder="e.g. ខ្ចប់"
                className="h-9 w-32"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Qty</label>
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

      {/* ── Step 2: Groups list ── */}
      {groups.length > 0 && (
        <Card className="border-none ring-1 ring-border shadow-md p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Package Groups ({groups.length})</h2>
            <Button
              variant="outline"
              size="sm"
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
              <div key={g.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  Group {gi + 1}
                </span>
                <span className="flex-1 text-sm text-foreground">
                  {g.itemIndices.map(idx => invoice.items[idx]?.productName).join(", ")}
                </span>
                <span className="font-bold text-sm">{g.packageQty} {g.packageType}</span>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                  onClick={() => deleteGroup(g.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
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
            groups={groups}
            showDelivery={showDelivery}
          />
        </div>
      </Card>
    </div>
  );
}
