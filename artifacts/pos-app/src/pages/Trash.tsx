import { useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, RotateCcw, AlertTriangle, Package, Users, Truck, ReceiptText,
  User, Clock, FilterX
} from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

type TrashRecord = {
  type: "product" | "customer" | "delivery" | "invoice";
  id: number;
  name: string;
  deletedAt: string | null;
  deletedBy: string;
  meta: Record<string, any>;
};

const TYPE_CONFIG = {
  product:  { label: "Product",  color: "bg-blue-100 text-blue-800",   icon: Package },
  customer: { label: "Customer", color: "bg-purple-100 text-purple-800", icon: Users },
  delivery: { label: "Delivery", color: "bg-orange-100 text-orange-800", icon: Truck },
  invoice:  { label: "Invoice",  color: "bg-green-100 text-green-800",  icon: ReceiptText },
};

export default function Trash() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TrashRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: records = [], isLoading, refetch } = useQuery<TrashRecord[]>({
    queryKey: ["trash"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/trash`);
      if (!r.ok) throw new Error("Failed to fetch trash");
      return r.json();
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["trash"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    // Invalidate via API client keys too
    queryClient.invalidateQueries();
  };

  const handleRestore = async (record: TrashRecord) => {
    const key = `${record.type}-${record.id}`;
    setRestoringKey(key);
    try {
      const r = await fetch(`${BASE()}/api/trash/${record.type}/${record.id}/restore`, { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Restore failed");
      toast({ title: `Restored: ${record.name}` });
      invalidateAll();
    } catch (e: any) {
      toast({ title: e.message || "Restore failed", variant: "destructive" });
    } finally {
      setRestoringKey(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const r = await fetch(`${BASE()}/api/trash/${confirmDelete.type}/${confirmDelete.id}`, { method: "DELETE" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Delete failed");
      toast({ title: `Permanently deleted: ${confirmDelete.name}` });
      setConfirmDelete(null);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e.message || "Permanent delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = filterType === "all" ? records : records.filter(r => r.type === filterType);

  const formatDt = (dt: string | null) => {
    if (!dt) return "—";
    try { return format(new Date(dt), "MMM d, yyyy HH:mm"); } catch { return dt; }
  };

  const TypeBadge = ({ type }: { type: string }) => {
    const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
    if (!cfg) return <Badge variant="secondary">{type}</Badge>;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />{cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash / Restore"
        description="Recover or permanently delete recently deleted records"
      />

      <Card className="shadow-md border-none ring-1 ring-border p-4 sm:p-6 space-y-4">
        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl bg-card">
              <FilterX className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="delivery">Deliveries</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
            </SelectContent>
          </Select>

          {filtered.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} in trash
            </span>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block border border-border rounded-2xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                <tr>
                  <th className="px-5 py-4 font-semibold">Type</th>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Date Deleted</th>
                  <th className="px-5 py-4 font-semibold">Deleted By</th>
                  <th className="px-5 py-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">Loading trash...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-20 text-center bg-muted/10">
                    <Trash2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="text-muted-foreground font-medium">Trash is empty</p>
                    <p className="text-sm text-muted-foreground mt-1">Deleted records will appear here</p>
                  </td></tr>
                ) : (
                  filtered.map((record) => {
                    const key = `${record.type}-${record.id}`;
                    const isRestoring = restoringKey === key;
                    return (
                      <tr key={key} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5"><TypeBadge type={record.type} /></td>
                        <td className="px-5 py-3.5 font-medium text-foreground">{record.name}</td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 opacity-60" />
                            {formatDt(record.deletedAt)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 opacity-60" />
                            {record.deletedBy}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg text-xs gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                              disabled={isRestoring}
                              onClick={() => handleRestore(record)}
                            >
                              <RotateCcw className={`w-3 h-3 ${isRestoring ? "animate-spin" : ""}`} />
                              {isRestoring ? "Restoring..." : "Restore"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => setConfirmDelete(record)}
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading trash...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Trash is empty</p>
              <p className="text-sm mt-1">Deleted records will appear here</p>
            </div>
          ) : (
            filtered.map((record) => {
              const key = `${record.type}-${record.id}`;
              const isRestoring = restoringKey === key;
              return (
                <div key={key} className="border border-border rounded-xl p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <TypeBadge type={record.type} />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatDt(record.deletedAt)}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{record.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3" /> {record.deletedBy}
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 rounded-lg text-xs gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                      disabled={isRestoring}
                      onClick={() => handleRestore(record)}
                    >
                      <RotateCcw className={`w-3 h-3 ${isRestoring ? "animate-spin" : ""}`} />
                      {isRestoring ? "Restoring..." : "Restore"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 rounded-lg text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDelete(record)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete Forever
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Permanent Delete
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <p className="text-sm text-foreground">
              Are you sure you want to permanently delete this record?
            </p>
            {confirmDelete && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <TypeBadge type={confirmDelete.type} />
                </div>
                <p className="font-semibold text-foreground">{confirmDelete.name}</p>
              </div>
            )}
            <p className="text-xs text-red-600 font-medium">
              This action cannot be undone. The record will be permanently removed from the system.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 sm:flex-row flex-col-reverse">
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={handlePermanentDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              {isDeleting ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
