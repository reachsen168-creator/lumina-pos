import { useState } from "react";
import { format } from "date-fns";
import { useGetHistoryLogs } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Activity, Database, Clock, User } from "lucide-react";
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
    switch (act) {
      case "CREATE": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none font-bold">CREATE</Badge>;
      case "UPDATE": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none font-bold">UPDATE</Badge>;
      case "DELETE": return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none font-bold">DELETE</Badge>;
      case "TRANSFER": return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-none font-bold">TRANSFER</Badge>;
      default: return <Badge variant="secondary">{act}</Badge>;
    }
  };

  const formatEntity = (e: string) =>
    e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return "N/A";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "N/A" : format(d, "MMM d, yyyy HH:mm:ss");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="System history and tracking of all user actions"
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
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="damaged_item">Damaged Item</SelectItem>
              <SelectItem value="damage_record">Damage Record</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-1 items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-11 rounded-xl bg-card w-full"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-11 rounded-xl bg-card w-full"
            />
          </div>
        </div>

        <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />

        {/* Desktop table */}
        <div className="hidden md:block mt-6 border border-border rounded-2xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                <tr>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">Date & Time</th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">User</th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">Action</th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">Entity</th>
                  <th className="px-5 py-4 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      Loading logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center bg-muted/20">
                      <History className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                      <p className="text-muted-foreground">No logs found matching criteria.</p>
                    </td>
                  </tr>
                ) : (
                  (logs as any[]).map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Clock className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <User className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          {log.user || "Admin"}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider">
                          {formatEntity(log.entity)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-foreground text-sm">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3 mt-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading logs...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No logs found matching criteria.</p>
            </div>
          ) : (
            (logs as any[]).map((log) => (
              <div key={log.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  {getActionBadge(log.action)}
                  <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider">
                    {formatEntity(log.entity)}
                  </span>
                </div>
                <p className="text-sm text-foreground">{log.details}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {log.user || "Admin"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {logs.length > 0 && (
          <p className="text-xs text-muted-foreground text-right pt-1">
            Showing {logs.length} log{logs.length !== 1 ? "s" : ""} — newest first
          </p>
        )}
      </Card>
    </div>
  );
}
