import { useState } from "react";
import { useGetCustomerHistory, useGetCustomerNames } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { Search, UserCircle, Calendar, Package } from "lucide-react";
import { format } from "date-fns";

export default function Customers() {
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: history = [], isLoading } = useGetCustomerHistory({
    customerName: customerSearch || undefined,
    productName: productSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  const { data: names = [] } = useGetCustomerNames();

  // Group by customer for display
  const grouped = history.reduce((acc, entry) => {
    if (!acc[entry.customerName]) acc[entry.customerName] = [];
    acc[entry.customerName].push(entry);
    return acc;
  }, {} as Record<string, typeof history>);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Customer Purchase History" 
        description="Track what your customers are buying"
      />

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
              {names.map(n => <option key={n} value={n} />)}
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
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-card" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-card" />
        </div>
        <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />
      </Card>

      <div className="space-y-6 mt-8">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading history...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">No purchase history found for these filters.</div>
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
                  {invoices.map(inv => (
                    <div key={inv.invoiceId} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-md">{inv.invoiceNo}</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(inv.date), 'MMM d, yyyy')}</span>
                        </div>
                        <span className="font-bold text-foreground">${inv.total.toFixed(2)}</span>
                      </div>
                      <div className="pl-4 sm:pl-16 space-y-2">
                        {inv.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground font-mono bg-muted px-1.5 rounded text-xs">{item.qty}x</span>
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
  );
}
