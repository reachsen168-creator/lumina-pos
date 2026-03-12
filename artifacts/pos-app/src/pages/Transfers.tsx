import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  useGetTransfers,
  useCreateTransfer,
  useGetInvoices,
  getGetTransfersQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { ArrowRightLeft, Send, Search, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Transfers() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const { data: transfers = [], isLoading: isLoadingTransfers } = useGetTransfers({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });
  const { data: invoices = [] } = useGetInvoices();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateTransfer();

  // Create Form State
  const [sourceInvId, setSourceInvId] = useState<string>("none");
  const [productId, setProductId] = useState<string>("none");
  const [qty, setQty] = useState("1");
  const [destMode, setDestMode] = useState<"invoice" | "new">("invoice");
  const [destInvId, setDestInvId] = useState<string>("none");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [note, setNote] = useState("");

  const sourceInvoice = invoices.find(i => i.id.toString() === sourceInvId);
  const itemsInSource = sourceInvoice ? (sourceInvoice as any).items || [] : []; // assume API populates items

  const handleTransfer = async () => {
    if (sourceInvId === "none" || productId === "none" || !qty) return;
    
    if (destMode === "invoice" && destInvId === "none") {
      toast({ title: "Select a destination invoice", variant: "destructive" });
      return;
    }
    if (destMode === "new" && !newCustomerName.trim()) {
      toast({ title: "Enter new customer name", variant: "destructive" });
      return;
    }

    const payload = {
      sourceInvoiceId: Number(sourceInvId),
      productId: Number(productId),
      qty: Number(qty),
      destinationInvoiceId: destMode === "invoice" ? Number(destInvId) : null,
      newCustomerName: destMode === "new" ? newCustomerName : null,
      note: note || null
    };

    try {
      await createMut.mutateAsync({ data: payload as any });
      toast({ title: "Transfer completed successfully" });
      queryClient.invalidateQueries({ queryKey: getGetTransfersQueryKey() });
      
      // Reset form
      setSourceInvId("none");
      setProductId("none");
      setQty("1");
      setDestInvId("none");
      setNewCustomerName("");
      setNote("");
    } catch (e) {
      toast({ title: "Transfer failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Item Transfers" 
        description="Move items between invoices or create new customer records"
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* SECTION A - CREATE TRANSFER */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="shadow-lg border-none ring-1 ring-border bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="border-b border-border pb-4 bg-muted/30">
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
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {invoices.map((inv: any) => <SelectItem key={inv.id} value={inv.id.toString()}>{inv.invoiceNo} ({inv.customerName})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Item to Transfer *</Label>
                  <Select value={productId} onValueChange={setProductId} disabled={sourceInvId === "none"}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {itemsInSource.map((item: any) => <SelectItem key={item.productId} value={item.productId.toString()}>{item.productName} (Max: {item.qty})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Quantity *</Label>
                  <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="h-11 rounded-xl bg-muted/30" />
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
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                  <span>2. Destination</span>
                  <div className="flex gap-2">
                    <button className={`text-[10px] px-2 py-0.5 rounded ${destMode==='invoice' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={()=>setDestMode('invoice')}>Existing</button>
                    <button className={`text-[10px] px-2 py-0.5 rounded ${destMode==='new' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={()=>setDestMode('new')}>New</button>
                  </div>
                </div>

                {destMode === 'invoice' ? (
                  <div className="grid gap-2">
                    <Label>To Existing Invoice *</Label>
                    <Select value={destInvId} onValueChange={setDestInvId}>
                      <SelectTrigger className="h-11 rounded-xl bg-muted/30"><SelectValue placeholder="Select target" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {invoices.filter((i:any) => i.id.toString() !== sourceInvId).map((inv: any) => <SelectItem key={inv.id} value={inv.id.toString()}>{inv.invoiceNo} ({inv.customerName})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label>New Customer Name *</Label>
                    <Input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="h-11 rounded-xl bg-muted/30" placeholder="Creates new invoice" />
                  </div>
                )}
              </div>

              <div className="grid gap-2 pt-2">
                <Label>Note (Optional)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} className="h-11 rounded-xl" placeholder="Reason for transfer" />
              </div>

              <Button 
                onClick={handleTransfer} 
                disabled={sourceInvId === "none" || productId === "none" || createMut.isPending}
                className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 text-lg font-bold"
              >
                {createMut.isPending ? "Transferring..." : "Execute Transfer"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* SECTION B - HISTORY */}
        <div className="xl:col-span-8 space-y-4">
          <Card className="shadow-md border-none ring-1 ring-border h-full flex flex-col">
            <CardHeader className="border-b border-border pb-4 bg-muted/10">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Transfer History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="p-4 border-b border-border bg-card flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl w-full" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl w-full" />
                </div>
                <div className="w-full md:w-auto"><DateShortcuts onSelect={(f,t) => {setDateFrom(f); setDateTo(t)}} /></div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left h-full">
                  <thead className="text-xs text-muted-foreground bg-muted/30 uppercase sticky top-0">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Product</th>
                      <th className="px-6 py-4 font-semibold text-center">Qty</th>
                      <th className="px-6 py-4 font-semibold">From (Inv/Cus)</th>
                      <th className="px-6 py-4 font-semibold">To (Inv/Cus)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingTransfers ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Loading history...</td></tr>
                    ) : transfers.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-20 text-center bg-muted/10">
                        <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <p className="text-muted-foreground font-medium">No transfers found</p>
                      </td></tr>
                    ) : (
                      transfers.map((t: any) => (
                        <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 text-muted-foreground">{format(new Date(t.date), 'MMM d, yy HH:mm')}</td>
                          <td className="px-6 py-4 font-medium text-foreground">{t.productName}</td>
                          <td className="px-6 py-4 text-center">
                            <Badge variant="secondary" className="px-2.5 py-1 font-bold">{t.qty}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{t.sourceInvoiceNo}</span>
                              <span className="font-medium text-foreground">{t.sourceCustomerName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{t.destInvoiceNo}</span>
                              <span className="font-medium text-foreground">{t.destCustomerName}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
