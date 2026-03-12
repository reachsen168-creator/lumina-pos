import { useState } from "react";
import { format } from "date-fns";
import { useGetDashboard } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DollarSign, Receipt, Package, AlertTriangle, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: dashboard, isLoading } = useGetDashboard({ date });

  if (isLoading) {
    return <div className="h-96 flex items-center justify-center">Loading dashboard...</div>;
  }

  // Mock chart data since the API only returns a single day's summary
  // In a real app, we'd fetch a trend endpoint
  const mockTrend = [
    { name: 'Mon', sales: 4000 },
    { name: 'Tue', sales: 3000 },
    { name: 'Wed', sales: 5000 },
    { name: 'Thu', sales: 2780 },
    { name: 'Fri', sales: 6890 },
    { name: 'Sat', sales: 8390 },
    { name: 'Sun', sales: 7490 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your business performance"
        action={
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-auto bg-card"
          />
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-none shadow-lg shadow-primary/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/70 text-sm font-medium mb-1">Total Sales</p>
                <h3 className="text-3xl font-display font-bold">${dashboard?.totalSales?.toFixed(2) || '0.00'}</h3>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-green-400 font-medium">
              <TrendingUp className="w-4 h-4 mr-1" /> +12% from yesterday
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Invoices Today</p>
                <h3 className="text-3xl font-display font-bold text-foreground">{dashboard?.invoiceCount || 0}</h3>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl">
                <Receipt className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Products Sold</p>
                <h3 className="text-3xl font-display font-bold text-foreground">{dashboard?.productsSold || 0}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Package className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-red-600/80 text-sm font-medium mb-1">Low Stock Alerts</p>
                <h3 className="text-3xl font-display font-bold text-red-700">{dashboard?.lowStockProducts?.length || 0}</h3>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--accent))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Top Products Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard?.topProducts?.length ? (
                dashboard.topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground group-hover:text-accent transition-colors">{p.productName}</p>
                        <p className="text-xs text-muted-foreground">{p.totalQty} units sold</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">No products sold yet today.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Table */}
      {dashboard?.lowStockProducts && dashboard.lowStockProducts.length > 0 && (
        <Card className="border-red-200 shadow-md overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Items Requiring Restock</h3>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-card border-b border-border uppercase">
                <tr>
                  <th className="px-6 py-3 font-semibold">Product Name</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold text-right">Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.lowStockProducts.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{p.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{p.categoryName || 'Uncategorized'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold text-xs">
                        {p.stockQty} left
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
