import { useState, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Truck, User, Package, CalendarDays, ChevronRight,
  FileText, DollarSign, ChevronDown, ChevronsUpDown, Copy, Check, Image as ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryItem { productName: string; qty: number; price: number }
interface DeliveryInvoice { invoiceNo: string; customerName: string; total: number; items: DeliveryItem[] }
interface CustomerGroup { customerName: string; invoices: DeliveryInvoice[] }
interface PkgEntry { type: string; qty: number }
interface DeliveryTrip {
  delivery: { id: number; deliveryNo: string; date: string; driver: string | null; status: string };
  customers: CustomerGroup[];
  packageSummary: PkgEntry[];
  totalBills: number;
  grandTotal: number;
}
interface ReportResponse { date: string; deliveries: DeliveryTrip[] }

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchDeliveryReport(date: string): Promise<ReportResponse> {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const r = await fetch(`${BASE}/api/reports/deliveries?date=${date}`);
  if (!r.ok) throw new Error("Failed to fetch delivery report");
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function today() { return format(new Date(), "yyyy-MM-dd"); }

// ── Copy-text builder ─────────────────────────────────────────────────────────

function buildTripText(trip: DeliveryTrip): string {
  const { delivery, customers, packageSummary, totalBills, grandTotal } = trip;
  const lines: string[] = [];

  // Header
  lines.push("DELIVERY REPORT");

  // Date & Time
  let dateStr = delivery.date;
  try { dateStr = format(new Date(delivery.date), "d MMM yyyy"); } catch {}
  const timeStr = format(new Date(), "HH:mm");
  lines.push(`Date : ${dateStr}`);
  lines.push(`Time : ${timeStr}`);
  lines.push("");

  // Delivery info
  lines.push(`Delivery : ${delivery.deliveryNo}`);
  if (delivery.driver) lines.push(`Driver : ${delivery.driver}`);

  // Customers → items (reads from data, not DOM; works regardless of collapse state)
  for (const grp of customers) {
    lines.push("");
    lines.push(`Customer : ${grp.customerName}`);
    lines.push("");
    const allItems = grp.invoices.flatMap(inv => inv.items);
    for (const it of allItems) {
      const total = it.qty * it.price;
      const subtotalStr = Number.isInteger(total) ? `$${total}` : `$${total.toFixed(2)}`;
      const priceStr = Number.isInteger(it.price) ? `$${it.price}` : `$${it.price.toFixed(2)}`;
      lines.push(it.productName);
      lines.push(`${it.qty} × ${priceStr} = ${subtotalStr}`);
    }
  }

  // Package summary
  if (packageSummary.length > 0) {
    lines.push("");
    lines.push("Package :");
    for (const p of packageSummary) {
      lines.push(`${p.qty} ${p.type}`);
    }
  }

  // Totals
  lines.push("");
  lines.push(`Total Bills : ${totalBills}`);
  const grandStr = Number.isInteger(grandTotal) ? `$${grandTotal}` : `$${grandTotal.toFixed(2)}`;
  lines.push(`Total Amount : ${grandStr}`);

  return lines.join("\n");
}

// ── CustomerRow — collapsible (default closed) ────────────────────────────────

interface CustomerRowProps {
  group: CustomerGroup;
  open: boolean;
  onToggle: () => void;
}

function CustomerRow({ group, open, onToggle }: CustomerRowProps) {
  const allItems: (DeliveryItem & { invoiceNo: string })[] = [];
  for (const inv of group.invoices) {
    for (const it of inv.items) allItems.push({ ...it, invoiceNo: inv.invoiceNo });
  }
  const customerTotal = group.invoices.reduce((s, i) => s + i.total, 0);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-accent" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
          <User className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">{group.customerName}</span>
        </div>
        <span className="text-sm font-bold text-accent">{fmt(customerTotal)}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2.5 bg-background border-t border-border">
          {allItems.map((it, i) => {
            const total = it.qty * it.price;
            return (
              <div key={i} className="flex items-start justify-between text-sm gap-2">
                <span className="text-foreground font-medium leading-snug">{it.productName}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {it.qty} × {fmt(it.price)}
                  <span className="ml-1.5 text-foreground font-semibold">= {fmt(total)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Hidden print view ─────────────────────────────────────────────────────────

function PrintView({ trip, printRef }: { trip: DeliveryTrip; printRef: React.RefObject<HTMLDivElement | null> }) {
  const { delivery, customers, packageSummary, totalBills, grandTotal } = trip;
  let dateStr = delivery.date;
  try { dateStr = format(new Date(delivery.date), "dd/MM/yyyy"); } catch {}
  const FONT = "'Noto Sans Khmer', Arial, sans-serif";

  return (
    <div
      ref={printRef}
      style={{
        position: "absolute", left: -9999, top: 0, zIndex: -1,
        width: 560, backgroundColor: "#ffffff",
        fontFamily: FONT, fontSize: 14, color: "#1a1a1a",
        padding: "36px 40px 40px", boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
          DELIVERY REPORT
        </div>
        <div style={{ fontSize: 13, lineHeight: 2, color: "#444" }}>
          <div><strong>Date</strong> : {dateStr}</div>
          <div><strong>Delivery</strong> : {delivery.deliveryNo}</div>
          {delivery.driver && <div><strong>Driver</strong> : {delivery.driver}</div>}
        </div>
      </div>
      <div style={{ borderTop: "2px solid #1a1a1a", marginBottom: 18 }} />
      {customers.map((grp, gi) => {
        const allItems: DeliveryItem[] = grp.invoices.flatMap(inv => inv.items);
        return (
          <div key={gi} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
              {grp.customerName}
            </div>
            <div style={{ paddingLeft: 16 }}>
              {allItems.map((it, ii) => {
                const total = it.qty * it.price;
                const totalStr = Number.isInteger(total) ? `$${total}` : `$${total.toFixed(2)}`;
                const priceStr = Number.isInteger(it.price) ? `$${it.price}` : `$${it.price.toFixed(2)}`;
                return (
                  <div key={ii} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{it.productName}</span>
                    <span style={{ color: "#555" }}>{it.qty} × {priceStr} = {totalStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {packageSummary.length > 0 && (
        <>
          <div style={{ borderTop: "1px solid #ccc", margin: "16px 0" }} />
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Package :</div>
            <div style={{ color: "#444" }}>{packageSummary.map(p => `${p.qty} ${p.type}`).join(" + ")}</div>
          </div>
        </>
      )}
      <div style={{ borderTop: "2px solid #1a1a1a", marginTop: 20, paddingTop: 14, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span><strong>Total Bills</strong> : {totalBills}</span>
        <span><strong>Total Amount</strong> : {fmt(grandTotal)}</span>
      </div>
    </div>
  );
}

// ── DeliveryCard — outer level collapsible ────────────────────────────────────

function DeliveryCard({ trip }: { trip: DeliveryTrip }) {
  const { delivery, customers, packageSummary, totalBills, grandTotal } = trip;
  const { toast } = useToast();

  // Delivery trip: collapsed by default
  const [tripOpen, setTripOpen] = useState(false);

  // Customer rows: all collapsed by default
  const allNames = customers.map(c => c.customerName);
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set());

  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(printRef.current, {
        scale: 3, useCORS: true, backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${delivery.deliveryNo}-report.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally { setExporting(false); }
  }, [delivery.deliveryNo]);

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    const text = buildTripText(trip);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;left:0;top:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast({ title: "Delivery report copied successfully." });
    setTimeout(() => setCopied(false), 2000);
  }, [trip, toast]);

  const expandAll   = useCallback(() => setOpenSet(new Set(allNames)), [allNames.join(",")]);
  const collapseAll = useCallback(() => setOpenSet(new Set()), []);
  const toggleCustomer = useCallback((name: string) =>
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    }), []);

  const statusColor: Record<string, string> = {
    Completed: "bg-green-100 text-green-700 border-green-200",
    Delivered: "bg-green-100 text-green-700 border-green-200",
    Pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
    Cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  const badgeCls = statusColor[delivery.status] ?? "bg-secondary text-secondary-foreground";

  const allOpen   = allNames.every(n => openSet.has(n));
  const allClosed = allNames.every(n => !openSet.has(n));

  let dateStr = delivery.date;
  try { dateStr = format(new Date(delivery.date), "dd/MM/yyyy"); } catch {}

  const pkgLine = packageSummary.length > 0
    ? packageSummary.map(p => `${p.qty} ${p.type}`).join(" + ")
    : null;

  return (
    <>
      <Card className="overflow-hidden border-border">

        {/* ── Delivery trip header (always visible, click to toggle) ── */}
        <button
          onClick={() => setTripOpen(v => !v)}
          className="w-full text-left px-5 py-4 bg-primary/5 hover:bg-primary/10 transition-colors border-b border-border"
        >
          {/* Top row: chevron + deliveryNo + status + total */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {tripOpen
                ? <ChevronDown className="w-5 h-5 text-accent shrink-0" />
                : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              }
              <Truck className="w-5 h-5 text-accent shrink-0" />
              <span className="text-lg font-bold tracking-tight">{delivery.deliveryNo}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${badgeCls}`}>
                {delivery.status}
              </span>
            </div>
            <span className="text-xl font-bold text-accent shrink-0">{fmt(grandTotal)}</span>
          </div>

          {/* Bottom row: driver · bills · package */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 pl-[52px] text-sm text-muted-foreground">
            {delivery.driver && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {delivery.driver}
              </span>
            )}
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {totalBills} bill{totalBills !== 1 ? "s" : ""}
            </span>
            {pkgLine && (
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {pkgLine}
              </span>
            )}
          </div>
        </button>

        {/* ── Expanded body ── */}
        {tripOpen && (
          <div className="p-4 space-y-4">

            {/* Action buttons: stacked on mobile, side-by-side on sm+ */}
            <div className="flex flex-col sm:flex-row gap-[10px]">
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 gap-2 rounded-lg py-[10px] h-auto text-sm font-medium"
              >
                {exporting
                  ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Exporting…</>
                  : <><ImageIcon className="w-4 h-4" /> Export Image</>
                }
              </Button>
              <Button
                variant={copied ? "default" : "outline"}
                onClick={handleCopy}
                className={`flex-1 gap-2 rounded-lg py-[10px] h-auto text-sm font-medium transition-all ${copied ? "bg-green-600 hover:bg-green-600 border-green-600 text-white" : ""}`}
              >
                {copied
                  ? <><Check className="w-4 h-4" /> Copied!</>
                  : <><Copy className="w-4 h-4" /> Copy Text</>
                }
              </Button>
            </div>

            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No invoices assigned to this delivery.</p>
            ) : (
              <>
                {/* Expand / Collapse all customers */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline"
                    onClick={expandAll} disabled={allOpen}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" /> Expand All
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={collapseAll} disabled={allClosed}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 rotate-90" /> Collapse All
                  </Button>
                </div>

                {/* Customer list */}
                <div className="space-y-2">
                  {customers.map((grp) => (
                    <CustomerRow
                      key={grp.customerName}
                      group={grp}
                      open={openSet.has(grp.customerName)}
                      onToggle={() => toggleCustomer(grp.customerName)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Package Summary */}
            {packageSummary.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-accent" />
                    <span className="font-semibold text-sm">Package Summary</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
                    {packageSummary.map((p) => (
                      <span
                        key={p.type}
                        className="inline-flex items-center gap-1.5 bg-accent/10 text-accent border border-accent/20 rounded-full px-3 py-1 text-sm font-semibold"
                      >
                        <span className="text-base font-bold">{p.qty}</span>
                        <span>{p.type}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Footer totals */}
            <Separator />
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>Total Bills :</span>
                <span className="font-bold text-foreground">{totalBills}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <span>Total Amount :</span>
                <span className="font-bold text-accent text-base">{fmt(grandTotal)}</span>
              </div>
            </div>

          </div>
        )}
      </Card>

      {/* Hidden print view — outside Card to avoid overflow:hidden clipping */}
      <PrintView trip={trip} printRef={printRef} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeliveryReport() {
  const [date, setDate] = useState(today);

  const { data, isLoading, isError } = useQuery<ReportResponse>({
    queryKey: ["delivery-report", date],
    queryFn: () => fetchDeliveryReport(date),
    enabled: !!date,
  });

  const trips = data?.deliveries ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Report"
        description="Delivery trips, customer orders, and package summaries by date"
      />

      {/* Date filter */}
      <Card className="p-4">
        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="report-date" className="text-sm font-medium">Date</Label>
            <Input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground pb-1">
            <ChevronRight className="w-4 h-4" />
            {isLoading ? "Loading…" : `${trips.length} delivery trip${trips.length !== 1 ? "s" : ""} found`}
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading deliveries…
          </div>
        </div>
      )}

      {isError && (
        <Card className="p-6 text-center text-red-500 border-red-200 bg-red-50">
          Failed to load delivery report. Please try again.
        </Card>
      )}

      {!isLoading && !isError && trips.length === 0 && (
        <Card className="p-10 flex flex-col items-center gap-3 text-center border-dashed">
          <Truck className="w-10 h-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">No deliveries on this date</p>
            <p className="text-sm text-muted-foreground mt-1">
              Select a different date or create deliveries for {date}.
            </p>
          </div>
        </Card>
      )}

      {!isLoading && !isError && trips.length > 0 && (
        <div className="space-y-4">
          {trips.map((trip) => (
            <DeliveryCard key={trip.delivery.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
