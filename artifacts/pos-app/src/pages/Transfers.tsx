import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  useGetTransfers,
  useCreateTransfer,
  useGetInvoices,
  useGetInvoice,
  getGetTransfersQueryKey,
  getGetInvoicesQueryKey,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { ArrowRightLeft, Send, History, RotateCcw, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Transfers() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: transfers = [], isLoading: isLoadingTransfers } = useGetTransfers({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: invoices = [] } = useGetInvoices();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateTransfer();

  // Form state
  const [sourceInvId, setSourceInvId] = useState<string>("none");
  const [productId, setProductId] = useState<string>("none");
  const [qty, setQty] = useState("1");
  const [destMode, setDestMode] = useState<"invoice" | "new">("invoice");
  const [destInvId, setDestInvId] = useState<string>("none");
  const [newCustomerName, setNewCustomerName] = useState("");

  // Preview dialog state
  const [showPreview, setShowPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Undo state
  const [undoingId, setUndoingId] = useState<number | null>(null);

  const sourceInvoiceListEntry = (invoices as any[]).find(i => i.id.toString() === sourceInvId);
  const { data: sourceInvoiceDetail } = useGetInvoice(
    sourceInvId !== "none" ? parseInt(sourceInvId) : 0,
    { query: { enabled: sourceInvId !== "none" } }
  );
  const sourceInvoice = sourceInvoiceDetail || sourceInvoiceListEntry;
  const itemsInSource: any[] = (sourceInvoiceDetail as any)?.items || [];
  const selectedItem = itemsInSource.find((i: any) => i.productId.toString() === productId);

  const destInvoice = destMode === "invoice"
    ? (invoices as any[]).find(i => i.id.toString() === destInvId)
    : null;

  const resetForm = () => {
    setSourceInvId("none");
    setProductId("none");
    setQty("1");
    setDestInvId("none");
    setNewCustomerName("");
  };

  // Validate and open preview
  const handleOpenPreview = () => {
    if (sourceInvId === "none" || productId === "none") {
      toast({ title: "Please select source invoice and item", variant: "destructive" });
      return;
    }
    if (destMode === "invoice" && destInvId === "none") {
      toast({ title: "Please select a destination invoice", variant: "destructive" });
      return;
    }
    if (destMode === "new" && !newCustomerName.trim()) {
      toast({ title: "Please enter new customer name", variant: "destructive" });
      return;
    }
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) {
      toast({ title: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }
    if (selectedItem && qtyNum > selectedItem.qty) {
      toast({ title: "Transfer quantity exceeds available items.", variant: "destructive" });
      return;
    }
    if (selectedItem && selectedItem.qty <= 0) {
      toast({ title: "Transfer quantity exceeds available items.", variant: "destructive" });
      return;
    }
    setShowPreview(true);
  };

  // Execute confirmed transfer
  const handleConfirmTransfer = async () => {
    setIsExecuting(true);
    const payload = {
      fromInvoiceId: Number(sourceInvId),
      productId: Number(productId),
      qty: Number(qty),
      toInvoiceId: destMode === "invoice" ? Number(destInvId) : null,
      toCustomerName: destMode === "new" ? newCustomerName.trim() : null,
    };

    try {
      await createMut.mutateAsync({ data: payload as any });
      toast({ title: "Transfer completed successfully" });
      queryClient.invalidateQueries({ queryKey: getGetTransfersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetInvoicesQueryKey() });
      setShowPreview(false);
      resetForm();
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Transfer failed";
      toast({ title: msg, variant: "destructive" });
      setShowPreview(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Undo a transfer
  const handleUndo = async (transferId: number) => {
    setUndoingId(transferId);
    try {
      const res = await fetch(`${BASE()}/api/transfers/${transferId}/undo`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Undo failed");
      }
      toast({ title: "Transfer reversed successfully" });
      queryClient.invalidateQueries({ queryKey: getGetTransfersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetInvoicesQueryKey() });
    } catch (e: any) {
      toast({ title: e.message || "Undo failed", variant: "destructive" });
    } finally {
      setUndoingId(null);
    }
  };

  const formatDt = (dt: string) => {
    try { return format(new Date(dt), "MMM d, yy HH:mm"); } catch { return dt; }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Item Transfers"
        description="Move items between invoices or create new customer records"
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* ── SECTION A: NEW TRANSFER ── */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="shadow-lg border-none ring-1 ring-border bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="border-b border-border pb-4 bg-muted/30 rounded-t-xl">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-accent" />
                New Transfer
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">

              {/* SOURCE */}
              <div className="space-y-3 p-4 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Source</div>
                <div className="grid gap-2">
                  <Label>From Invoice *</Label>
                  <Select value={sourceInvId} onValueChange={v => { setSourceInvId(v); setProductId("none"); }}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Select source invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {(invoices as any[]).map(inv => (
                        <SelectItem key={inv.id} value={inv.id.toString()}>
                          {inv.invoiceNo} — {inv.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Item to Transfer *</Label>
                  <Select value={productId} onValueChange={setProductId} disabled={sourceInvId === "none"}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {itemsInSource.map((item: any) => (
                        <SelectItem key={item.productId} value={item.productId.toString()}>
                          {item.productName} (Available: {item.qty})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedItem?.qty || undefined}
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30"
                  />
                  {selectedItem && (
                    <p className="text-xs text-muted-foreground">
                      Max available: <span className="font-semibold text-foreground">{selectedItem.qty}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ARROW */}
              <div className="flex justify-center -my-2 relative z-10">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                  <ArrowRightLeft className="w-4 h-4 rotate-90" />
                </div>
              </div>

              {/* DESTINATION */}
              <div className="space-y-3 p-4 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>2. Destination</span>
                  <div className="flex gap-1">
                    <button
                      className={`text-[10px] px-2 py-1 rounded-md transition-colors ${destMode === "invoice" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      onClick={() => setDestMode("invoice")}
                    >
                      Existing
                    </button>
                    <button
                      className={`text-[10px] px-2 py-1 rounded-md transition-colors ${destMode === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      onClick={() => setDestMode("new")}
                    >
                      New
                    </button>
                  </div>
                </div>

                {destMode === "invoice" ? (
                  <div className="grid gap-2">
                    <Label>To Invoice *</Label>
                    <Select value={destInvId} onValueChange={setDestInvId}>
                      <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                        <SelectValue placeholder="Select destination invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        {(invoices as any[])
                          .filter(i => i.id.toString() !== sourceInvId)
                          .map(inv => (
                            <SelectItem key={inv.id} value={inv.id.toString()}>
                              {inv.invoiceNo} — {inv.customerName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label>New Customer Name *</Label>
                    <Input
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      className="h-11 rounded-xl bg-muted/30"
                      placeholder="Creates a new invoice"
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={handleOpenPreview}
                disabled={sourceInvId === "none" || productId === "none"}
                className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 text-base font-bold"
              >
                Preview Transfer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── SECTION B: HISTORY ── */}
        <div className="xl:col-span-8 space-y-4">
          <Card className="shadow-md border-none ring-1 ring-border flex flex-col">
            <CardHeader className="border-b border-border pb-4 bg-muted/10 rounded-t-xl">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Transfer History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="p-4 border-b border-border bg-card flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 rounded-xl w-full" />
                  <span className="text-muted-foreground shrink-0">to</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 rounded-xl w-full" />
                </div>
                <div className="w-full sm:w-auto shrink-0">
                  <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/30 uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold text-center">Qty</th>
                      <th className="px-4 py-3 font-semibold">From</th>
                      <th className="px-4 py-3 font-semibold">To</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingTransfers ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading history...</td></tr>
                    ) : (transfers as any[]).length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-20 text-center bg-muted/10">
                        <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <p className="text-muted-foreground font-medium">No transfers found</p>
                      </td></tr>
                    ) : (
                      (transfers as any[]).map((t) => (
                        <tr key={t.id} className={`border-b border-border transition-colors ${t.isReversed ? "opacity-50 bg-muted/10" : "hover:bg-muted/30"}`}>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {formatDt(t.createdAt || t.date)}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{t.itemName || t.productName}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary" className="px-2.5 py-1 font-bold">{t.qty}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col leading-tight">
                              <span className="text-xs text-muted-foreground">{t.fromInvoiceNo}</span>
                              <span className="font-medium text-foreground text-xs">{t.fromCustomerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col leading-tight">
                              <span className="text-xs text-muted-foreground">{t.toInvoiceNo}</span>
                              <span className="font-medium text-foreground text-xs">{t.toCustomerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {t.isReversed ? (
                              <Badge className="bg-red-100 text-red-700 border-none text-xs">Reversed</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 border-none text-xs">Active</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!t.isReversed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-xs gap-1"
                                disabled={undoingId === t.id}
                                onClick={() => handleUndo(t.id)}
                              >
                                <RotateCcw className="w-3 h-3" />
                                {undoingId === t.id ? "Undoing..." : "Undo"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden p-3 space-y-3">
                {isLoadingTransfers ? (
                  <p className="text-center text-muted-foreground py-10">Loading history...</p>
                ) : (transfers as any[]).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ArrowRightLeft className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p>No transfers found</p>
                  </div>
                ) : (
                  (transfers as any[]).map((t) => (
                    <div key={t.id} className={`border border-border rounded-xl p-4 space-y-3 bg-card ${t.isReversed ? "opacity-50" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{t.itemName || t.productName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-bold">×{t.qty}</Badge>
                          {t.isReversed ? (
                            <Badge className="bg-red-100 text-red-700 border-none text-xs">Reversed</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-none text-xs">Active</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 bg-muted/40 rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">{t.fromInvoiceNo}</div>
                          <div className="font-medium text-xs">{t.fromCustomerName}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 bg-muted/40 rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">{t.toInvoiceNo}</div>
                          <div className="font-medium text-xs">{t.toCustomerName}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        <span className="text-xs text-muted-foreground">{formatDt(t.createdAt || t.date)}</span>
                        {!t.isReversed && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg text-xs gap-1"
                            disabled={undoingId === t.id}
                            onClick={() => handleUndo(t.id)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {undoingId === t.id ? "Undoing..." : "Undo"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── PREVIEW DIALOG ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-accent" />
              Transfer Preview
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Item + Qty */}
            <div className="bg-muted/40 rounded-xl p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">Item</p>
              <p className="text-lg font-bold text-foreground">{selectedItem?.productName || "—"}</p>
              <p className="text-sm text-muted-foreground">Quantity</p>
              <p className="text-2xl font-bold text-accent">{qty}</p>
            </div>

            {/* From → To */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">FROM</p>
                <p className="text-sm font-semibold text-foreground">{sourceInvoice?.invoiceNo}</p>
                <p className="text-sm text-muted-foreground">{sourceInvoice?.customerName}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider">TO</p>
                {destMode === "invoice" ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">{destInvoice?.invoiceNo}</p>
                    <p className="text-sm text-muted-foreground">{destInvoice?.customerName}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">New Invoice</p>
                    <p className="text-sm text-muted-foreground">{newCustomerName}</p>
                  </>
                )}
              </div>
            </div>

            {/* Stock change preview */}
            {selectedItem && (
              <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stock Change</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{selectedItem.productName} in source:</span>
                  <span>
                    <span className="font-bold text-foreground">{selectedItem.qty}</span>
                    <span className="text-muted-foreground mx-1.5">→</span>
                    <span className={`font-bold ${(selectedItem.qty - Number(qty)) <= 0 ? "text-red-600" : "text-green-600"}`}>
                      {Math.max(0, selectedItem.qty - Number(qty))}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 sm:flex-row flex-col-reverse">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowPreview(false)} disabled={isExecuting}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-accent hover:bg-accent/90 text-white font-bold"
              onClick={handleConfirmTransfer}
              disabled={isExecuting}
            >
              {isExecuting ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
