import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoice, useCreateInvoice, useUpdateInvoice, useGetProducts, useGetDeliveries,
  useGetCategories,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Minus, Trash2, Search, UserPlus, ChevronDown, AlertTriangle, Wrench, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const API_BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface RepairedItem { id: number; itemName: string; productId: number | null; availableQty: number }

async function fetchAvailableRepaired(): Promise<RepairedItem[]> {
  const r = await fetch(`${API_BASE()}/api/damage-records/available-repaired`);
  if (!r.ok) return [];
  return r.json();
}

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
  const { data: categories = [] } = useGetCategories();

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
  const [prodSearch,   setProdSearch]   = useState("");
  const [selectedCat,  setSelectedCat]  = useState<number | null>(null);
  const [prodFocused,  setProdFocused]  = useState(false);

  // Recent products (stored in localStorage, max 10 ids)
  const RECENT_KEY = "lumina_recent_products";
  const getRecentIds = (): number[] => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
  };
  const pushRecentId = (pid: number) => {
    const ids = [pid, ...getRecentIds().filter(x => x !== pid)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  };

  // Damage dialog state
  const [damageItem,    setDamageItem]    = useState<any | null>(null);
  const [damageQty,     setDamageQty]     = useState(1);
  const [damageReason,  setDamageReason]  = useState("");
  const [damageLoading, setDamageLoading] = useState(false);

  // Repaired items available for sale
  const { data: repairedItems = [] } = useQuery<RepairedItem[]>({
    queryKey: ["available-repaired"],
    queryFn:  fetchAvailableRepaired,
  });

  const createMut = useCreateInvoice();
  const updateMut = useUpdateInvoice();
  const createCustomerMut = useCreateCustomer();

  const isFullyDamaged = isEdit && (existingInvoice as any)?.status === "Fully Damaged";

  useEffect(() => {
    if (isEdit && existingInvoice) {
      setCustomerName(existingInvoice.customerName);
      setCustQuery(existingInvoice.customerName);
      setDate(existingInvoice.date.split("T")[0]);
      setNote(existingInvoice.note || "");
      setDeliveryId(existingInvoice.deliveryId ? existingInvoice.deliveryId.toString() : "none");
      setItems(
        existingInvoice.items.map((i) => ({
          tempId:      Math.random(),
          id:          i.id,          // DB id - needed for damage recording
          productId:   i.productId,
          productName: i.productName,
          price:       parseFloat(String(i.price)) || 0,
          qty:         parseFloat(String(i.qty)) || 1,
        }))
      );
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

    // Track as recently used
    if (product.id > 0) pushRecentId(product.id);

    setItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          tempId: Math.random(),
          productId: product.id,
          productName: product.name,
          price: parseFloat(String(defaultPrice)) || 0,
          qty: 1,
        },
      ];
    });
    setProdSearch("");
  };

  const updateItem = (index: number, field: "price" | "qty", raw: string | number) => {
    const value = parseFloat(String(raw));
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: isNaN(value) ? (field === "qty" ? 1 : 0) : value,
    };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const itemSubtotal = (price: number, qty: number) => {
    const p = parseFloat(String(price)) || 0;
    const q = parseFloat(String(qty)) || 0;
    return p * q;
  };

  const grandTotal = items.reduce((acc, item) => acc + itemSubtotal(item.price, item.qty), 0);

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

  const searchLower = prodSearch.toLowerCase().trim();

  const filteredSearchProducts = (() => {
    let base = selectedCat !== null
      ? allProducts.filter(p => (p as any).categoryId === selectedCat)
      : allProducts;
    if (!searchLower) return selectedCat !== null ? base.slice(0, 30) : [];
    return base.filter(p => p.name.toLowerCase().includes(searchLower)).slice(0, 10);
  })();

  const recentProducts = (() => {
    if (searchLower || selectedCat !== null) return [];
    return getRecentIds()
      .map(rid => allProducts.find(p => p.id === rid))
      .filter(Boolean) as typeof allProducts;
  })();

  const filteredRepairedItems = searchLower
    ? repairedItems.filter(r => r.itemName.toLowerCase().includes(searchLower))
    : [];

  const showDropdown = searchLower.length > 0
    || selectedCat !== null
    || (prodFocused && recentProducts.length > 0);

  // ── Damage item handler ──────────────────────────────────────────────────
  const handleDamageSubmit = async () => {
    if (!damageItem || !id) return;
    if (damageQty <= 0 || damageQty > damageItem.qty) {
      toast({ title: `Damage qty must be between 1 and ${damageItem.qty}`, variant: "destructive" });
      return;
    }
    setDamageLoading(true);
    try {
      const r = await fetch(`${API_BASE()}/api/invoices/${id}/damage-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceItemId: damageItem.id, damageQty, damageReason }),
      });
      if (!r.ok) {
        const e = await r.json();
        toast({ title: e.error || "Failed to record damage", variant: "destructive" });
        return;
      }
      const updated = await r.json();
      // Refresh the items from the updated invoice
      setItems(
        updated.items.map((i: any) => ({
          tempId:      Math.random(),
          id:          i.id,
          productId:   i.productId,
          productName: i.productName,
          price:       parseFloat(String(i.price)) || 0,
          qty:         parseFloat(String(i.qty)) || 1,
        }))
      );
      queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(Number(id)) });
      queryClient.invalidateQueries({ queryKey: ["damage-records"] });
      queryClient.invalidateQueries({ queryKey: ["available-repaired"] });
      toast({ title: `${damageQty} ${damageItem.productName} marked as damaged` });
      setDamageItem(null);
      setDamageQty(1);
      setDamageReason("");
    } finally { setDamageLoading(false); }
  };

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

      {isFullyDamaged && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 text-sm">Fully Damaged Invoice</p>
            <p className="text-xs text-red-600 mt-0.5">
              All items on this invoice have been marked as damaged. The invoice total is $0.00 and it is kept for record purposes only. This invoice is excluded from all sales reports.
            </p>
          </div>
        </div>
      )}

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

            {/* Category filter chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSelectedCat(null)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${selectedCat === null ? "bg-accent text-white border-accent" : "bg-muted text-muted-foreground border-border hover:border-accent hover:text-accent"}`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${selectedCat === c.id ? "bg-accent text-white border-accent" : "bg-muted text-muted-foreground border-border hover:border-accent hover:text-accent"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search product by name..."
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                onFocus={() => setProdFocused(true)}
                onBlur={() => setTimeout(() => setProdFocused(false), 150)}
                className="pl-10 h-14 text-lg rounded-xl border-accent focus-visible:ring-accent bg-accent/5"
              />

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden max-h-72 overflow-y-auto">

                  {/* Recent Products */}
                  {recentProducts.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 border-b border-border uppercase tracking-wide">
                        Recently Used
                      </div>
                      {recentProducts.map((p) => {
                        const pImg = (p as any).image as string | null;
                        return (
                          <div
                            key={`recent-${p.id}`}
                            className="px-4 py-3 hover:bg-muted flex justify-between items-center border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => handleAddItem(p)}>
                              {pImg
                                ? <img src={pImg} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-border shrink-0" />
                                : <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border shrink-0" />}
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{(p as any).categoryName || "No category"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <div className="text-right">
                                <p className="font-medium text-sm">${Number(p.basePrice).toFixed(2)}</p>
                                <p className={`text-xs ${p.stockQty <= 5 && p.trackStock ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                                  {p.trackStock ? `${p.stockQty} in stock` : "-"}
                                </p>
                              </div>
                              <button type="button" onClick={() => handleAddItem(p)} className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent/80 shrink-0">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Search / category results */}
                  {filteredSearchProducts.length > 0 && (
                    <>
                      {recentProducts.length > 0 && (
                        <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 border-b border-border uppercase tracking-wide">
                          {selectedCat !== null ? categories.find(c => c.id === selectedCat)?.name ?? "Category" : "Results"}
                        </div>
                      )}
                      {filteredSearchProducts.map((p) => {
                        const pImg = (p as any).image as string | null;
                        return (
                          <div
                            key={p.id}
                            className="px-4 py-3 hover:bg-muted flex justify-between items-center border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => handleAddItem(p)}>
                              {pImg
                                ? <img src={pImg} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-border shrink-0" />
                                : <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border shrink-0" />}
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{(p as any).categoryName || "No category"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <div className="text-right">
                                <p className="font-medium text-sm">${Number(p.basePrice).toFixed(2)}</p>
                                <p className={`text-xs ${p.stockQty <= 5 && p.trackStock ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                                  {p.trackStock ? `${p.stockQty} in stock` : "-"}
                                </p>
                              </div>
                              <button type="button" onClick={() => handleAddItem(p)} className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent/80 shrink-0">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* No results */}
                  {filteredSearchProducts.length === 0 && recentProducts.length === 0 && filteredRepairedItems.length === 0 && (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">No products found.</div>
                  )}

                  {/* Repaired Items */}
                  {filteredRepairedItems.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 border-b border-border uppercase tracking-wide">
                        Repaired Items
                      </div>
                      {filteredRepairedItems.map((r) => (
                        <div
                          key={`repaired-${r.id}`}
                          className="px-4 py-3 hover:bg-muted flex justify-between items-center border-b border-border last:border-0"
                        >
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleAddItem({ id: r.productId ?? -r.id, name: `${r.itemName} (Repaired)`, basePrice: 0, trackStock: false, stockQty: r.availableQty, categoryName: "Repaired", damageRecordId: r.id, isRepaired: true } as any)}
                          >
                            <p className="font-semibold text-green-700 truncate">{r.itemName} <span className="text-xs font-normal">(Repaired)</span></p>
                            <p className="text-xs text-muted-foreground">{r.availableQty} available</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddItem({ id: r.productId ?? -r.id, name: `${r.itemName} (Repaired)`, basePrice: 0, trackStock: false, stockQty: r.availableQty, categoryName: "Repaired", damageRecordId: r.id, isRepaired: true } as any)}
                            className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 shrink-0 ml-3"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
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
                            onChange={(e) => updateItem(idx, "price", e.target.value)}
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
                            onChange={(e) => updateItem(idx, "qty", e.target.value)}
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
                  <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border sm:border-0 gap-2">
                    <div className="text-right sm:mr-4">
                      <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                      <p className="font-display font-bold text-lg text-foreground">
                        ${itemSubtotal(item.price, item.qty).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Damage button — only in edit mode when item has a DB id */}
                      {isEdit && item.id && item.qty > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setDamageItem(item); setDamageQty(1); setDamageReason(""); }}
                          className="gap-1 text-xs h-9 px-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Damage
                        </Button>
                      )}
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
              disabled={createMut.isPending || updateMut.isPending || items.length === 0 || isFullyDamaged}
              className="w-full h-14 text-lg font-bold bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-black/20"
            >
              {createMut.isPending || updateMut.isPending ? "Saving..." : isEdit ? "Update Sale" : "Complete Sale"}
            </Button>
          </Card>
        </div>
      </div>

      {/* ── Damage Item Dialog ── */}
      {damageItem && (
        <Dialog open onOpenChange={() => { setDamageItem(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Record Damage
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">Item:</span> <strong>{damageItem.productName}</strong></div>
                <div><span className="text-muted-foreground">Invoice Qty:</span> <strong>{damageItem.qty}</strong></div>
              </div>
              <div className="space-y-1.5">
                <Label>Damage Quantity <span className="text-muted-foreground text-xs">(max {damageItem.qty})</span></Label>
                <Input
                  type="number" min={1} max={damageItem.qty}
                  value={damageQty}
                  onChange={e => setDamageQty(Math.min(damageItem.qty, Math.max(1, Number(e.target.value))))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Damage Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  placeholder="e.g. Broken during delivery…"
                  value={damageReason}
                  onChange={e => setDamageReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground bg-orange-50 border border-orange-200 rounded-lg p-2">
                This will reduce the invoice qty by <strong>{damageQty}</strong> and create a damage record.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDamageItem(null)}>Cancel</Button>
              <Button
                onClick={handleDamageSubmit}
                disabled={damageLoading || damageQty <= 0 || damageQty > damageItem.qty}
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {damageLoading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                  : <><AlertTriangle className="w-4 h-4" /> Confirm Damage</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
