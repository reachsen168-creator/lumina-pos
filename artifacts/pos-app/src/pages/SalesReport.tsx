import { useState, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronRight, ChevronDown, Copy, Check, Image as ImageIcon,
  FileText, DollarSign, Package, Search, Users, ShoppingCart, ReceiptText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card }      from "@/components/ui/card";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Button }    from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalesItem    { productName: string; qty: number; price: number }
interface SalesInvoice { invoiceNo: string; date: string; createdAt: string | null; customerName: string; total: number; items: SalesItem[] }
interface ItemSumEntry { productName: string; totalQty: number }
interface CustSumEntry { customerName: string; totalBills: number; totalAmount: number }
interface SalesReportData {
  dateFrom: string; dateTo: string; customer: string;
  totalBills: number; totalCustomers: number; totalItemsSold: number; totalAmount: number;
  invoices: SalesInvoice[];
  itemSummary: ItemSumEntry[];
  customerSummary: CustSumEntry[];
}
interface CustomerRow { id: number; name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n: number) { return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`; }
function fmtDate(s: string) { try { return format(new Date(s), "dd/MM/yyyy"); } catch { return s; } }
function fmtDateTime(s: string | null) {
  if (!s) return "";
  try { return format(new Date(s), "dd/MM/yyyy HH:mm"); } catch { return s; }
}
function today()      { return format(new Date(), "yyyy-MM-dd"); }
function monthStart() { return format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"); }

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchSalesReport(dateFrom: string, dateTo: string, customer: string): Promise<SalesReportData> {
  const p = new URLSearchParams({ dateFrom, dateTo, customer });
  const r = await fetch(`${BASE()}/api/reports/sales-full?${p}`);
  if (!r.ok) throw new Error("Failed to fetch sales report");
  return r.json();
}

async function fetchCustomers(): Promise<CustomerRow[]> {
  const r = await fetch(`${BASE()}/api/customers`);
  if (!r.ok) return [];
  return r.json();
}

// ── Copy text ─────────────────────────────────────────────────────────────────

function buildCopyText(d: SalesReportData): string {
  const lines: string[] = [];
  lines.push("SALES REPORT");
  lines.push(`From : ${fmtDate(d.dateFrom)}  To : ${fmtDate(d.dateTo)}`);
  if (d.customer) lines.push(`Customer : ${d.customer}`);

  lines.push("");
  lines.push("=== SALES SUMMARY ===");
  lines.push(`Total Bills : ${d.totalBills}`);
  lines.push(`Total Customers : ${d.totalCustomers}`);
  lines.push(`Total Items Sold : ${d.totalItemsSold}`);
  lines.push(`Total Sales Amount : ${fmt(d.totalAmount)}`);

  if (d.invoices.length > 0) {
    lines.push("");
    lines.push("=== BILLS ===");
    for (const inv of d.invoices) {
      lines.push(`${inv.invoiceNo}  ${fmtDateTime(inv.createdAt) || fmtDate(inv.date)}  ${inv.customerName}  ${fmt(inv.total)}`);
      for (const it of inv.items) {
        lines.push(`  ${it.productName} = ${it.qty} x ${fmt(it.price)} = ${fmt(it.qty * it.price)}`);
      }
    }
  }

  if (d.itemSummary.length > 0) {
    lines.push("");
    lines.push("=== ITEM SUMMARY ===");
    for (const s of d.itemSummary) lines.push(`${s.productName} : ${s.totalQty}`);
  }

  if (d.customerSummary.length > 0) {
    lines.push("");
    lines.push("=== CUSTOMER SUMMARY ===");
    for (const c of d.customerSummary) {
      lines.push(`${c.customerName} : ${c.totalBills} bill${c.totalBills !== 1 ? "s" : ""}  ${fmt(c.totalAmount)}`);
    }
  }

  return lines.join("\n");
}

// ── CollapsibleSection ────────────────────────────────────────────────────────

function CollapsibleSection({
  title, icon: Icon, count, defaultOpen = false, children,
}: {
  title: string; icon: React.ElementType; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Icon className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">{title}</span>
          {count !== undefined && (
            <span className="text-xs bg-accent/15 text-accent rounded-full px-2 py-0.5 font-medium">{count}</span>
          )}
        </div>
      </button>
      {open && <div className="border-t border-border bg-background">{children}</div>}
    </div>
  );
}

// ── BillRow ───────────────────────────────────────────────────────────────────

function BillRow({ inv }: { inv: SalesInvoice }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-accent shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{inv.invoiceNo}</span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(inv.createdAt) || fmtDate(inv.date)}</span>
              <span className="text-xs text-foreground font-medium truncate">{inv.customerName}</span>
            </div>
          </div>
        </div>
        <span className="text-sm font-bold text-accent shrink-0">{fmt(inv.total)}</span>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1 bg-muted/20 space-y-1.5">
          {inv.items.map((it, i) => {
            const total = it.qty * it.price;
            return (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <span className="text-foreground">{it.productName}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {it.qty} × {fmt(it.price)} = <span className="font-semibold text-foreground">{fmt(total)}</span>
                </span>
              </div>
            );
          })}
          <div className="pt-1.5 border-t border-border flex justify-end text-sm font-bold">
            Bill Total: {fmt(inv.total)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PrintView ─────────────────────────────────────────────────────────────────

function PrintView({ data, printRef }: { data: SalesReportData; printRef: React.RefObject<HTMLDivElement | null> }) {
  const FONT = "'Noto Sans Khmer', Arial, sans-serif";
  const th = { background: "#f0f0f0", fontWeight: 700, padding: "6px 10px", fontSize: 12, textAlign: "left" as const, border: "1px solid #ddd" };
  const td = { padding: "5px 10px", fontSize: 12, border: "1px solid #ddd" };

  return (
    <div ref={printRef} style={{ position: "absolute", left: -9999, top: 0, zIndex: -1, width: 680, backgroundColor: "#fff", fontFamily: FONT, fontSize: 13, color: "#1a1a1a", padding: "36px 40px 44px", boxSizing: "border-box" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>SALES REPORT</div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
        From : {fmtDate(data.dateFrom)}  &nbsp;  To : {fmtDate(data.dateTo)}
        {data.customer && <span>  &nbsp;  Customer : {data.customer}</span>}
      </div>
      <div style={{ borderTop: "2px solid #1a1a1a", margin: "14px 0" }} />

      {/* Summary */}
      <div style={{ fontWeight: 700, marginBottom: 8 }}>SALES SUMMARY</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          ["Total Bills",       data.totalBills],
          ["Total Customers",   data.totalCustomers],
          ["Total Items Sold",  data.totalItemsSold],
          ["Total Sales Amount",fmt(data.totalAmount)],
        ].map(([label, val]) => (
          <div key={label as string} style={{ background: "#f8f8f8", padding: "8px 12px", borderRadius: 6, border: "1px solid #e0e0e0" }}>
            <div style={{ fontSize: 11, color: "#666" }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Bills */}
      {data.invoices.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>BILLS</div>
          {data.invoices.map((inv, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                <span>{inv.invoiceNo}  {fmtDateTime(inv.createdAt) || fmtDate(inv.date)}  {inv.customerName}</span>
                <span>{fmt(inv.total)}</span>
              </div>
              <div style={{ paddingLeft: 12 }}>
                {inv.items.map((it, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, color: "#444" }}>
                    <span>{it.productName}</span>
                    <span>{it.qty} × {fmt(it.price)} = {fmt(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #ccc", marginBottom: 16 }} />
        </>
      )}

      {/* Item Summary */}
      {data.itemSummary.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ITEM SUMMARY</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: "right" }}>Qty Sold</th></tr></thead>
            <tbody>{data.itemSummary.map((s, i) => (
              <tr key={i}>
                <td style={td}>{s.productName}</td>
                <td style={{ ...td, textAlign: "right" }}>{s.totalQty}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}

      {/* Customer Summary */}
      {data.customerSummary.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>CUSTOMER SUMMARY</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Customer</th>
              <th style={{ ...th, textAlign: "center" }}>Bills</th>
              <th style={{ ...th, textAlign: "right" }}>Total</th>
            </tr></thead>
            <tbody>{data.customerSummary.map((c, i) => (
              <tr key={i}>
                <td style={td}>{c.customerName}</td>
                <td style={{ ...td, textAlign: "center" }}>{c.totalBills}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(c.totalAmount)}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────

function ReportResults({ data }: { data: SalesReportData }) {
  const printRef  = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [copied,    setCopied]    = useState(false);

  const handleExport = useCallback(async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(printRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `sales-report-${data.dateFrom}-${data.dateTo}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally { setExporting(false); }
  }, [data.dateFrom, data.dateTo]);

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
      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-[10px]">
        <Button variant="outline" onClick={handleExport} disabled={exporting}
          className="flex-1 gap-2 rounded-lg py-[10px] h-auto text-sm font-medium">
          {exporting
            ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Exporting…</>
            : <><ImageIcon className="w-4 h-4" /> Export Image</>}
        </Button>
        <Button variant={copied ? "default" : "outline"} onClick={handleCopy}
          className={`flex-1 gap-2 rounded-lg py-[10px] h-auto text-sm font-medium transition-all ${copied ? "bg-green-600 hover:bg-green-600 border-green-600 text-white" : ""}`}>
          {copied
            ? <><Check className="w-4 h-4" /> Copied!</>
            : <><Copy className="w-4 h-4" /> Copy Text</>}
        </Button>
      </div>

      {/* ▼ Sales Summary */}
      <CollapsibleSection title="Sales Summary" icon={DollarSign} defaultOpen>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: "Total Bills",        value: data.totalBills,      icon: FileText    },
            { label: "Total Customers",    value: data.totalCustomers,  icon: Users       },
            { label: "Total Items Sold",   value: data.totalItemsSold,  icon: ShoppingCart},
            { label: "Total Sales Amount", value: fmt(data.totalAmount),icon: DollarSign  },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-3 text-center">
              <div className="text-xl font-bold text-accent">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" />{label}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ▼ Bills List */}
      <CollapsibleSection title="Bills List" icon={ReceiptText} count={data.invoices.length} defaultOpen>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">No bills found.</p>
        ) : (
          <div>
            {data.invoices.map(inv => <BillRow key={inv.invoiceNo} inv={inv} />)}
          </div>
        )}
      </CollapsibleSection>

      {/* ▼ Item Sales Summary */}
      <CollapsibleSection title="Item Sales Summary" icon={Package} count={data.itemSummary.length} defaultOpen>
        {data.itemSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">No items.</p>
        ) : (
          <div className="p-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Item</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground">Qty Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itemSummary.map((s, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-foreground">{s.productName}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-accent tabular-nums">{s.totalQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ▼ Customer Sales Summary */}
      <CollapsibleSection title="Customer Sales Summary" icon={Users} count={data.customerSummary.length} defaultOpen>
        {data.customerSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">No customers.</p>
        ) : (
          <div className="p-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Customer</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-foreground">Bills</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customerSummary.map((c, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-foreground font-medium">{c.customerName}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{c.totalBills}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-accent tabular-nums">{fmt(c.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Hidden print view */}
      <PrintView data={data} printRef={printRef} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SalesReport() {
  const [dateFrom,  setDateFrom]  = useState(monthStart);
  const [dateTo,    setDateTo]    = useState(today);
  const [customer,  setCustomer]  = useState("__all__");
  const [query,     setQuery]     = useState<{ dateFrom: string; dateTo: string; customer: string } | null>(null);

  const { data: customers } = useQuery<CustomerRow[]>({
    queryKey: ["customers-list"],
    queryFn:  fetchCustomers,
  });

  const { data, isLoading, isError } = useQuery<SalesReportData>({
    queryKey: ["sales-report", query?.dateFrom, query?.dateTo, query?.customer],
    queryFn:  () => fetchSalesReport(query!.dateFrom, query!.dateTo, query!.customer === "__all__" ? "" : query!.customer),
    enabled:  !!query,
  });

  const handleGenerate = () => setQuery({ dateFrom, dateTo, customer });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Report"
        description="Full sales summary with bills, items, and customer breakdown"
      />

      {/* ── Filter Card ── */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="sf-from" className="text-sm font-medium">Date From</Label>
              <Input id="sf-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="sf-to" className="text-sm font-medium">Date To</Label>
              <Input id="sf-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Customer</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Customers</SelectItem>
                {(customers ?? []).map(c => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerate} className="w-full sm:w-auto gap-2">
            <Search className="w-4 h-4" /> Generate Report
          </Button>
        </div>
      </Card>

      {/* ── States ── */}
      {!query && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <ReceiptText className="w-12 h-12 opacity-20" />
          <p className="text-sm">Set the date range and press Generate Report.</p>
        </div>
      )}

      {query && isLoading && (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Generating report…
          </div>
        </div>
      )}

      {query && isError && (
        <Card className="p-6 text-center text-red-500 border-red-200 bg-red-50">
          Failed to load report. Please try again.
        </Card>
      )}

      {query && !isLoading && !isError && data && (
        <div className="space-y-4">
          <ReportResults data={data} />
        </div>
      )}
    </div>
  );
}
