import { forwardRef } from "react";
import { format } from "date-fns";

const NUM_ROWS = 18;

function safeDate(val: string | null | undefined, fmt: string): string {
  if (!val) return "N/A";
  const d = new Date(val);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
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
  const rows = Array.from({ length: NUM_ROWS }, (_, i) => invoice.items[i] ?? null);
  const dateStr = safeDate(invoice.createdAt ?? invoice.date, "dd MMMM yyyy HH:mm");

  /* ── styles ── */
  const s: Record<string, React.CSSProperties> = {
    root: {
      width: 800,
      backgroundColor: "#ffffff",
      fontFamily: "'Arial', 'Helvetica', sans-serif",
      fontSize: 13,
      color: "#1a1a1a",
      padding: "40px 48px 48px",
      boxSizing: "border-box",
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 28,
      paddingBottom: 20,
      borderBottom: "2px solid #1a1a1a",
    },
    companyName: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: 1,
      color: "#1a1a1a",
      margin: 0,
    },
    companyTagline: {
      fontSize: 11,
      color: "#666",
      marginTop: 4,
    },
    invoiceTitle: {
      fontSize: 22,
      fontWeight: 700,
      color: "#1a1a1a",
      textAlign: "right" as const,
      letterSpacing: 2,
      textTransform: "uppercase" as const,
      margin: 0,
    },
    invoiceNo: {
      fontSize: 13,
      color: "#555",
      textAlign: "right" as const,
      marginTop: 4,
    },
    metaGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px 24px",
      marginBottom: 28,
      padding: "16px 20px",
      backgroundColor: "#f8f8f8",
      borderRadius: 6,
    },
    metaRow: {
      display: "flex",
      gap: 8,
    },
    metaLabel: {
      fontWeight: 700,
      color: "#555",
      minWidth: 80,
      fontSize: 12,
    },
    metaValue: {
      color: "#1a1a1a",
      fontSize: 12,
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
    totalRow: {
      borderTop: "2px solid #1a1a1a",
      marginTop: 0,
    },
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
    footerNote: {
      fontSize: 11,
      color: "#888",
      maxWidth: 340,
    },
    sigBlock: {
      textAlign: "right" as const,
      fontSize: 11,
      color: "#888",
    },
  };

  return (
    <div ref={ref} style={s.root}>
      {/* Company + Invoice Title */}
      <div style={s.headerRow}>
        <div>
          <p style={s.companyName}>LUMINA POS</p>
          <p style={s.companyTagline}>Sales &amp; Inventory Management</p>
        </div>
        <div>
          <p style={s.invoiceTitle}>Invoice</p>
          <p style={s.invoiceNo}>{invoice.invoiceNo}</p>
        </div>
      </div>

      {/* Meta */}
      <div style={s.metaGrid}>
        <div style={s.metaRow}>
          <span style={s.metaLabel}>Customer</span>
          <span style={s.metaValue}>{invoice.customerName}</span>
        </div>
        <div style={s.metaRow}>
          <span style={s.metaLabel}>Date &amp; Time</span>
          <span style={s.metaValue}>{dateStr}</span>
        </div>
        <div style={s.metaRow}>
          <span style={s.metaLabel}>Invoice No.</span>
          <span style={s.metaValue}>{invoice.invoiceNo}</span>
        </div>
        {showDelivery && (
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Delivery</span>
            <span style={s.metaValue}>{invoice.deliveryNo ?? "—"}</span>
          </div>
        )}
        {invoice.note && (
          <div style={{ ...s.metaRow, gridColumn: "1 / -1" }}>
            <span style={s.metaLabel}>Note</span>
            <span style={s.metaValue}>{invoice.note}</span>
          </div>
        )}
      </div>

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
                <td style={{ ...s.tdNo,    borderBottom: "1px solid #e8e8e8" }}>
                  {item ? i + 1 : ""}
                </td>
                <td style={{ ...s.tdName,  borderBottom: "1px solid #e8e8e8" }}>
                  {item?.productName ?? ""}
                </td>
                <td style={{ ...s.tdQty,   borderBottom: "1px solid #e8e8e8" }}>
                  {item ? item.qty : ""}
                </td>
                <td style={{ ...s.tdPrice, borderBottom: "1px solid #e8e8e8" }}>
                  {item ? `$${Number(item.price).toFixed(2)}` : ""}
                </td>
                <td style={{ ...s.tdAmount, borderBottom: "1px solid #e8e8e8" }}>
                  {item ? `$${Number(item.subtotal).toFixed(2)}` : ""}
                </td>
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
