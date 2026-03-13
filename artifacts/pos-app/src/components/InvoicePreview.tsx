import { forwardRef } from "react";
import { format } from "date-fns";

const NUM_ROWS = 18;

const KHMER_MONTHS = [
  "មករា","កុម្ភៈ","មីនា","មេសា","ឧសភា","មិថុនា",
  "កក្កដា","សីហា","កញ្ញា","តុលា","វិច្ឆិកា","ធ្នូ",
];

function safeDate(val: string | null | undefined, fmt: string): string {
  if (!val) return "N/A";
  const d = new Date(val);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
}

function parseDateParts(val: string | null | undefined) {
  const d = val ? new Date(val) : null;
  if (!d || isNaN(d.getTime())) return { day: "—", month: "—", year: "—" };
  return {
    day:   String(d.getDate()).padStart(2, "0"),
    month: KHMER_MONTHS[d.getMonth()],
    year:  String(d.getFullYear()),
  };
}

export interface FullInvoice {
  id: number;
  invoiceNo: string;
  customerName: string;
  date: string;
  createdAt?: string | null;
  total: number;
  deliveryNo?: string | null;
  note?: string | null;
  items: Array<{
    id: number;
    productName: string;
    qty: number;
    price: number;
    subtotal: number;
  }>;
}

interface Props {
  invoice: FullInvoice;
  showDelivery?: boolean;
}

export const InvoicePreview = forwardRef<HTMLDivElement, Props>(({ invoice, showDelivery = true }, ref) => {
  const rows    = Array.from({ length: NUM_ROWS }, (_, i) => invoice.items[i] ?? null);
  const rawDate = invoice.createdAt ?? invoice.date;
  const dateStr = safeDate(rawDate, "dd/MM/yyyy HH:mm");
  const { day, month, year } = parseDateParts(rawDate);

  const s: Record<string, React.CSSProperties> = {
    root: {
      width: 800,
      backgroundColor: "#ffffff",
      fontFamily: "'Noto Sans Khmer', 'Arial', sans-serif",
      fontSize: 13,
      color: "#1a1a1a",
      padding: "40px 48px 48px",
      boxSizing: "border-box",
    },
    headerWrap: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottom: "2px solid #1a1a1a",
      marginBottom: 20,
      paddingBottom: 16,
      gap: 0,
    },
    headerLeft: {
      flex: 1,
      fontSize: 13,
      lineHeight: 2.1,
      color: "#1a1a1a",
    },
    headerCenter: {
      flex: "0 0 auto",
      textAlign: "center" as const,
      borderLeft: "1px solid #ccc",
      borderRight: "1px solid #ccc",
      padding: "0 32px",
    },
    headerRight: {
      flex: 1,
      textAlign: "right" as const,
      fontSize: 13,
      lineHeight: 2.1,
      color: "#1a1a1a",
    },
    noteRow: {
      fontSize: 12,
      color: "#555",
      marginBottom: 14,
      padding: "6px 10px",
      backgroundColor: "#f8f8f8",
      borderRadius: 4,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      marginBottom: 0,
    },
    thNo:     { width: 36,  padding: "10px 8px", textAlign: "center" as const,  backgroundColor: "#1a1a1a", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, borderRight: "1px solid #333" },
    thName:   { padding: "10px 10px", textAlign: "left" as const,   backgroundColor: "#1a1a1a", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, borderRight: "1px solid #333" },
    thQty:    { width: 64,  padding: "10px 8px", textAlign: "center" as const,  backgroundColor: "#1a1a1a", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, borderRight: "1px solid #333" },
    thPrice:  { width: 90,  padding: "10px 8px", textAlign: "right" as const,   backgroundColor: "#1a1a1a", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, borderRight: "1px solid #333" },
    thAmount: { width: 90,  padding: "10px 8px", textAlign: "right" as const,   backgroundColor: "#1a1a1a", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const },
    tdNo:     { padding: "7px 8px", textAlign: "center" as const, fontSize: 12, color: "#555", borderRight: "1px solid #e0e0e0" },
    tdName:   { padding: "7px 10px", textAlign: "left" as const,   fontSize: 12, color: "#1a1a1a", borderRight: "1px solid #e0e0e0" },
    tdQty:    { padding: "7px 8px", textAlign: "center" as const, fontSize: 12, color: "#1a1a1a", borderRight: "1px solid #e0e0e0" },
    tdPrice:  { padding: "7px 8px", textAlign: "right" as const,  fontSize: 12, color: "#1a1a1a", borderRight: "1px solid #e0e0e0" },
    tdAmount: { padding: "7px 8px", textAlign: "right" as const,  fontSize: 12, color: "#1a1a1a" },
    totalRow: { borderTop: "2px solid #1a1a1a" },
    totalLabel: {
      padding: "12px 8px",
      textAlign: "right" as const,
      fontWeight: 700,
      fontSize: 13,
      color: "#1a1a1a",
      borderRight: "1px solid #e0e0e0",
    },
    totalValue: {
      padding: "12px 8px",
      textAlign: "right" as const,
      fontWeight: 800,
      fontSize: 15,
      color: "#1a1a1a",
    },
    footer: {
      marginTop: 28,
      paddingTop: 16,
      borderTop: "1px solid #e0e0e0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    footerNote: { fontSize: 11, color: "#888", maxWidth: 340 },
    sigBlock:   { textAlign: "right" as const, fontSize: 11, color: "#888" },
  };

  return (
    <div ref={ref} style={s.root}>

      {/* ── 3-column header ── */}
      <div style={s.headerWrap}>

        {/* Left: customer + invoice no */}
        <div style={s.headerLeft}>
          <div>អតិថិជន : {invoice.customerName}</div>
          <div>Customer : {invoice.customerName}</div>
          <div>លេខ : {invoice.invoiceNo}</div>
        </div>

        {/* Centre: title */}
        <div style={s.headerCenter}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2, margin: 0 }}>
            វិក័យបត្រ
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#444", marginTop: 4 }}>
            INVOICE
          </div>
        </div>

        {/* Right: delivery / date / Khmer date */}
        <div style={s.headerRight}>
          {showDelivery && <div>TEL : {invoice.deliveryNo ?? "—"}</div>}
          <div>Date : {dateStr}</div>
          <div>ថ្ងៃ {day} ខែ {month} ឆ្នាំ {year}</div>
        </div>

      </div>

      {/* Note (optional) */}
      {invoice.note && (
        <div style={s.noteRow}>
          <strong>Note:</strong> {invoice.note}
        </div>
      )}

      {/* Product table */}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.thNo}>No</th>
            <th style={s.thName}>Name of Good</th>
            <th style={s.thQty}>Qty</th>
            <th style={s.thPrice}>Unit Price</th>
            <th style={s.thAmount}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => {
            const bg = i % 2 === 0 ? "#ffffff" : "#fafafa";
            return (
              <tr key={i} style={{ backgroundColor: bg }}>
                <td style={{ ...s.tdNo,    borderBottom: "1px solid #e8e8e8" }}>{item ? i + 1 : ""}</td>
                <td style={{ ...s.tdName,  borderBottom: "1px solid #e8e8e8" }}>{item?.productName ?? ""}</td>
                <td style={{ ...s.tdQty,   borderBottom: "1px solid #e8e8e8" }}>{item ? item.qty : ""}</td>
                <td style={{ ...s.tdPrice, borderBottom: "1px solid #e8e8e8" }}>{item ? `$${Number(item.price).toFixed(2)}` : ""}</td>
                <td style={{ ...s.tdAmount, borderBottom: "1px solid #e8e8e8" }}>{item ? `$${Number(item.subtotal).toFixed(2)}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={s.totalRow}>
            <td colSpan={4} style={s.totalLabel}>TOTAL</td>
            <td style={s.totalValue}>${Number(invoice.total).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={s.footer}>
        <p style={s.footerNote}>
          Thank you for your business. This is a computer-generated invoice.
        </p>
        <div style={s.sigBlock}>
          <div style={{ borderTop: "1px solid #aaa", width: 140, marginBottom: 4 }} />
          <p style={{ margin: 0 }}>Authorised Signature</p>
        </div>
      </div>

    </div>
  );
});

InvoicePreview.displayName = "InvoicePreview";
