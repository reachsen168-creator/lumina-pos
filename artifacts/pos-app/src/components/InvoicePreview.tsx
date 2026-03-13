import { format } from "date-fns";

const NUM_ROWS = 18;

const STORE_NAME    = "LUMINA POS";
const STORE_PHONE_1 = "012 345 678";
const STORE_PHONE_2 = "098 765 432";

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
  deposit: number;
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

/* ── colour tokens ─────────────────────────────────────────────────────────── */
const C = {
  border:    "#1a1a1a",
  headerBg:  "#1a1a1a",
  headerFg:  "#ffffff",
  paper:     "#fffef8",
  altRow:    "#f5f4ee",
  labelBg:   "#f0efe8",
  totalBg:   "#e8e7e0",
  balanceBg: "#d4edda",
  text:      "#1a1a1a",
  muted:     "#555555",
  khmerRed:  "#cc2222",
};

/* ── shared cell styles ──────────────────────────────────────────────────────*/
const border1 = `1px solid ${C.border}`;

const th = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  backgroundColor: C.headerBg,
  color: C.headerFg,
  fontWeight: 700,
  fontSize: 12,
  padding: "8px 6px",
  border: border1,
  textAlign: "center",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  ...extra,
});

const td = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontSize: 12,
  padding: "5px 6px",
  border: border1,
  color: C.text,
  verticalAlign: "middle",
  ...extra,
});

/* ── component ───────────────────────────────────────────────────────────── */

export function InvoicePreview({ invoice, showDelivery = true }: Props) {
  const rows   = Array.from({ length: NUM_ROWS }, (_, i) => invoice.items[i] ?? null);
  const deposit  = Number(invoice.deposit ?? 0);
  const total    = Number(invoice.total ?? 0);
  const balance  = total - deposit;
  const dateStr  = safeDate(invoice.createdAt ?? invoice.date, "dd/MM/yyyy");
  const timeStr  = safeDate(invoice.createdAt ?? invoice.date, "HH:mm");

  return (
    <div
      style={{
        width: 760,
        backgroundColor: C.paper,
        fontFamily: "'Noto Serif', 'Times New Roman', serif",
        color: C.text,
        boxSizing: "border-box",
        border: `3px double ${C.border}`,
        padding: 0,
      }}
    >
      {/* ── Store Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: C.headerBg,
          color: C.headerFg,
          textAlign: "center",
          padding: "16px 24px 12px",
          borderBottom: `3px double ${C.headerFg}`,
        }}
      >
        {/* Khmer subtitle */}
        <p style={{ margin: 0, fontSize: 13, letterSpacing: 1, color: "#cccccc", fontFamily: "'Noto Serif Khmer', 'Khmer', serif" }}>
          ហាង
        </p>
        {/* Store name */}
        <p style={{ margin: "2px 0 6px", fontSize: 28, fontWeight: 800, letterSpacing: 3, color: "#ffffff" }}>
          {STORE_NAME}
        </p>
        {/* Phone */}
        <p style={{ margin: 0, fontSize: 12, color: "#cccccc", letterSpacing: 0.5 }}>
          ☎&nbsp;{STORE_PHONE_1}&nbsp;&nbsp;|&nbsp;&nbsp;{STORE_PHONE_2}
        </p>
      </div>

      {/* ── Invoice Title ─────────────────────────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          padding: "10px 24px 8px",
          borderBottom: border1,
          backgroundColor: C.labelBg,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontFamily: "'Noto Serif Khmer', 'Khmer', serif", color: C.khmerRed, fontWeight: 700 }}>
          វិក្កយបត្រ
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 18, fontWeight: 800, letterSpacing: 4, color: C.text, textTransform: "uppercase" }}>
          INVOICE
        </p>
      </div>

      {/* ── Meta Info ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          borderBottom: border1,
        }}
      >
        {/* Left column */}
        <div style={{ padding: "10px 16px", borderRight: border1 }}>
          <MetaRow label="Invoice No." value={invoice.invoiceNo} />
          <MetaRow label="Customer"    value={invoice.customerName} />
          {showDelivery && <MetaRow label="Delivery" value={invoice.deliveryNo ?? "—"} />}
          {invoice.note && <MetaRow label="Note" value={invoice.note} />}
        </div>
        {/* Right column */}
        <div style={{ padding: "10px 16px" }}>
          <MetaRow label="Date" value={dateStr} />
          <MetaRow label="Time" value={timeStr} />
        </div>
      </div>

      {/* ── Product Table ─────────────────────────────────────────────────── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          <col />
          <col style={{ width: 52 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 88 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={th({ textAlign: "center" })}>No</th>
            <th style={th({ textAlign: "left", paddingLeft: 10 })}>Name of Good</th>
            <th style={th()}>Qty</th>
            <th style={th({ textAlign: "right", paddingRight: 8 })}>Unit Price</th>
            <th style={th({ textAlign: "right", paddingRight: 8 })}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => {
            const bg = i % 2 === 0 ? C.paper : C.altRow;
            return (
              <tr key={i} style={{ backgroundColor: bg }}>
                <td style={td({ textAlign: "center", color: C.muted })}>
                  {item ? i + 1 : ""}
                </td>
                <td style={td({ paddingLeft: 10, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>
                  {item?.productName ?? ""}
                </td>
                <td style={td({ textAlign: "center" })}>
                  {item ? item.qty : ""}
                </td>
                <td style={td({ textAlign: "right", paddingRight: 8 })}>
                  {item ? `$${Number(item.price).toFixed(2)}` : ""}
                </td>
                <td style={td({ textAlign: "right", paddingRight: 8 })}>
                  {item ? `$${Number(item.subtotal).toFixed(2)}` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* ── TOTAL / DEPOSIT / BALANCE footer ──────────────────────────── */}
        <tfoot>
          <SummaryRow label="TOTAL"   value={total}   bg={C.totalBg} bold />
          <SummaryRow label="DEPOSIT" value={deposit} bg={C.labelBg} />
          <SummaryRow
            label="BALANCE"
            value={balance}
            bg={C.balanceBg}
            bold
            labelKhmer="នៅសល់"
          />
        </tfoot>
      </table>

      {/* ── Signature Section ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          borderTop: border1,
          padding: "20px 32px 28px",
          backgroundColor: C.paper,
        }}
      >
        <SigBlock
          titleKhmer="អ្នកទិញ"
          titleEn="The Buyer"
        />
        <SigBlock
          titleKhmer="អ្នកលក់"
          titleEn="The Seller"
          right
        />
      </div>
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────────*/

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "baseline" }}>
      <span style={{ fontWeight: 700, fontSize: 11, color: C.muted, minWidth: 80, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bg,
  bold,
  labelKhmer,
}: {
  label: string;
  value: number;
  bg: string;
  bold?: boolean;
  labelKhmer?: string;
}) {
  return (
    <tr style={{ backgroundColor: bg }}>
      <td
        colSpan={4}
        style={{
          border: border1,
          padding: "7px 10px",
          textAlign: "right",
          fontWeight: bold ? 800 : 600,
          fontSize: bold ? 13 : 12,
          color: C.text,
          letterSpacing: 0.5,
        }}
      >
        {labelKhmer && (
          <span style={{ fontFamily: "'Noto Serif Khmer', 'Khmer', serif", fontWeight: 400, fontSize: 11, color: C.muted, marginRight: 8 }}>
            {labelKhmer}
          </span>
        )}
        {label}
      </td>
      <td
        style={{
          border: border1,
          padding: "7px 8px",
          textAlign: "right",
          fontWeight: bold ? 800 : 600,
          fontSize: bold ? 14 : 12,
          color: C.text,
        }}
      >
        ${value.toFixed(2)}
      </td>
    </tr>
  );
}

function SigBlock({
  titleKhmer,
  titleEn,
  right,
}: {
  titleKhmer: string;
  titleEn: string;
  right?: boolean;
}) {
  return (
    <div style={{ textAlign: right ? "right" : "left" }}>
      <p style={{ margin: "0 0 2px", fontSize: 12, fontFamily: "'Noto Serif Khmer', 'Khmer', serif", color: C.muted }}>
        {titleKhmer}
      </p>
      <p style={{ margin: "0 0 40px", fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {titleEn}
      </p>
      <div
        style={{
          borderBottom: `1.5px solid ${C.border}`,
          width: 180,
          display: "inline-block",
          marginBottom: 4,
        }}
      />
      <p style={{ margin: 0, fontSize: 10, color: C.muted, letterSpacing: 0.5 }}>Signature / Date</p>
    </div>
  );
}

InvoicePreview.displayName = "InvoicePreview";
