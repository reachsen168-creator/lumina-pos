import { useState } from "react";
import { format } from "date-fns";
import { useGetHistoryLogs } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Activity, Database, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HistoryLogs() {
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: logs = [], isLoading } = useGetHistoryLogs({
    action: action !== "all" ? action : undefined,
    entity: entity !== "all" ? entity : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  const getActionBadge = (act: string) => {
    switch(act) {
      case 'CREATE': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none font-bold">CREATE</Badge>;
      case 'UPDATE': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none font-bold">UPDATE</Badge>;
      case 'DELETE': return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none font-bold">DELETE</Badge>;
      case 'TRANSFER': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-none font-bold">TRANSFER</Badge>;
      default: return <Badge variant="secondary">{act}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Audit Logs" 
        description="System history and tracking of user actions"
      />

      <Card className="shadow-md border-none ring-1 ring-border p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-full lg:w-48 h-11 rounded-xl bg-card">
              <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="TRANSFER">TRANSFER</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-full lg:w-48 h-11 rounded-xl bg-card">
              <Database className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="damaged_item">Damaged Item</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-1 items-center gap-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-card w-full" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-card w-full" />
          </div>
        </div>

        <DateShortcuts onSelect={(f,t) => {setDateFrom(f); setDateTo(t)}} />

        <div className="mt-6 border border-border rounded-2xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">Entity</th>
                  <th className="px-6 py-4 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-16 text-center bg-muted/20">
                    <History className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="text-muted-foreground">No logs found matching criteria.</p>
                  </td></tr>
                ) : (
                  logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 mr-2 opacity-70" />
                          {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider">
                          {log.entity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-foreground w-full">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
