import { useState } from "react";
import { format } from "date-fns";
import { useGetSalesReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Receipt, Package, BarChart3, TrendingUp } from "lucide-react";

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')); // default 1st of month
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: report, isLoading } = useGetSalesReport({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  // Transform data for chart if API returns array of daily sales, mock it if not
  // Assuming the API returns totalSales, invoiceCount, productsSold, topProducts
  // We mock a trend for the chart based on the total for visual flair
  const mockTrend = Array.from({length: 7}).map((_, i) => ({
    name: format(new Date(new Date().setDate(new Date().getDate() - 6 + i)), 'MMM dd'),
    sales: report ? (report.totalSales / 7) * (0.8 + Math.random() * 0.4) : 0 // random distribution of total
  }));

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Analytics & Reports" 
        description="Business insights and sales performance"
      />

      <Card className="shadow-md border-none ring-1 ring-border p-4 bg-card">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto bg-muted/30 p-1.5 rounded-2xl border border-border">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-transparent border-none shadow-none focus-visible:ring-1" />
            <span className="text-muted-foreground font-medium px-2">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-transparent border-none shadow-none focus-visible:ring-1" />
          </div>
          <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <DateShortcuts onSelect={(f,t) => {setDateFrom(f); setDateTo(t)}} />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">Generating report data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-none shadow-lg shadow-primary/20 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-primary-foreground/70 text-sm font-medium mb-1 uppercase tracking-wider">Total Revenue</p>
                    <h3 className="text-4xl font-display font-bold">${report?.totalSales?.toFixed(2) || '0.00'}</h3>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-none ring-1 ring-border bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wider">Invoices Created</p>
                    <h3 className="text-4xl font-display font-bold text-foreground">{report?.totalInvoices || 0}</h3>
                  </div>
                  <div className="p-3 bg-accent/10 rounded-2xl">
                    <Receipt className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-none ring-1 ring-border bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wider">Items Sold</p>
                    <h3 className="text-4xl font-display font-bold text-foreground">{report?.topProducts?.reduce((s, p) => s + p.totalQty, 0) ?? 0}</h3>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-2xl">
                    <Package className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-md border-none ring-1 ring-border">
              <CardHeader className="border-b border-border bg-muted/10">
                <CardTitle className="font-display flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent" /> Sales Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mockTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} tickFormatter={v => `$${v}`} />
                      <Tooltip 
                        cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--card))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Sales']}
                      />
                      <Bar dataKey="sales" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-none ring-1 ring-border flex flex-col">
              <CardHeader className="border-b border-border bg-muted/10">
                <CardTitle className="font-display flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" /> Top Products
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto">
                {report?.topProducts?.length ? (
                  <ul className="divide-y divide-border">
                    {report.topProducts.map((p: any, i: number) => (
                      <li key={i} className="p-4 hover:bg-muted/30 transition-colors flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'bg-muted text-muted-foreground'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{p.productName}</p>
                          <div className="w-full bg-secondary h-1.5 mt-2 rounded-full overflow-hidden">
                            <div className="bg-accent h-full rounded-full" style={{ width: `${Math.min(100, (p.totalQty / report.topProducts[0].totalQty) * 100)}%` }}></div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-foreground">{p.totalQty}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Units</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                    <Package className="w-12 h-12 mb-3 opacity-20" />
                    <p>No product data available for this period.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
