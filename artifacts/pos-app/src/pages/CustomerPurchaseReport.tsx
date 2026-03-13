import { useState, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronRight, ChevronDown, Copy, Check, Image as ImageIcon,
  FileText, DollarSign, Package, Search, User, ReceiptText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportItem    { productName: string; qty: number; price: number }
interface ReportInvoice { invoiceNo: string; customerName: string; date: string; total: number; items: ReportItem[] }
interface ItemSummary   { productName: string; totalQty: number }
interface ReportResponse {
  name: string; dateFrom: string; dateTo: string;
  invoices: ReportInvoice[];
  totalBills: number; totalAmount: number;
  itemSummary: ItemSummary[];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchCustomerReport(name: string, dateFrom: string, dateTo: string): Promise<ReportResponse> {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams({ name, dateFrom, dateTo });
  const r = await fetch(`${BASE}/api/reports/customer?${params}`);
  if (!r.ok) throw new Error("Failed to fetch customer report");
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function fmtDate(s: string) {
  try { return format(new Date(s), "dd/MM/yyyy"); } catch { return s; }
}

function today()     { return format(new Date(), "yyyy-MM-dd"); }
function monthStart(){ return format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"); }

// ── Copy text ─────────────────────────────────────────────────────────────────

function buildCopyText(data: ReportResponse): string {
  const lines: string[] = [];
  lines.push("CUSTOMER PURCHASE REPORT");
  if (data.name) lines.push(`Customer : ${data.name}`);
  lines.push(`From : ${fmtDate(data.dateFrom)}  To : ${fmtDate(data.dateTo)}`);

  for (const inv of data.invoices) {
    lines.push("");
    lines.push(`${inv.invoiceNo}  ${fmtDate(inv.date)}  ${fmt(inv.total)}`);
    for (const it of inv.items) {
      const total = it.qty * it.price;
      lines.push(`  ${it.productName}  ${it.qty} × ${fmt(it.price)} = ${fmt(total)}`);
    }
  }

  lines.push("");
  lines.push(`Total Bills : ${data.totalBills}`);
  lines.push(`Total Amount : ${fmt(data.totalAmount)}`);

  if (data.itemSummary.length > 0) {
    lines.push("");
    lines.push("Item Summary :");
    for (const s of data.itemSummary) {
      lines.push(`  ${s.productName} × ${s.totalQty}`);
    }
  }

  return lines.join("\n");
}

// ── BillCard — collapsible ────────────────────────────────────────────────────

function BillCard({ inv, open, onToggle }: { inv: ReportInvoice; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open
            ? <ChevronDown  className="w-4 h-4 text-accent shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          }
          <ReceiptText className="w-4 h-4 text-accent shrink-0" />
          <span className="font-semibold text-sm truncate">{inv.invoiceNo}</span>
          <span className="text-xs text-muted-foreground shrink-0">{fmtDate(inv.date)}</span>
        </div>
        <span className="text-sm font-bold text-accent shrink-0">{fmt(inv.total)}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2 bg-background border-t border-border">
          {inv.items.map((it, i) => {
            const total = it.qty * it.price;
            return (
              <div key={i} className="flex items-start justify-between text-sm gap-2">
                <span className="font-medium text-foreground leading-snug">{it.productName}</span>
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

function PrintView({ data, printRef }: { data: ReportResponse; printRef: React.RefObject<HTMLDivElement | null> }) {
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
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
        CUSTOMER PURCHASE REPORT
      </div>
      <div style={{ fontSize: 13, lineHeight: 2, color: "#444", marginBottom: 4 }}>
        {data.name && <div><strong>Customer</strong> : {data.name}</div>}
        <div><strong>From</strong> : {fmtDate(data.dateFrom)}  &nbsp;<strong>To</strong> : {fmtDate(data.dateTo)}</div>
      </div>

      <div style={{ borderTop: "2px solid #1a1a1a", margin: "14px 0" }} />

      {data.invoices.map((inv, ii) => (
        <div key={ii} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            <span>{inv.invoiceNo} — {fmtDate(inv.date)}</span>
            <span>{fmt(inv.total)}</span>
          </div>
          <div style={{ paddingLeft: 16 }}>
            {inv.items.map((it, ji) => {
              const total = it.qty * it.price;
              return (
                <div key={ji} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span>{it.productName}</span>
                  <span style={{ color: "#555" }}>{it.qty} × {fmt(it.price)} = {fmt(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ borderTop: "2px solid #1a1a1a", marginTop: 16, paddingTop: 12, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span><strong>Total Bills</strong> : {data.totalBills}</span>
          <span><strong>Total Amount</strong> : {fmt(data.totalAmount)}</span>
        </div>
      </div>

      {data.itemSummary.length > 0 && (
        <>
          <div style={{ borderTop: "1px solid #ccc", margin: "14px 0 10px" }} />
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Item Summary</div>
          <div style={{ paddingLeft: 16 }}>
            {data.itemSummary.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <span>{s.productName}</span>
                <span style={{ color: "#555" }}>× {s.totalQty}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Results panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ data }: { data: ReportResponse }) {
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set());
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied]       = useState(false);

  const toggle = useCallback((no: string) =>
    setOpenSet(prev => { const n = new Set(prev); n.has(no) ? n.delete(no) : n.add(no); return n; }), []);

  const allKeys   = data.invoices.map(i => i.invoiceNo);
  const allOpen   = allKeys.every(k => openSet.has(k));
  const allClosed = allKeys.every(k => !openSet.has(k));

  const handleExport = useCallback(async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(printRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `customer-report-${data.name || "all"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally { setExporting(false); }
  }, [data.name]);

  const handleCopy = useCallback(async () => {
    const text = buildCopyText(data);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  return (
    <>
      <Card className="overflow-hidden border-border">
        <div className="p-4 space-y-4">

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-accent/10 border border-accent/20 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-accent">{data.totalBills}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Total Bills
              </div>
            </div>
            <div className="rounded-lg bg-accent/10 border border-accent/20 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-accent">{fmt(data.totalAmount)}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Total Amount
              </div>
            </div>
          </div>

          {/* Action buttons */}
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

          <Separator />

          {/* Bills section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-accent" />
                <span className="font-semibold text-sm">Bills</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpenSet(new Set(allKeys))} disabled={allOpen}
                  className="h-7 text-xs px-2">Expand All</Button>
                <Button size="sm" variant="outline" onClick={() => setOpenSet(new Set())} disabled={allClosed}
                  className="h-7 text-xs px-2">Collapse All</Button>
              </div>
            </div>

            {data.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">No bills found for this filter.</p>
            ) : (
              <div className="space-y-2">
                {data.invoices.map(inv => (
                  <BillCard
                    key={inv.invoiceNo}
                    inv={inv}
                    open={openSet.has(inv.invoiceNo)}
                    onToggle={() => toggle(inv.invoiceNo)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Item summary */}
          {data.itemSummary.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-accent" />
                  <span className="font-semibold text-sm">Item Summary</span>
                </div>
                <div className="space-y-1.5">
                  {data.itemSummary.map((s) => (
                    <div key={s.productName} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/40">
                      <span className="font-medium text-foreground">{s.productName}</span>
                      <span className="text-muted-foreground tabular-nums">
                        × <span className="font-semibold text-foreground">{s.totalQty}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </Card>

      {/* Hidden print view — outside Card to avoid overflow:hidden clip */}
      <PrintView data={data} printRef={printRef} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomerPurchaseReport() {
  const [name,     setName]     = useState("");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo,   setDateTo]   = useState(today);

  // Track what was last searched so results only update on explicit search
  const [query, setQuery] = useState<{ name: string; dateFrom: string; dateTo: string } | null>(null);

  const { data, isLoading, isError } = useQuery<ReportResponse>({
    queryKey: ["customer-report", query?.name, query?.dateFrom, query?.dateTo],
    queryFn: () => fetchCustomerReport(query!.name, query!.dateFrom, query!.dateTo),
    enabled: !!query,
  });

  const handleSearch = () => setQuery({ name, dateFrom, dateTo });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Purchase Report"
        description="Search purchases by customer name and date range"
      />

      {/* Filter card */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Customer name */}
          <div className="space-y-1.5">
            <Label htmlFor="cust-name" className="text-sm font-medium">Customer Name</Label>
            <div className="flex gap-2">
              <Input
                id="cust-name"
                placeholder="Search by name…"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
            </div>
          </div>

          {/* Date range */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="date-from" className="text-sm font-medium">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="date-to" className="text-sm font-medium">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Search button */}
          <Button onClick={handleSearch} className="w-full sm:w-auto gap-2">
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>
      </Card>

      {/* States */}
      {!query && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <User className="w-12 h-12 opacity-20" />
          <p className="text-sm">Enter a customer name and date range, then press Search.</p>
        </div>
      )}

      {query && isLoading && (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Searching…
          </div>
        </div>
      )}

      {query && isError && (
        <Card className="p-6 text-center text-red-500 border-red-200 bg-red-50">
          Failed to load report. Please try again.
        </Card>
      )}

      {query && !isLoading && !isError && data && (
        <ResultsPanel data={data} />
      )}
    </div>
  );
}
