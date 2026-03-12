import { useState } from "react";
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useGetCustomerHistory,
  useGetCustomerNames,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListCustomersQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import {
  Search, UserCircle, Calendar, Package, Plus, Pencil, Trash2, Phone, FileText, Users, History,
} from "lucide-react";
import { format } from "date-fns";

type Tab = "list" | "history";

type CustomerForm = { name: string; phone: string; note: string };

const emptyForm: CustomerForm = { name: "", phone: "", note: "" };

export default function Customers() {
  const [tab, setTab] = useState<Tab>("list");
  const qc = useQueryClient();

  // ── Customer List ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading: loadingList } = useListCustomers({ search: search || undefined });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c: { id: number; name: string; phone?: string | null; note?: string | null }) {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone || "", note: c.note || "" });
    setShowForm(true);
  }

  async function saveCustomer() {
    if (!form.name.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    if (editId != null) {
      await updateMutation.mutateAsync({
        id: editId,
        data: { name: form.name.trim(), phone: form.phone || null, note: form.note || null, createdDate: today },
      });
    } else {
      await createMutation.mutateAsync({
        data: { name: form.name.trim(), phone: form.phone || null, note: form.note || null, createdDate: today },
      });
    }
    invalidate();
    setShowForm(false);
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    invalidate();
    setDeleteId(null);
  }

  // ── Purchase History ───────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: history = [], isLoading: loadingHistory } = useGetCustomerHistory({
    customerName: customerSearch || undefined,
    productName: productSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: names = [] } = useGetCustomerNames();

  const grouped = history.reduce((acc, entry) => {
    if (!acc[entry.customerName]) acc[entry.customerName] = [];
    acc[entry.customerName].push(entry);
    return acc;
  }, {} as Record<string, typeof history>);

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Manage customers and view purchase history" />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => setTab("list")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === "list"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" /> Customer List
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === "history"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" /> Purchase History
        </button>
      </div>

      {/* ── LIST TAB ── */}
      {tab === "list" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-muted/50"
              />
            </div>
            <Button onClick={openNew} className="h-11 px-5 rounded-xl gap-2">
              <Plus className="w-4 h-4" /> Add Customer
            </Button>
          </div>

          {/* Add / Edit form */}
          {showForm && (
            <Card className="p-5 border border-primary/30 shadow-md">
              <h3 className="font-semibold text-lg mb-4">{editId ? "Edit Customer" : "New Customer"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name *</label>
                  <Input
                    placeholder="Customer name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-11 rounded-xl"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <Input
                    placeholder="Optional"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1 block">Note</label>
                  <Input
                    placeholder="Optional note"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={saveCustomer}
                  disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
                  className="px-6 rounded-xl"
                >
                  {editId ? "Save Changes" : "Add Customer"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Customer list */}
          {loadingList ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border text-muted-foreground">
              {search ? "No customers match your search." : "No customers yet. Add your first one above."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map((c) => (
                <Card key={c.id} className="p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{c.name}</p>
                        {c.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </p>
                        )}
                        {c.note && (
                          <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="truncate">{c.note}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">
                    Added {c.createdDate}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="space-y-6">
          <Card className="p-4 sm:p-6 shadow-md border-none ring-1 ring-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search customer name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/50"
                  list="customer-names"
                />
                <datalist id="customer-names">
                  {names.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search product..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/50"
                />
              </div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-11 rounded-xl bg-card"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-11 rounded-xl bg-card"
              />
            </div>
            <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />
          </Card>

          <div className="space-y-6 mt-8">
            {loadingHistory ? (
              <div className="text-center py-12 text-muted-foreground">Loading history...</div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border text-muted-foreground">
                No purchase history found for these filters.
              </div>
            ) : (
              Object.entries(grouped).map(([customer, invoices]) => {
                const customerTotal = invoices.reduce((acc, inv) => acc + inv.total, 0);
                return (
                  <Card key={customer} className="overflow-hidden shadow-sm border border-border">
                    <div className="bg-secondary/50 p-4 border-b border-border flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {customer.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="font-bold text-lg text-foreground">{customer}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Value</p>
                        <p className="font-display font-bold text-xl text-primary">${customerTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {invoices.map((inv) => (
                        <div key={inv.invoiceId} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-md">
                                {inv.invoiceNo}
                              </span>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />{" "}
                                {format(new Date(inv.date + "T12:00:00"), "MMM d, yyyy")}
                              </span>
                            </div>
                            <span className="font-bold text-foreground">${inv.total.toFixed(2)}</span>
                          </div>
                          <div className="pl-4 sm:pl-16 space-y-2">
                            {inv.items.map((item) => (
                              <div key={item.id} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground font-mono bg-muted px-1.5 rounded text-xs">
                                    {item.qty}x
                                  </span>
                                  <span className="font-medium">{item.productName}</span>
                                </div>
                                <span className="text-muted-foreground">${item.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId != null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-lg mb-2">Delete Customer?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              This will remove the customer record. Their existing invoices and history will not be affected.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl"
              >
                Delete
              </Button>
              <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1 rounded-xl">
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
