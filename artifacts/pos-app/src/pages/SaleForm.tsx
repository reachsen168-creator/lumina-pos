import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoice, useCreateInvoice, useUpdateInvoice, useGetProducts, useGetDeliveries,
  useListCustomers, useCreateCustomer,
  getLastSalePrice,
  getGetInvoicesQueryKey,
  getGetInvoiceQueryKey,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Minus, Trash2, Search, UserPlus, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function SaleForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetches
  const { data: existingInvoice, isLoading: loadingInv } = useGetInvoice(Number(id), { query: { queryKey: getGetInvoiceQueryKey(Number(id)), enabled: isEdit } });
  const { data: allProducts = [] } = useGetProducts();
  const { data: deliveries = [] } = useGetDeliveries();
  const { data: allCustomers = [] } = useListCustomers({});

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [deliveryId, setDeliveryId] = useState<string>("none");
  const [items, setItems] = useState<any[]>([]);

  // Customer combobox state
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const custRef = useRef<HTMLDivElement>(null);

  // Product Search UI
  const [prodSearch, setProdSearch] = useState("");

  const createMut = useCreateInvoice();
  const updateMut = useUpdateInvoice();
  const createCustomerMut = useCreateCustomer();

  useEffect(() => {
    if (isEdit && existingInvoice) {
      setCustomerName(existingInvoice.customerName);
      setCustQuery(existingInvoice.customerName);
      setDate(existingInvoice.date.split("T")[0]);
      setNote(existingInvoice.note || "");
      setDeliveryId(existingInvoice.deliveryId ? existingInvoice.deliveryId.toString() : "none");
      setItems(existingInvoice.items.map((i) => ({ ...i, tempId: Math.random() })));
    }
  }, [existingInvoice, isEdit]);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) {
        setCustOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filtered customer list
  const filteredCustomers = custQuery
    ? allCustomers.filter((c) => c.name.toLowerCase().includes(custQuery.toLowerCase()))
    : allCustomers;

  const exactMatch = allCustomers.some((c) => c.name.toLowerCase() === custQuery.trim().toLowerCase());
  const showAddNew = custQuery.trim().length > 0 && !exactMatch;

  function selectCustomer(name: string) {
    setCustomerName(name);
    setCustQuery(name);
    setCustOpen(false);
  }

  async function saveAsNewCustomer() {
    const name = custQuery.trim();
    if (!name) return;
    const today = new Date().toISOString().split("T")[0];
    await createCustomerMut.mutateAsync({
      data: { name, phone: null, note: null, createdDate: today },
    });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
    setCustomerName(name);
    setCustOpen(false);
    toast({ title: `"${name}" added as a new customer` });
  }

  const handleAddItem = async (product: any) => {
    let defaultPrice = product.basePrice;

    if (customerName.trim()) {
      try {
        const lastSale = await getLastSalePrice({ customerName, productId: product.id });
        if (lastSale && lastSale.hasHistory) {
          defaultPrice = lastSale.price;
          toast({
            title: `Applied last sale price: $${defaultPrice}`,
            description: `Last bought on ${lastSale.date?.split("T")[0]}`,
          });
        }
      } catch (e) {
        // ignore
      }
    }

    setItems((prev) => [
      ...prev,
      { tempId: Math.random(), productId: product.id, productName: product.name, price: defaultPrice, qty: 1 },
    ]);
    setProdSearch("");
  };

  const updateItem = (index: number, field: string, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((acc, item) => acc + item.price * item.qty, 0);

  const handleSave = async () => {
    if (!customerName.trim() || items.length === 0) {
      toast({
        title: "Validation Error",
        description: "Customer name and at least one item required.",
        variant: "destructive",
      });
      return;
    }

    // If typed name doesn't exist yet, auto-create the customer
    if (!exactMatch && customerName.trim() && !allCustomers.some(c => c.name.toLowerCase() === customerName.toLowerCase())) {
      const today = new Date().toISOString().split("T")[0];
      try {
        await createCustomerMut.mutateAsync({
          data: { name: customerName.trim(), phone: null, note: null, createdDate: today },
        });
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      } catch (e) {
        // already exists or ignore
      }
    }

    const payload = {
      customerName: customerName.trim(),
      date,
      note: note || null,
      deliveryId: deliveryId === "none" ? null : Number(deliveryId),
      items: items.map((i) => ({ productId: i.productId, qty: Number(i.qty), price: Number(i.price) })),
    };

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: Number(id), data: payload });
        toast({ title: "Invoice updated" });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: "Invoice created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetInvoicesQueryKey() });
      setLocation("/sales");
    } catch (e) {
      toast({ title: "Error saving invoice", variant: "destructive" });
    }
  };

  const filteredSearchProducts = prodSearch
    ? allProducts.filter((p) => p.name.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 8)
    : [];

  if (isEdit && loadingInv) return <div className="p-12 text-center">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/sales")}
          className="rounded-xl bg-card border border-border"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-3xl font-display font-bold text-foreground">{isEdit ? "Edit Sale" : "New Sale"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Details & Search */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-sm border-none ring-1 ring-border rounded-2xl">
            <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Sale Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Customer Combobox */}
              <div className="space-y-2" ref={custRef}>
                <Label>Customer Name *</Label>
                <div className="relative">
                  <Input
                    placeholder="Type or select customer..."
                    value={custQuery}
                    onChange={(e) => {
                      setCustQuery(e.target.value);
                      setCustomerName(e.target.value);
                      setCustOpen(true);
                    }}
                    onFocus={() => setCustOpen(true)}
                    className="h-11 rounded-xl bg-muted/30 pr-9"
                  />
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer"
                    onClick={() => setCustOpen((v) => !v)}
                  />

                  {custOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          className="px-4 py-2.5 hover:bg-muted cursor-pointer text-sm font-medium border-b border-border last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); selectCustomer(c.name); }}
                        >
                          {c.name}
                          {c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}
                        </div>
                      ))}
                      {showAddNew && (
                        <div
                          className="px-4 py-2.5 hover:bg-primary/5 cursor-pointer text-sm font-medium text-primary flex items-center gap-2 border-t border-border"
                          onMouseDown={(e) => { e.preventDefault(); saveAsNewCustomer(); }}
                        >
                          <UserPlus className="w-4 h-4" />
                          Save "{custQuery.trim()}" as new customer
                        </div>
                      )}
                      {filteredCustomers.length === 0 && !showAddNew && (
                        <div className="px-4 py-3 text-sm text-muted-foreground">No customers found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Assign Delivery</Label>
                <Select value={deliveryId} onValueChange={setDeliveryId}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {deliveries.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.deliveryNo} ({d.driver || "No Driver"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Internal Note</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-sm border-none ring-1 ring-border rounded-2xl overflow-visible">
            <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Add Products</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search product to add... (Type to see list)"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                className="pl-10 h-14 text-lg rounded-xl border-accent focus-visible:ring-accent bg-accent/5"
              />

              {prodSearch && filteredSearchProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                  {filteredSearchProducts.map((p) => (
                    <div
                      key={p.id}
                      className="px-4 py-3 hover:bg-muted cursor-pointer flex justify-between items-center border-b border-border last:border-0"
                      onClick={() => handleAddItem(p)}
                    >
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.categoryName || "No category"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${p.basePrice.toFixed(2)}</p>
                        <p
                          className={`text-xs ${
                            p.stockQty <= 5 && p.trackStock ? "text-red-500 font-bold" : "text-muted-foreground"
                          }`}
                        >
                          {p.trackStock ? `${p.stockQty} in stock` : "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 space-y-3">
              {items.length === 0 && (
                <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                  Search and add products above.
                </div>
              )}
              {items.map((item, idx) => (
                <div
                  key={item.tempId}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors"
                >
                  <div className="flex-1 w-full">
                    <p className="font-bold text-foreground mb-2">{item.productName}</p>
                    <div className="flex flex-wrap items-center gap-3 w-full">
                      <div className="flex items-center">
                        <span className="text-muted-foreground text-sm mr-2 w-10">Price:</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItem(idx, "price", Number(e.target.value))}
                            className="w-24 h-9 pl-6 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-muted-foreground text-sm mr-2 w-8">Qty:</span>
                        <div className="flex items-center bg-muted/50 rounded-lg border border-border">
                          <button
                            type="button"
                            onClick={() => updateItem(idx, "qty", Math.max(1, item.qty - 1))}
                            className="w-9 h-9 flex items-center justify-center hover:bg-background rounded-l-lg"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, "qty", Number(e.target.value) || 1)}
                            className="w-12 h-9 text-center bg-transparent border-none focus:ring-0 text-sm font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => updateItem(idx, "qty", item.qty + 1)}
                            className="w-9 h-9 flex items-center justify-center hover:bg-background rounded-r-lg"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border sm:border-0">
                    <div className="text-right sm:mr-4">
                      <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                      <p className="font-display font-bold text-lg text-foreground">
                        ${(item.price * item.qty).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      className="text-muted-foreground hover:text-red-500 hover:bg-red-50 h-10 w-10 rounded-xl shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Col: Summary & Action */}
        <div className="lg:col-span-1">
          <Card className="p-6 shadow-xl border-none bg-gradient-to-b from-primary to-primary/95 text-primary-foreground sticky top-24 rounded-2xl">
            <h3 className="font-display font-bold text-xl mb-6 text-primary-foreground/90 border-b border-white/10 pb-4">
              Summary
            </h3>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm text-primary-foreground/70">
                <span>Items Count</span>
                <span className="font-bold text-white">{items.reduce((acc, i) => acc + i.qty, 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-primary-foreground/70">
                <span>Products</span>
                <span className="font-bold text-white">{items.length}</span>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <span className="text-lg font-medium">Grand Total</span>
                <span className="text-4xl font-display font-bold text-accent">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending || items.length === 0}
              className="w-full h-14 text-lg font-bold bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-black/20"
            >
              {createMut.isPending || updateMut.isPending ? "Saving..." : isEdit ? "Update Sale" : "Complete Sale"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
