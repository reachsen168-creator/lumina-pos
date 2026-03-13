import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoices, useDeleteInvoice, getGetInvoicesQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, FileText, Trash2, Edit, Truck,
  ChevronDown, ChevronUp, Clipboard, FileDown, Share2, Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { InvoicePreview, type FullInvoice } from "@/components/InvoicePreview";
import html2canvas from "html2canvas";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function safeFormatDate(val: string | null | undefined, fmt: string): string {
  if (!val) return "N/A";
  const d = new Date(val);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
}

const NUM_ROWS = 18;

function fmt$(n: number) {
  return `${Number(n).toFixed(2)}$`;
}

function buildText(inv: FullInvoice, showDelivery: boolean): string {
  const line = "─".repeat(60);
  const thin  = "─".repeat(60);
  const dateStr = safeFormatDate(inv.createdAt ?? inv.date, "dd MMMM yyyy HH:mm");

  const header = [
    "វិក័យបត្រ",
    `Invoice No. : ${inv.invoiceNo}`,
    `Customer    : ${inv.customerName}`,
    `Date & Time : ${dateStr}`,
  ];
  if (showDelivery) header.push(`Delivery    : ${inv.deliveryNo ?? "—"}`);
  if (inv.note)     header.push(`Note        : ${inv.note}`);

  const colNo    = "No ".padEnd(4);
  const colName  = "Name of Good".padEnd(26);
  const colQty   = "Qty".padStart(6);
  const colPrice = "Unit Price".padStart(12);
  const colAmt   = "Amount".padStart(12);
  const tableHeader = `  ${colNo}${colName}${colQty}${colPrice}${colAmt}`;

  const rows = Array.from({ length: NUM_ROWS }, (_, i) => {
    const item = inv.items[i];
    if (!item) return `  ${" ".repeat(4)}${" ".repeat(26)}${" ".repeat(6)}${" ".repeat(12)}${" ".repeat(12)}`;
    const no    = String(i + 1).padEnd(4);
    const name  = item.productName.padEnd(26).slice(0, 26);
    const qty   = String(item.qty).padStart(6);
    const price = `$${Number(item.price).toFixed(2)}`.padStart(12);
    const amt   = `$${Number(item.subtotal).toFixed(2)}`.padStart(12);
    return `  ${no}${name}${qty}${price}${amt}`;
  });

  const total = `$${Number(inv.total).toFixed(2)}`.padStart(12);

  return [
    ...header,
    line,
    tableHeader,
    "  " + thin,
    ...rows,
    line,
    `${"TOTAL".padStart(48 + 12)}${total}`,
    line,
  ].join("\n");
}

/**
 * Renders <InvoicePreview> into a temporary off-screen DOM node,
 * captures it with html2canvas at 3× resolution, then cleans up.
 * Returns the canvas. The node is appended/removed synchronously so
 * the html2canvas call stays within the original user-gesture chain.
 */
async function captureInvoiceCanvas(
  inv: FullInvoice,
  showDelivery: boolean
): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;pointer-events:none;z-index:-1;";
  document.body.appendChild(container);

  const root = createRoot(container);
  // flushSync forces React to render synchronously before we proceed
  flushSync(() => {
    root.render(<InvoicePreview invoice={inv} showDelivery={showDelivery} />);
  });

  // Wait for all fonts (including Noto Sans Khmer) to finish loading
  await document.fonts.ready;

  try {
    const el = container.firstElementChild as HTMLElement;
    return await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

/* ── component ───────────────────────────────────────────────────────────── */

type CachedItem = FullInvoice["items"][number];

export default function Sales() {
  const [search, setSearch]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [showDelivery, setShowDelivery] = useState(true);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [itemsCache, setItemsCache]     = useState<Record<number, CachedItem[]>>({});

  const { data: invoices = [], isLoading } = useGetInvoices({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMut = useDeleteInvoice();

  /* fetch full invoice (with items) */
  const fetchFull = async (id: number): Promise<FullInvoice> => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) throw new Error("Failed to fetch invoice");
    return res.json();
  };

  /* toggle inline items dropdown */
  const handleToggleItems = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (itemsCache[id]) return;
    try {
      const inv = await fetchFull(id);
      setItemsCache(prev => ({ ...prev, [id]: inv.items }));
    } catch {
      toast({ title: "Failed to load items", variant: "destructive" });
      setExpandedId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetInvoicesQueryKey() });
      setItemsCache(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Invoice deleted" });
    } catch {
      toast({ title: "Error deleting invoice", variant: "destructive" });
    }
  };

  const handleCopy = async (id: number) => {
    try {
      const inv = await fetchFull(id);
      await navigator.clipboard.writeText(buildText(inv, showDelivery));
      toast({ title: "Invoice copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleExportText = async (id: number, invoiceNo: string) => {
    try {
      const inv = await fetchFull(id);
      const blob = new Blob([buildText(inv, showDelivery)], { type: "text/plain" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${invoiceNo}.txt`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Exported ${invoiceNo}.txt` });
    } catch {
      toast({ title: "Failed to export", variant: "destructive" });
    }
  };

  const handleShareImage = async (id: number, invoiceNo: string) => {
    try {
      const inv    = await fetchFull(id);
      const canvas = await captureInvoiceCanvas(inv, showDelivery);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
      );

      const file = new File([blob], `${invoiceNo}.png`, { type: "image/png" });

      // Try native share sheet (iOS Safari, Android Chrome, modern desktop)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: invoiceNo });
        return;
      }

      // Fallback: open full-screen preview in a new tab
      const dataUrl = canvas.toDataURL("image/png");
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>${invoiceNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#111;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:16px;gap:12px}
    img{max-width:100%;height:auto;display:block;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.6)}
    p{color:#888;font:13px/1.5 sans-serif;text-align:center;padding-bottom:24px}
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="${invoiceNo}">
  <p>Long press the image and choose &ldquo;Save to Photos&rdquo; to save it.</p>
</body>
</html>`);
        win.document.close();
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return; // user cancelled share
      toast({ title: "Failed to share invoice", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Invoices"
        description="Manage all sale transactions"
        action={
          <Link href="/sales/new">
            <Button className="bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20 h-12 px-6 w-full sm:w-auto">
              <Plus className="w-5 h-5 mr-2" /> New Sale
            </Button>
          </Link>
        }
      />

      <Card className="shadow-md border-none ring-1 ring-border p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by customer or invoice #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent focus-visible:ring-accent h-11 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-card" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-card" />
          </div>
        </div>

        <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />

        {/* Export options */}
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="show-delivery"
            checked={showDelivery}
            onCheckedChange={(v) => setShowDelivery(v === true)}
          />
          <label htmlFor="show-delivery" className="text-sm text-muted-foreground cursor-pointer select-none">
            Show Delivery Name in exports
          </label>
        </div>

        {/* Invoice grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center bg-muted/30 rounded-2xl border border-dashed border-border mt-4">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-foreground font-medium">No invoices found</p>
              <p className="text-sm text-muted-foreground mt-1">Adjust filters or create a new sale.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {invoices.map((inv) => {
                const isOpen   = expandedId === inv.id;
                const cached   = itemsCache[inv.id] ?? [];
                const subtotal = cached.reduce((s, it) => s + Number(it.subtotal), 0);

                return (
                  <div
                    key={inv.id}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col"
                  >
                    {/* Card header */}
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-md mb-2 inline-block">
                          {inv.invoiceNo}
                        </span>
                        <h3 className="font-bold text-lg text-foreground line-clamp-1">{inv.customerName}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {safeFormatDate((inv as any).createdAt ?? inv.date, "dd MMMM yyyy HH:mm")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-display font-bold text-foreground">${inv.total.toFixed(2)}</p>
                        {inv.deliveryNo && (
                          <p className="text-xs text-blue-600 font-medium mt-1 flex items-center justify-end gap-1">
                            <Truck className="w-3 h-3" /> {inv.deliveryNo}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Inline items dropdown */}
                    {isOpen && (
                      <div className="mb-3 rounded-xl bg-muted/40 border border-border overflow-hidden">
                        {cached.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
                        ) : (
                          <>
                            <div className="divide-y divide-border">
                              {cached.map((item, i) => (
                                <div key={item.id ?? i} className="px-4 py-2.5 text-sm">
                                  <span className="font-medium text-foreground">{item.productName}</span>
                                  <span className="text-muted-foreground">
                                    {" = "}{item.qty} x {fmt$(item.price)}{" = "}
                                  </span>
                                  <span className="font-semibold text-foreground">{fmt$(item.subtotal)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="px-4 py-2.5 border-t border-border bg-muted/60 flex justify-between items-center text-sm font-semibold">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span className="text-foreground">{fmt$(subtotal)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-auto pt-3 border-t border-border flex flex-wrap gap-1 items-center">
                      <Button
                        variant="ghost" size="sm"
                        className={`h-8 px-2 text-xs transition-colors ${isOpen ? "text-accent bg-accent/10 hover:bg-accent/20" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => handleToggleItems(inv.id)}
                      >
                        {isOpen
                          ? <><ChevronUp   className="w-3.5 h-3.5 mr-1" /> View Items</>
                          : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View Items</>
                        }
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                        onClick={() => handleCopy(inv.id)}
                      >
                        <Clipboard className="w-3.5 h-3.5 mr-1" /> Copy
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                        onClick={() => handleExportText(inv.id, inv.invoiceNo)}
                      >
                        <FileDown className="w-3.5 h-3.5 mr-1" /> Export Text
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                        onClick={() => handleShareImage(inv.id, inv.invoiceNo)}
                      >
                        <Share2 className="w-3.5 h-3.5 mr-1" /> Share Image
                      </Button>
                      <Link href={`/sales/${inv.id}/packing`}>
                        <Button
                          variant="ghost" size="sm"
                          className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                        >
                          <Package className="w-3.5 h-3.5 mr-1" /> Packing
                        </Button>
                      </Link>

                      <div className="ml-auto flex gap-1">
                        <Link href={`/sales/${inv.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded-lg"
                          onClick={() => handleDelete(inv.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
