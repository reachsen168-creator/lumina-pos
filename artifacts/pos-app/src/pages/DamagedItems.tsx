import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  useGetDamagedItems,
  useCreateDamagedItem,
  useUpdateDamagedItem,
  useDeleteDamagedItem,
  useGetProducts,
  useGetInvoices,
  getGetDamagedItemsQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { Plus, Edit2, Trash2, Search, AlertCircle, HeartCrack } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function DamagedItems() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: damagedItems = [], isLoading } = useGetDamagedItems({
    search: search || undefined,
    status: statusFilter !== "All" ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  const { data: products = [] } = useGetProducts();
  const { data: invoices = [] } = useGetInvoices();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMut = useCreateDamagedItem();
  const updateMut = useUpdateDamagedItem();
  const deleteMut = useDeleteDamagedItem();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    productId: "",
    qty: "1",
    invoiceId: "none",
    customerName: "",
    reason: "",
    date: format(new Date(), 'yyyy-MM-dd'),
    status: "Damaged"
  });

  const handleOpen = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setForm({
        productId: item.productId.toString(),
        qty: item.qty.toString(),
        invoiceId: item.invoiceId ? item.invoiceId.toString() : "none",
        customerName: item.customerName || "",
        reason: item.reason || "",
        date: format(new Date(item.date), 'yyyy-MM-dd'),
        status: item.status
      });
    } else {
      setEditingId(null);
      setForm({
        productId: "",
        qty: "1",
        invoiceId: "none",
        customerName: "",
        reason: "",
        date: format(new Date(), 'yyyy-MM-dd'),
        status: "Damaged"
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.qty) return;
    
    const payload = {
      productId: Number(form.productId),
      qty: Number(form.qty),
      invoiceId: form.invoiceId !== "none" ? Number(form.invoiceId) : null,
      customerName: form.customerName || null,
      reason: form.reason || null,
      date: new Date(form.date).toISOString(),
      status: form.status
    };

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload as any });
        toast({ title: "Updated successfully" });
      } else {
        await createMut.mutateAsync({ data: payload as any });
        toast({ title: "Created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getGetDamagedItemsQueryKey() });
      setIsModalOpen(false);
    } catch (e) {
      toast({ title: "Error saving record", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetDamagedItemsQueryKey() });
      toast({ title: "Record deleted" });
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Repaired': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">Repaired</Badge>;
      case 'Sold Again': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">Sold Again</Badge>;
      default: return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Damaged</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Damaged Items" 
        description="Track and manage broken or defective inventory"
        action={
          <Button onClick={() => handleOpen()} className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-600/20 h-12 px-6 w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" /> Report Damage
          </Button>
        }
      />
      
      <Card className="shadow-md border-none ring-1 ring-border p-4 sm:p-6 space-y-4">
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search product or customer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-muted/50 border-transparent focus-visible:ring-accent"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full xl:w-48 h-11 rounded-xl bg-card">
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Damaged">Damaged</SelectItem>
              <SelectItem value="Repaired">Repaired</SelectItem>
              <SelectItem value="Sold Again">Sold Again</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 w-full xl:w-auto">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-card w-full" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-card w-full" />
          </div>
        </div>
        
        <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
              <tr>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Qty</th>
                <th className="px-6 py-4 font-semibold">Customer/Invoice</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Loading...</td></tr>
              ) : damagedItems.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center bg-muted/30 border-b border-dashed">
                  <HeartCrack className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-muted-foreground">No damaged items found.</p>
                </td></tr>
              ) : (
                damagedItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{item.productName}</td>
                    <td className="px-6 py-4 font-bold">{item.qty}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.customerName || '-'} 
                      {item.invoiceNo && <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded-md">{item.invoiceNo}</span>}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{item.reason || '-'}</td>
                    <td className="px-6 py-4 text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpen(item)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editingId ? 'Edit Damaged Record' : 'Report Damaged Item'}</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Product *</Label>
              <Select value={form.productId} onValueChange={v => setForm({...form, productId: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Quantity *</Label>
                <Input type="number" min="1" value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} className="h-11 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Optional Context</p>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Reference Invoice</Label>
                <Select value={form.invoiceId} onValueChange={v => setForm({...form, invoiceId: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-card"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {invoices.map((inv: any) => <SelectItem key={inv.id} value={inv.id.toString()}>{inv.invoiceNo} - {inv.customerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Customer Name</Label>
                <Input value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="h-11 rounded-xl bg-card" placeholder="If no invoice selected" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Reason / Note</Label>
              <Input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="h-11 rounded-xl" placeholder="E.g. Dropped during delivery" />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                  <SelectItem value="Repaired">Repaired</SelectItem>
                  <SelectItem value="Sold Again">Sold Again</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11">Cancel</Button>
            <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 px-8">Save Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
