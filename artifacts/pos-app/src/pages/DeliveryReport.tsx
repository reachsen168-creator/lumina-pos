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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Plain-text builder ────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  return Number.isInteger(n) ? `${n}$` : `${n.toFixed(2)}$`;
}

function buildTripText(trip: DeliveryTrip): string {
  const { delivery, customers, packageSummary } = trip;

  let dateStr = delivery.date;
  try { dateStr = format(new Date(delivery.date), "dd/MM/yyyy"); } catch {}

  const lines: string[] = [];

  lines.push("DELIVERY REPORT");
  lines.push("");
  lines.push(`Date : ${dateStr}`);
  lines.push(`Delivery : ${delivery.deliveryNo}`);
  if (delivery.driver) lines.push(`Driver : ${delivery.driver}`);

  for (const grp of customers) {
    lines.push("");
    lines.push(`Customer : ${grp.customerName}`);
    for (const inv of grp.invoices) {
      for (const it of inv.items) {
        lines.push(`${it.productName} = ${it.qty} x ${fmtAmt(it.price)}`);
      }
    }
  }

  if (packageSummary.length > 0) {
    lines.push("");
    lines.push("Total Package :");
    lines.push(packageSummary.map(p => `${p.qty} ${p.type}`).join(" + "));
  }

  return lines.join("\n");
}

// ── CustomerRow — collapsible ─────────────────────────────────────────────────

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
      {/* Clickable header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-accent transition-transform" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
          }
          <User className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">{group.customerName}</span>
          {group.invoices.length > 1 && (
            <Badge variant="secondary" className="text-xs">{group.invoices.length} invoices</Badge>
          )}
        </div>
        <span className="text-sm font-bold text-accent">{fmt(customerTotal)}</span>
      </button>

      {/* Collapsible item list */}
      {open && (
        <div className="px-4 py-3 space-y-2 bg-background border-t border-border">
          {allItems.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">{it.productName}</span>
              <span className="text-muted-foreground tabular-nums">
                {it.qty} × {fmt(it.price)}
                <span className="ml-2 text-foreground font-semibold">{fmt(it.qty * it.price)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hidden print view (inline styles → html2canvas safe) ─────────────────────

function PrintView({ trip, printRef }: { trip: DeliveryTrip; printRef: React.RefObject<HTMLDivElement | null> }) {
  const { delivery, customers, packageSummary, totalBills, grandTotal } = trip;

  let dateStr = delivery.date;
  try { dateStr = format(new Date(delivery.date), "dd/MM/yyyy"); } catch {}

  const FONT = "'Noto Sans Khmer', Arial, sans-serif";
  const W = 560;

  return (
    <div
      ref={printRef}
      style={{
        position: "absolute", left: -9999, top: 0, zIndex: -1,
        width: W, backgroundColor: "#ffffff",
        fontFamily: FONT, fontSize: 14, color: "#1a1a1a",
        padding: "36px 40px 40px", boxSizing: "border-box",
      }}
    >
      {/* Header */}
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

      {/* Customers */}
      {customers.map((grp, gi) => {
        const allItems: DeliveryItem[] = grp.invoices.flatMap(inv => inv.items);
        return (
          <div key={gi} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#1a1a1a" }}>
              Customer : {grp.customerName}
            </div>
            <div style={{ paddingLeft: 16 }}>
              {allItems.map((it, ii) => (
                <div key={ii} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{it.productName}</span>
                  <span style={{ color: "#555" }}>{it.qty} x {fmtAmt(it.price)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Package summary */}
      {packageSummary.length > 0 && (
        <>
          <div style={{ borderTop: "1px solid #ccc", margin: "16px 0" }} />
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Total Package :</div>
            <div style={{ color: "#444" }}>
              {packageSummary.map(p => `${p.qty} ${p.type}`).join(" + ")}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ borderTop: "2px solid #1a1a1a", marginTop: 20, paddingTop: 14, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span><strong>Total Bills</strong> : {totalBills}</span>
        <span><strong>Total Amount</strong> : {fmt(grandTotal)}</span>
      </div>
    </div>
  );
}

// ── DeliveryCard ──────────────────────────────────────────────────────────────

function DeliveryCard({ trip }: { trip: DeliveryTrip }) {
  const { delivery, customers, packageSummary, totalBills, grandTotal } = trip;

  // Collapsed state: Set of customer names that are open
  const allNames = customers.map(c => c.customerName);
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(allNames));

  // Print ref for image export
  const printRef = useRef<HTMLDivElement>(null);

  // Export image state
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
    } finally {
      setExporting(false);
    }
  }, [delivery.deliveryNo]);

  // Copy-to-clipboard state
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildTripText(trip));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without interaction
      const ta = document.createElement("textarea");
      ta.value = buildTripText(trip);
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [trip]);

  const expandAll  = useCallback(() => setOpenSet(new Set(allNames)), [allNames.join(",")]);
  const collapseAll = useCallback(() => setOpenSet(new Set()), []);
  const toggle = useCallback((name: string) =>
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

  return (
  <>
    <Card className="overflow-hidden border-border">
      {/* ── Card header ── */}
      <div className="flex items-start justify-between px-5 py-4 bg-primary/5 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold tracking-tight">{delivery.deliveryNo}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeCls}`}>
              {delivery.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground pl-7">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {(() => {
                try { return format(new Date(delivery.date), "dd/MM/yyyy"); }
                catch { return delivery.date; }
              })()}
            </span>
            {delivery.driver && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {delivery.driver}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-accent">{fmt(grandTotal)}</div>
          <div className="text-xs text-muted-foreground">{totalBills} bill{totalBills !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* ── Report action buttons ── flex row → column on mobile */}
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
            {/* ── Expand / Collapse buttons ── */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={expandAll}
                disabled={allOpen}
                className="h-8 gap-1.5 text-xs"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                Expand All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={collapseAll}
                disabled={allClosed}
                className="h-8 gap-1.5 text-xs"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 rotate-90" />
                Collapse All
              </Button>
            </div>

            {/* ── Customer rows ── */}
            <div className="space-y-2">
              {customers.map((grp) => (
                <CustomerRow
                  key={grp.customerName}
                  group={grp}
                  open={openSet.has(grp.customerName)}
                  onToggle={() => toggle(grp.customerName)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Package Summary ── */}
        {packageSummary.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-2.5">
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

        {/* ── Footer totals ── */}
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

    </Card>

    {/* Hidden print view outside Card so overflow:hidden doesn't clip it */}
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

      {/* States */}
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
        <div className="space-y-5">
          {trips.map((trip) => (
            <DeliveryCard key={trip.delivery.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
