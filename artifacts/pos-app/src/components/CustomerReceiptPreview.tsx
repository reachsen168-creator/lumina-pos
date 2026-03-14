import { forwardRef } from "react";

export interface ReceiptItem {
  id: number;
  productName: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface ReceiptInvoice {
  invoiceId: number;
  invoiceNo: string;
  date: string;
  total: number;
  items: ReceiptItem[];
}

interface Props {
  customerName: string;
  dateFrom?: string;
  dateTo?: string;
  invoices: ReceiptInvoice[];
}

function fmt$(n: number) {
  const v = Number(n).toFixed(2);
  return v.endsWith(".00") ? `$${Number(n).toFixed(0)}` : `$${v}`;
}

function fmtDate(val: string): string {
  if (!val) return "";
  const d = new Date(val + "T12:00:00");
  if (isNaN(d.getTime())) return val;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/* A4 at 96 dpi = 794 × 1123 px */
const A4_W = 794;
const A4_H = 1123;
const PAD_X = 64;
const PAD_TOP = 60;

const FONT = "'Noto Sans Khmer', 'Khmer OS', Georgia, serif";

export const CustomerReceiptPreview = forwardRef<HTMLDivElement, Props>(
  ({ customerName, dateFrom, dateTo, invoices }, ref) => {
    const grandTotal = invoices.reduce((s, inv) => s + Number(inv.total), 0);

    return (
      <div
        ref={ref}
        style={{
          fontFamily: FONT,
          width: A4_W,
          height: A4_H,
          backgroundColor: "#fff",
          boxSizing: "border-box",
          padding: `${PAD_TOP}px ${PAD_X}px 60px`,
          color: "#1a1a1a",
          position: "relative",
        }}
      >
        {/* ── Title block (centered) ── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.4, marginBottom: 6 }}>
            Customer Receipt
          </div>
          <div style={{ fontSize: 15, marginBottom: 4 }}>
            Customer : <strong>{customerName}</strong>
          </div>
          {(dateFrom || dateTo) && (
            <div style={{ fontSize: 14, color: "#333" }}>
              From. {dateFrom ? fmtDate(dateFrom) : "—"}&nbsp; – &nbsp;To: {dateTo ? fmtDate(dateTo) : "—"}
            </div>
          )}
        </div>

        {/* ── Thin separator ── */}
        <div style={{ borderTop: "1px solid #888", marginBottom: 20 }} />

        {/* ── Items table ── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: 116 }} /> {/* date */}
            <col style={{ width: 14 }} />  {/* dot/dash */}
            <col />                         {/* product name — flex */}
            <col style={{ width: 180 }} /> {/* qty × price = sub */}
          </colgroup>
          <tbody>
            {invoices.map((inv) =>
              inv.items.map((item, i) => (
                <tr key={`${inv.invoiceId}-${item.id}`}>
                  {/* Date — only on first item of this invoice */}
                  <td
                    style={{
                      paddingBottom: 6,
                      paddingRight: 6,
                      verticalAlign: "top",
                      fontWeight: i === 0 ? 600 : 400,
                      color: i === 0 ? "#1a1a1a" : "transparent",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                      userSelect: "none",
                    }}
                  >
                    {fmtDate(inv.date)}
                  </td>

                  {/* Dot / dash */}
                  <td
                    style={{
                      paddingBottom: 6,
                      verticalAlign: "top",
                      color: "#444",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {i === 0 ? "." : "-"}
                  </td>

                  {/* Product name */}
                  <td
                    style={{
                      paddingBottom: 6,
                      paddingLeft: 6,
                      paddingRight: 8,
                      verticalAlign: "top",
                    }}
                  >
                    {item.productName}
                  </td>

                  {/* qty × price = subtotal — right aligned */}
                  <td
                    style={{
                      paddingBottom: 6,
                      textAlign: "right",
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.qty} × {fmt$(item.price)} = {fmt$(item.subtotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── Total ── */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ width: 220, textAlign: "right" }}>
            <div style={{ borderTop: "1px solid #555", marginBottom: 8 }} />
            <div style={{ fontSize: 14, marginBottom: 5, color: "#333" }}>
              Total Bills : <strong>{invoices.length}</strong>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Total All . {fmt$(grandTotal)}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CustomerReceiptPreview.displayName = "CustomerReceiptPreview";
