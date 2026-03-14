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
  return `$${Number(n).toFixed(2)}`;
}

function fmtDate(val: string): string {
  if (!val) return "";
  const d = new Date(val + "T12:00:00");
  if (isNaN(d.getTime())) return val;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export const CustomerReceiptPreview = forwardRef<HTMLDivElement, Props>(
  ({ customerName, dateFrom, dateTo, invoices }, ref) => {
    const grandTotal = invoices.reduce((s, inv) => s + Number(inv.total), 0);

    const FONT = "'Noto Sans Khmer', 'Khmer OS', Arial, sans-serif";

    return (
      <div
        ref={ref}
        style={{
          fontFamily: FONT,
          backgroundColor: "#fff",
          width: 680,
          padding: "48px 56px 56px",
          boxSizing: "border-box",
          color: "#1a1a1a",
        }}
      >
        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>
            Customer Receipt
          </div>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            Customer : <strong>{customerName}</strong>
          </div>
          {(dateFrom || dateTo) && (
            <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
              From : {dateFrom ? fmtDate(dateFrom) : "—"}&nbsp;&nbsp;–&nbsp;&nbsp;To : {dateTo ? fmtDate(dateTo) : "—"}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div style={{ borderTop: "1.5px solid #1a1a1a", marginBottom: 20 }} />

        {/* ── Invoice rows ── */}
        <div style={{ fontSize: 13 }}>
          {invoices.map((inv) => (
            <div key={inv.invoiceId} style={{ marginBottom: 10 }}>
              {inv.items.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 4,
                    gap: 8,
                  }}
                >
                  {/* Left: date (first item only) + product name */}
                  <div style={{ display: "flex", gap: 8, flex: 1 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#1a1a1a",
                        fontWeight: i === 0 ? 600 : 400,
                        minWidth: 100,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {i === 0 ? fmtDate(inv.date) : ""}
                    </span>
                    <span style={{ color: "#555", marginRight: 2 }}>
                      {i === 0 ? "." : "-"}
                    </span>
                    <span style={{ flex: 1 }}>{item.productName}</span>
                  </div>

                  {/* Right: qty × price = subtotal */}
                  <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {item.qty} × {fmt$(item.price)} = {fmt$(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Divider + Total ── */}
        <div
          style={{
            borderTop: "1.5px solid #1a1a1a",
            marginTop: 12,
            paddingTop: 12,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Total All : {fmt$(grandTotal)}
          </span>
        </div>
      </div>
    );
  }
);

CustomerReceiptPreview.displayName = "CustomerReceiptPreview";
