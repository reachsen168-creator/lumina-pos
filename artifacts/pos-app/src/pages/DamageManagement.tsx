import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Wrench, Eye, AlertTriangle, CheckCircle2, Clock,
  Search, Plus, Trash2, X, RefreshCw, ShoppingBag,
} from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Card }        from "@/components/ui/card";
import { Input }       from "@/components/ui/input";
import { Label }       from "@/components/ui/label";
import { Button }      from "@/components/ui/button";
import { Badge }       from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast }    from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DamageRecord {
  id: number;
  itemName: string;
  productId: number | null;
  damageQty: number;
  repairedQty: number;
  soldQty: number;
  remainingQty: number;
  invoiceNumber: string | null;
  customerName: string | null;
  damageDate: string;
  damageReason: string | null;
  status: string;
  soldTo: string | null;
  saleInvoice: string | null;
}

interface HistoryLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  description: string | null;
  createdAt: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchDamageRecords(params: Record<string, string>): Promise<DamageRecord[]> {
  const p = new URLSearchParams(params);
  const r = await fetch(`${BASE()}/api/damage-records?${p}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function repairRecord(id: number, repairQty: number): Promise<DamageRecord> {
  const r = await fetch(`${BASE()}/api/damage-records/${id}/repair`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repairQty }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
  return r.json();
}

async function sellRecord(id: number, sellQty: number, soldTo: string, saleInvoice: string): Promise<DamageRecord> {
  const r = await fetch(`${BASE()}/api/damage-records/${id}/sell`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellQty, soldTo, saleInvoice }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
  return r.json();
}

async function fetchHistory(id: number): Promise<HistoryLog[]> {
  const r = await fetch(`${BASE()}/api/damage-records/${id}/history`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function deleteRecord(id: number): Promise<void> {
  await fetch(`${BASE()}/api/damage-records/${id}`, { method: "DELETE" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  try { return format(new Date(s), "dd/MM/yyyy"); } catch { return s; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ElementType }> = {
    "Damaged":           { color: "bg-red-100 text-red-700 border-red-200",    icon: AlertTriangle  },
    "Partially Repaired":{ color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock   },
    "Ready to Sell":     { color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  };
  const cfg = map[status] ?? { color: "bg-muted text-muted-foreground border-border", icon: AlertTriangle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
}

// ── Repair Dialog ─────────────────────────────────────────────────────────────

function RepairDialog({
  record, onClose, onSuccess,
}: { record: DamageRecord; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const maxRepair = record.damageQty - record.repairedQty;
  const [qty, setQty] = useState(1);

  const mut = useMutation({
    mutationFn: () => repairRecord(record.id, qty),
    onSuccess: () => { toast({ title: "Repair recorded" }); onSuccess(); onClose(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-accent" /> Repair Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Item:</span> <strong>{record.itemName}</strong></div>
            <div><span className="text-muted-foreground">Total Damaged:</span> <strong>{record.damageQty}</strong></div>
            <div><span className="text-muted-foreground">Already Repaired:</span> <strong>{record.repairedQty}</strong></div>
            <div><span className="text-muted-foreground">Available to Repair:</span> <strong className="text-accent">{maxRepair}</strong></div>
          </div>

          <div className="space-y-1.5">
            <Label>Repair Quantity <span className="text-muted-foreground text-xs">(max {maxRepair})</span></Label>
            <Input
              type="number" min={1} max={maxRepair}
              value={qty} onChange={e => setQty(Math.min(maxRepair, Math.max(1, Number(e.target.value))))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || qty <= 0 || qty > maxRepair} className="gap-2">
            {mut.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <><Wrench className="w-4 h-4" /> Confirm Repair</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sell Dialog ───────────────────────────────────────────────────────────────

function SellDialog({
  record, onClose, onSuccess,
}: { record: DamageRecord; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const available = record.repairedQty - record.soldQty;
  const [qty,         setQty]         = useState(1);
  const [soldTo,      setSoldTo]      = useState("");
  const [saleInvoice, setSaleInvoice] = useState("");

  const mut = useMutation({
    mutationFn: () => sellRecord(record.id, qty, soldTo, saleInvoice),
    onSuccess: () => { toast({ title: "Sale recorded" }); onSuccess(); onClose(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-accent" /> Sell Repaired Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Item:</span> <strong>{record.itemName} (Repaired)</strong></div>
            <div><span className="text-muted-foreground">Repaired:</span> <strong>{record.repairedQty}</strong></div>
            <div><span className="text-muted-foreground">Already Sold:</span> <strong>{record.soldQty}</strong></div>
            <div><span className="text-muted-foreground">Available to Sell:</span> <strong className="text-accent">{available}</strong></div>
          </div>

          <div className="space-y-1.5">
            <Label>Sell Quantity <span className="text-muted-foreground text-xs">(max {available})</span></Label>
            <Input type="number" min={1} max={available}
              value={qty} onChange={e => setQty(Math.min(available, Math.max(1, Number(e.target.value))))} />
          </div>
          <div className="space-y-1.5">
            <Label>Sold To</Label>
            <Input placeholder="Customer name…" value={soldTo} onChange={e => setSoldTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sale Invoice #</Label>
            <Input placeholder="Invoice number…" value={saleInvoice} onChange={e => setSaleInvoice(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || qty <= 0 || qty > available} className="gap-2">
            {mut.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <><ShoppingBag className="w-4 h-4" /> Confirm Sale</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── History Dialog ────────────────────────────────────────────────────────────

function HistoryDialog({ record, onClose }: { record: DamageRecord; onClose: () => void }) {
  const { data: logs, isLoading } = useQuery<HistoryLog[]>({
    queryKey: ["damage-history", record.id],
    queryFn:  () => fetchHistory(record.id),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent" /> History — {record.itemName}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-2 py-2">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>}
          {!isLoading && (!logs || logs.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">No history yet.</p>
          )}
          {logs?.map(log => (
            <div key={log.id} className="rounded-lg bg-muted/40 p-3 text-sm border border-border">
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-xs">{log.action}</Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
              <p className="text-foreground">{log.description}</p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DamageManagement() {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("");
  const [filter,  setFilter]  = useState({ search: "", status: "" });

  const [repairRecord,  setRepairRecord]  = useState<DamageRecord | null>(null);
  const [sellRecord_,   setSellRecord]    = useState<DamageRecord | null>(null);
  const [historyRecord, setHistoryRecord] = useState<DamageRecord | null>(null);

  const params: Record<string, string> = {};
  if (filter.search) params.search = filter.search;
  if (filter.status) params.status = filter.status;

  const { data: records = [], isLoading, isError } = useQuery<DamageRecord[]>({
    queryKey: ["damage-records", filter],
    queryFn:  () => fetchDamageRecords(params),
  });

  const deleteMut = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => {
      toast({ title: "Record deleted" });
      queryClient.invalidateQueries({ queryKey: ["damage-records"] });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["damage-records"] });
  }, [queryClient]);

  const handleSearch = () => setFilter({ search, status });

  const statusOptions = ["", "Damaged", "Partially Repaired", "Ready to Sell"];

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Damage Management"
        description="Track, repair, and sell damaged items from invoices"
      />

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9" placeholder="Search by item name…"
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            {statusOptions.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button onClick={handleSearch} className="gap-2 shrink-0">
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>
      </Card>

      {/* Stats */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: records.length,                       color: "text-foreground"   },
            { label: "Damaged",       value: records.filter(r => r.status === "Damaged").length,           color: "text-red-600"     },
            { label: "Repairing",     value: records.filter(r => r.status === "Partially Repaired").length, color: "text-yellow-600" },
            { label: "Ready to Sell", value: records.filter(r => r.status === "Ready to Sell").length,     color: "text-green-600"  },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-3 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading && (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        </div>
      )}

      {isError && (
        <Card className="p-6 text-center text-red-500 border-red-200 bg-red-50">
          Failed to load damage records.
        </Card>
      )}

      {!isLoading && !isError && records.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <AlertTriangle className="w-12 h-12 opacity-20" />
          <p className="text-sm">No damage records found. Use the Damage button on invoice items to record damage.</p>
        </div>
      )}

      {!isLoading && !isError && records.length > 0 && (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {["ID", "Item", "Dmg Qty", "Repaired", "Sold", "Remaining", "Invoice", "Customer", "Date", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const availSell = r.repairedQty - r.soldQty;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">#{r.id}</td>
                      <td className="px-3 py-3 font-medium">
                        {r.itemName}
                        {r.damageReason && <div className="text-xs text-muted-foreground">{r.damageReason}</div>}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-red-600 font-bold">{r.damageQty}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-blue-600 font-semibold">{r.repairedQty}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-green-600 font-semibold">{r.soldQty}</td>
                      <td className="px-3 py-3 text-center tabular-nums font-bold">{r.remainingQty}</td>
                      <td className="px-3 py-3 text-xs text-accent">{r.invoiceNumber || "—"}</td>
                      <td className="px-3 py-3 text-xs">{r.customerName || "—"}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.damageDate)}</td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setRepairRecord(r)}
                            disabled={r.remainingQty <= 0}
                            className="gap-1 h-7 text-xs px-2"
                          >
                            <Wrench className="w-3 h-3" /> Repair
                          </Button>
                          {availSell > 0 && (
                            <Button
                              size="sm" variant="outline"
                              onClick={() => setSellRecord(r)}
                              className="gap-1 h-7 text-xs px-2 text-green-700 border-green-300 hover:bg-green-50"
                            >
                              <ShoppingBag className="w-3 h-3" /> Sell
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setHistoryRecord(r)}
                            className="gap-1 h-7 text-xs px-2"
                          >
                            <Eye className="w-3 h-3" /> History
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { if (confirm(`Delete damage record #${r.id}?`)) deleteMut.mutate(r.id); }}
                            className="gap-1 h-7 text-xs px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile cards */}
      {!isLoading && !isError && records.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {records.map(r => {
            const availSell = r.repairedQty - r.soldQty;
            return (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{r.itemName}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{r.id} · {fmtDate(r.damageDate)}</div>
                    {r.damageReason && <div className="text-xs text-muted-foreground mt-0.5">{r.damageReason}</div>}
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Damaged",  value: r.damageQty,   color: "text-red-600"   },
                    { label: "Repaired", value: r.repairedQty, color: "text-blue-600"  },
                    { label: "Sold",     value: r.soldQty,     color: "text-green-600" },
                    { label: "Left",     value: r.remainingQty,color: "text-foreground"},
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-muted/40 py-2">
                      <div className={`text-base font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                {(r.invoiceNumber || r.customerName) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {r.invoiceNumber && <div>Invoice: <span className="text-accent font-medium">{r.invoiceNumber}</span></div>}
                    {r.customerName  && <div>Customer: {r.customerName}</div>}
                  </div>
                )}

                <div className="flex gap-2 pt-1 border-t border-border flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setRepairRecord(r)}
                    disabled={r.remainingQty <= 0} className="flex-1 gap-1 text-xs">
                    <Wrench className="w-3.5 h-3.5" /> Repair
                  </Button>
                  {availSell > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setSellRecord(r)}
                      className="flex-1 gap-1 text-xs text-green-700 border-green-300">
                      <ShoppingBag className="w-3.5 h-3.5" /> Sell
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setHistoryRecord(r)} className="flex-1 gap-1 text-xs">
                    <Eye className="w-3.5 h-3.5" /> History
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {repairRecord  && <RepairDialog  record={repairRecord}  onClose={() => setRepairRecord(null)}  onSuccess={invalidate} />}
      {sellRecord_   && <SellDialog    record={sellRecord_}   onClose={() => setSellRecord(null)}    onSuccess={invalidate} />}
      {historyRecord && <HistoryDialog record={historyRecord} onClose={() => setHistoryRecord(null)} />}
    </div>
  );
}
