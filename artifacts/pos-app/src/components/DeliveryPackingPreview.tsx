import { forwardRef } from "react";
import { format } from "date-fns";
import type { FullInvoice } from "./InvoicePreview";

export type { FullInvoice };

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

export interface PackageGroup {
  id: string;
  itemIndices: number[]; // sorted ascending, 0-based indices into invoice.items
  packageType: string;
  packageQty: number;
}

/** Aggregate groups → "Total : 2 កេះ + 1 បាវ" (preserves insertion order, sums same types) */
function buildTotalLine(groups: PackageGroup[]): string {
  if (groups.length === 0) return "";
  const map = new Map<string, number>();
  for (const g of groups) {
    map.set(g.packageType, (map.get(g.packageType) ?? 0) + g.packageQty);
  }
  return "Total : " + [...map.entries()].map(([t, q]) => `${q} ${t}`).join(" + ");
}

interface Props {
  invoice: FullInvoice;
  groups: PackageGroup[];
  showDelivery?: boolean;
}

export const DeliveryPackingPreview = forwardRef<HTMLDivElement, Props>(
  ({ invoice, groups, showDelivery = true }, ref) => {
    const rawDate = invoice.createdAt ?? invoice.date;
    const dateStr = safeDate(rawDate, "dd/MM/yyyy HH:mm");
    const { day, month, year } = parseDateParts(rawDate);

    // Build lookup: itemIndex → { group, pos, total }
    const groupMap = new Map<number, { group: PackageGroup; pos: number; total: number }>();
    for (const g of groups) {
      const sorted = [...g.itemIndices].sort((a, b) => a - b);
      sorted.forEach((idx, pos) => groupMap.set(idx, { group: g, pos, total: sorted.length }));
    }

    const items   = invoice.items;
    const totalLine = buildTotalLine(groups);

    /* ── shared style helpers ── */
    const FONT = "'Noto Sans Khmer', Arial, sans-serif";
    const MONO = "'Courier New', 'Lucida Console', monospace"; // for box chars
    const BASE: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: "#1a1a1a" };

    const s: Record<string, React.CSSProperties> = {
      root: { ...BASE, width: 800, backgroundColor: "#fff", padding: "40px 48px 48px", boxSizing: "border-box" },
      headerWrap: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1a1a1a", marginBottom: 20, paddingBottom: 16 },
      headerLeft:   { flex: 1, fontSize: 13, lineHeight: 2.1 },
      headerCenter: { flex: "0 0 auto" as const, textAlign: "center" as const, borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc", padding: "0 32px" },
      headerRight:  { flex: 1, textAlign: "right" as const, fontSize: 13, lineHeight: 2.1 },
      table: { width: "100%", borderCollapse: "collapse" as const },
      th: {
        padding: "10px 8px", backgroundColor: "#1a1a1a", color: "#fff",
        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
        textTransform: "uppercase" as const, borderRight: "1px solid #333",
        fontFamily: FONT,
      },
      td: {
        padding: "7px 8px", fontSize: 13,
        borderBottom: "1px solid #e8e8e8", borderRight: "1px solid #e0e0e0",
        fontFamily: FONT,
      },
    };

    return (
      <div ref={ref} style={s.root}>

        {/* 3-column header */}
        <div style={s.headerWrap}>
          <div style={s.headerLeft}>
            <div>អតិថិជន : {invoice.customerName}</div>
            <div>Customer : {invoice.customerName}</div>
            <div>លេខ : {invoice.invoiceNo}</div>
          </div>
          <div style={s.headerCenter}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>វិក័យបត្រ</div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#444", marginTop: 4 }}>DELIVERY</div>
          </div>
          <div style={s.headerRight}>
            {showDelivery && <div>TEL : {invoice.deliveryNo ?? "—"}</div>}
            <div>Date : {dateStr}</div>
            <div>ថ្ងៃ {day} ខែ {month} ឆ្នាំ {year}</div>
          </div>
        </div>

        {/* Note */}
        {invoice.note && (
          <div style={{ fontSize: 12, color: "#555", marginBottom: 14, padding: "6px 10px", backgroundColor: "#f8f8f8", borderRadius: 4 }}>
            <strong>Note:</strong> {invoice.note}
          </div>
        )}

        {/* Packing table — no price columns */}
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: 36,  textAlign: "center" as const }}>No</th>
              <th style={{ ...s.th, textAlign: "left" as const }}>Name of Good</th>
              <th style={{ ...s.th, width: 70,  textAlign: "center" as const }}>Qty</th>
              <th style={{ ...s.th, width: 220, textAlign: "left" as const, borderRight: "none" }}>Package</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const info = groupMap.get(i);
              const bg   = i % 2 === 0 ? "#ffffff" : "#fafafa";

              let pkgCell: React.ReactNode;

              if (info) {
                const { group, pos, total } = info;
                // middleRow = floor(totalRows / 2)
                const isMiddle = pos === Math.floor(total / 2);

                /*
                 * Use Unicode box-drawing characters so the connector
                 * renders identically in both the browser and the exported image.
                 *
                 * All rows in a group:  │  (U+2502 BOX DRAWINGS LIGHT VERTICAL)
                 * Middle row:          ├── qty type
                 */
                const boxChar = isMiddle
                  ? `\u251C\u2500\u2500 ${group.packageQty} ${group.packageType}`
                  : "\u2502";

                pkgCell = (
                  <td style={{
                    ...s.td,
                    borderRight: "none",
                    paddingLeft: 14,
                    fontFamily: isMiddle ? `${FONT}` : MONO,
                    fontSize: isMiddle ? 13 : 15,
                    fontWeight: isMiddle ? 700 : 400,
                    color: "#1a1a1a",
                    whiteSpace: "nowrap" as const,
                    letterSpacing: isMiddle ? 0.2 : 0,
                  }}>
                    {boxChar}
                  </td>
                );
              } else {
                pkgCell = <td style={{ ...s.td, borderRight: "none" }} />;
              }

              return (
                <tr key={i} style={{ backgroundColor: bg }}>
                  <td style={{ ...s.td, textAlign: "center" as const, color: "#555" }}>{i + 1}</td>
                  <td style={{ ...s.td }}>{item.productName}</td>
                  <td style={{ ...s.td, textAlign: "center" as const, fontWeight: 700 }}>{item.qty}</td>
                  {pkgCell}
                </tr>
              );
            })}
          </tbody>

          {/* Total Package summary — aligned under the Package column */}
          {totalLine && (
            <tfoot>
              <tr style={{ borderTop: "2px solid #1a1a1a" }}>
                <td colSpan={3} style={{
                  ...s.td, borderBottom: "none", borderRight: "1px solid #e0e0e0",
                  fontWeight: 700, textAlign: "right" as const, color: "#555",
                }} />
                <td style={{
                  ...s.td, borderBottom: "none", borderRight: "none",
                  fontFamily: FONT, fontWeight: 800, fontSize: 13,
                  color: "#1a1a1a", paddingLeft: 14, whiteSpace: "nowrap" as const,
                }}>
                  {totalLine}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Signature */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #e0e0e0", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "right" as const, fontSize: 11, color: "#888" }}>
            <div style={{ borderTop: "1px solid #aaa", width: 140, marginBottom: 4 }} />
            <div>Authorised Signature</div>
          </div>
        </div>

      </div>
    );
  }
);

DeliveryPackingPreview.displayName = "DeliveryPackingPreview";
