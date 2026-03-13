import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  useGetDeliveries,
  useCreateDelivery,
  useUpdateDelivery,
  useDeleteDelivery,
  useGetDeliveryDetail,
  getGetDeliveriesQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Truck, FileText, Download, ArrowLeft, Eye, EyeOff, ChevronDown, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Deliveries() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const { data: deliveries = [], isLoading } = useGetDeliveries();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMut = useCreateDelivery();
  const updateMut = useUpdateDelivery();
  const deleteMut = useDeleteDelivery();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ deliveryNo: "", date: format(new Date(), 'yyyy-MM-dd'), driver: "", status: "Pending" });

  const handleOpen = (d?: any) => {
    if (d) {
      setEditingId(d.id);
      setForm({ deliveryNo: d.deliveryNo, date: d.date.split('T')[0], driver: d.driver || "", status: d.status });
    } else {
      setEditingId(null);
      setForm({ deliveryNo: "", date: format(new Date(), 'yyyy-MM-dd'), driver: "", status: "Pending" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form };
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Delivery updated" });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: "Delivery created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetDeliveriesQueryKey() });
      setIsModalOpen(false);
    } catch (e) {
      toast({ title: "Error saving delivery", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this delivery?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetDeliveriesQueryKey() });
      toast({ title: "Deleted successfully" });
    } catch {
      toast({ title: "Error deleting delivery", variant: "destructive" });
    }
  };

  if (selectedId) {
    return <DeliveryDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Deliveries" 
        description="Manage driver deliveries and status"
        action={
          <Button onClick={() => handleOpen()} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg h-12 px-6 w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" /> New Delivery
          </Button>
        }
      />
      
      <Card className="shadow-md border-none ring-1 ring-border p-4 sm:p-6">
        {isLoading ? <div className="py-12 text-center text-muted-foreground">Loading deliveries...</div> : 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveries.map((d: any) => (
              <div key={d.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col group transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-md mb-2 inline-block">
                      {d.deliveryNo}
                    </span>
                    <h3 className="font-bold text-lg text-foreground">{d.driver || 'No Driver'}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{d.date.split('T')[0]}</p>
                  </div>
                  <Badge variant={d.status === 'Delivered' ? 'default' : 'secondary'} className={d.status === 'Delivered' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}>
                    {d.status}
                  </Badge>
                </div>
                
                <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                  <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={() => setSelectedId(d.id)}>
                    <FileText className="w-4 h-4 mr-2" /> Details
                  </Button>
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => handleOpen(d)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {deliveries.length === 0 && <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-2xl border border-dashed mt-4">No deliveries found</div>}
          </div>
        }
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editingId ? 'Edit Delivery' : 'New Delivery'}</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Delivery No</Label>
              <Input value={form.deliveryNo} onChange={e => setForm({...form, deliveryNo: e.target.value})} className="h-11 rounded-xl" placeholder="DL-001" />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-11 rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Driver Name</Label>
              <Input value={form.driver} onChange={e => setForm({...form, driver: e.target.value})} className="h-11 rounded-xl" placeholder="e.g. John Doe" />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground rounded-xl h-11 px-8">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryDetail({ id, onBack }: { id: number, onBack: () => void }) {
  const { data, isLoading } = useGetDeliveryDetail(id, { query: { enabled: !!id } } as any);
  const { toast } = useToast();
  const [showPrice, setShowPrice] = useState(true);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());
  const [copiedWith,    setCopiedWith]    = useState(false);
  const [copiedWithout, setCopiedWithout] = useState(false);

  const toggleCustomer = (idx: number) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const expandAll  = () => setExpandedCustomers(new Set((data as any)?.customerGroups?.map((_: any, i: number) => i) ?? []));
  const collapseAll = () => setExpandedCustomers(new Set());

  if (isLoading) return <div className="py-24 text-center text-muted-foreground">Loading details...</div>;
  if (!data) return <div className="py-24 text-center text-red-500 bg-red-50 rounded-2xl border border-red-100">Failed to load delivery details.</div>;

  const { delivery, customerGroups = [], productSummary = [], grandTotal = 0 } = data as any;

  const buildTxt = (mode: 'price' | 'no-price') => {
    let txt = `🚚 Delivery ${delivery.deliveryNo}\n`;
    if (delivery.driver) txt += `Driver: ${delivery.driver}\n`;
    txt += '\n';

    if (mode === 'price') {
      let grand = 0;
      customerGroups.forEach((cg: any) => {
        cg.invoices.forEach((inv: any) => {
          txt += `Inv: ${inv.invoiceNo}\n`;
          let invTotal = 0;
          inv.items.forEach((item: any) => {
            const lineTotal = Number(item.qty) * Number(item.price);
            invTotal += lineTotal;
            txt += `${item.productName} = ${item.qty} x $${Number(item.price)} = $${lineTotal}\n`;
          });
          txt += `Total: $${invTotal}\n\n`;
          grand += invTotal;
        });
      });
      txt += `Grand Total: $${grand}`;
    } else {
      let totalItems = 0;
      customerGroups.forEach((cg: any) => {
        cg.invoices.forEach((inv: any) => {
          txt += `Inv: ${inv.invoiceNo}\n\n`;
          inv.items.forEach((item: any) => {
            totalItems += Number(item.qty);
            txt += `${item.productName} = ${item.qty}\n`;
          });
          txt += '\n';
        });
      });
      txt += `Total Items: ${totalItems}`;
    }

    return txt;
  };

  const exportTxt = (mode: 'price' | 'no-price') => {
    const txt = buildTxt(mode);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Delivery_${delivery.deliveryNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTxt = async (mode: 'price' | 'no-price') => {
    const txt = buildTxt(mode);
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (mode === 'price') {
      setCopiedWith(true);
      setTimeout(() => setCopiedWith(false), 2000);
    } else {
      setCopiedWithout(true);
      setTimeout(() => setCopiedWithout(false), 2000);
    }
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={onBack} className="rounded-xl h-11 w-11 shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-display font-bold">{delivery.deliveryNo} Details</h1>
          <p className="text-muted-foreground">Driver: <span className="font-medium text-foreground">{delivery.driver || 'N/A'}</span> • Status: <span className="font-medium text-foreground">{delivery.status}</span></p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-2xl border border-border">
        <Button variant="outline" onClick={() => setShowPrice(!showPrice)} className="rounded-xl bg-card h-11">
          {showPrice ? <><EyeOff className="w-4 h-4 mr-2" /> Hide Prices</> : <><Eye className="w-4 h-4 mr-2" /> Show Prices</>}
        </Button>
        <Button variant="default" onClick={() => exportTxt('price')} className="rounded-xl h-11">
          <Download className="w-4 h-4 mr-2" /> Export TXT (With Prices)
        </Button>
        <Button variant="secondary" onClick={() => exportTxt('no-price')} className="rounded-xl h-11 border border-border">
          <Download className="w-4 h-4 mr-2" /> Export TXT (No Prices)
        </Button>
        <Button
          variant={copiedWith ? "default" : "outline"}
          onClick={() => copyTxt('price')}
          className={`rounded-xl h-11 transition-all ${copiedWith ? "bg-green-600 hover:bg-green-600 border-green-600 text-white" : "bg-card"}`}
        >
          {copiedWith
            ? <><Check className="w-4 h-4 mr-2" /> Copied!</>
            : <><Copy className="w-4 h-4 mr-2" /> Copy Text (With Prices)</>}
        </Button>
        <Button
          variant={copiedWithout ? "default" : "outline"}
          onClick={() => copyTxt('no-price')}
          className={`rounded-xl h-11 transition-all ${copiedWithout ? "bg-green-600 hover:bg-green-600 border-green-600 text-white" : "bg-card"}`}
        >
          {copiedWithout
            ? <><Check className="w-4 h-4 mr-2" /> Copied!</>
            : <><Copy className="w-4 h-4 mr-2" /> Copy Text (No Prices)</>}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-display font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-accent" /> Customer Invoices</h2>
            {customerGroups.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={expandAll}>Expand All</Button>
                <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={collapseAll}>Collapse All</Button>
              </div>
            )}
          </div>
          {customerGroups.length === 0 && <p className="text-muted-foreground italic">No invoices attached to this delivery.</p>}
          {customerGroups.map((cg: any, i: number) => {
            const isOpen = expandedCustomers.has(i);
            return (
              <Card key={i} className="shadow-sm border-none ring-1 ring-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCustomer(i)}
                  className="w-full flex items-center justify-between p-4 border-b border-border bg-muted/20 font-bold text-foreground hover:bg-muted/40 transition-colors text-left"
                >
                  <span>{cg.customerName}</span>
                  <ChevronDown
                    className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{ maxHeight: isOpen ? "2000px" : "0px", opacity: isOpen ? 1 : 0 }}
                >
                  <div className="p-4 space-y-4">
                    {cg.invoices.map((inv: any, j: number) => (
                      <div key={j} className="text-sm">
                        <div className="text-accent text-xs font-bold mb-2 bg-accent/10 inline-block px-2 py-1 rounded">Inv: {inv.invoiceNo}</div>
                        <ul className="space-y-2 mt-2">
                          {inv.items.map((item: any, k: number) => (
                            <li key={k} className="flex justify-between items-center bg-muted/10 p-2 rounded-lg">
                              <span className="font-medium text-foreground">{item.productName} <span className="text-muted-foreground font-normal ml-1">{showPrice ? `= ${item.qty} x $${item.price.toFixed(2)}` : `= ${item.qty}`}</span></span>
                              {showPrice && <span className="font-bold">${item.subtotal.toFixed(2)}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {showPrice && (
                      <div className="pt-4 mt-2 border-t border-border flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary">${(cg.customerTotal ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-display font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Summary</h2>
          <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 font-bold">TOTAL ITEMS TO LOAD</div>
            <div className="p-4">
              {productSummary.length === 0 && <p className="text-muted-foreground italic text-sm">No products found.</p>}
              <ul className="space-y-3">
                {productSummary.map((ps: any, i: number) => (
                  <li key={i} className="flex justify-between items-center py-2 border-b border-dashed border-border last:border-0">
                    <span className="font-medium text-foreground">{ps.productName}</span>
                    <Badge variant="secondary" className="px-3 py-1 text-sm">{ps.totalQty} units</Badge>
                  </li>
                ))}
              </ul>
              {showPrice && (
                <div className="mt-6 pt-5 border-t-2 border-border flex justify-between items-center text-xl font-display font-bold">
                  <span>Grand Total</span>
                  <span className="text-accent text-2xl">${grandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
