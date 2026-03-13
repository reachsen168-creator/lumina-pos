import { useRef, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DatabaseBackup, Download, Upload, AlertTriangle, HardDrive,
  ShieldCheck, RefreshCw, Clock, FileJson, Calendar, Server, Camera
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

type BackupFile = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Backup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<File | null>(null);

  const { data: backupList = [], isLoading: listLoading, refetch: refetchList } = useQuery<BackupFile[]>({
    queryKey: ["backup-list"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/backup/list`);
      if (!r.ok) throw new Error("Failed to fetch backup list");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: snapshots = [], isLoading: snapsLoading, refetch: refetchSnaps } = useQuery<BackupFile[]>({
    queryKey: ["backup-snapshots"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/backup/snapshots`);
      if (!r.ok) throw new Error("Failed to fetch snapshots");
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // ── Create manual backup ──────────────────────────────────────────────────
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const r = await fetch(`${BASE()}/api/backup/create`, { method: "POST" });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error || "Backup failed");

      // Trigger browser download
      const dlUrl = `${BASE()}/api/backup/download/${encodeURIComponent(body.filename)}`;
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = body.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast({ title: "Backup created", description: body.filename });
      refetchList();
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Download a stored backup ──────────────────────────────────────────────
  const handleDownload = (filename: string) => {
    const url = `${BASE()}/api/backup/download/${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── Restore flow ──────────────────────────────────────────────────────────
  const handleRestoreClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmRestoreFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreFile) return;
    setIsRestoring(true);
    try {
      const text = await confirmRestoreFile.text();
      let json: any;
      try { json = JSON.parse(text); } catch {
        throw new Error("Invalid JSON file — not a valid Lumina POS backup.");
      }
      if (!json.categories && !json.products && !json.invoices) {
        throw new Error("File does not appear to be a valid Lumina POS backup.");
      }

      const r = await fetch(`${BASE()}/api/backup/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const body = await r.json();
      if (!r.ok || !body.success) throw new Error(body.message || "Restore failed");

      toast({ title: "Restore successful", description: "System will reload now." });
      setConfirmRestoreFile(null);
      queryClient.invalidateQueries();
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Backup"
        description="Create backups, restore data, and manage auto-saved backup history"
      />

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CREATE BACKUP */}
        <Card className="shadow-md border-none ring-1 ring-border overflow-hidden">
          <div className="h-1.5 bg-accent w-full" />
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 text-accent">
              <HardDrive className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-display">Create Backup</CardTitle>
            <CardDescription className="text-sm mt-1">
              Export all data — products, customers, invoices, transfers, damage records, and audit logs — into a JSON file that downloads automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-3.5 bg-muted/40 rounded-xl mb-5 flex items-start gap-2.5">
              <ShieldCheck className="w-4.5 h-4.5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Safe operation.</span> Creating a backup does not affect your live data.
              </p>
            </div>
            <Button
              className="w-full h-12 text-base rounded-xl gap-2"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                : <><Download className="w-4 h-4" /> Create Backup</>}
            </Button>
          </CardContent>
        </Card>

        {/* RESTORE */}
        <Card className="shadow-md border-none ring-1 ring-red-200 bg-red-50/30 overflow-hidden">
          <div className="h-1.5 bg-red-500 w-full" />
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-3 text-red-600">
              <Upload className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-display text-red-950 dark:text-red-300">Restore Backup</CardTitle>
            <CardDescription className="text-sm mt-1 text-red-900/70 dark:text-red-400">
              Upload a previously created JSON backup file to restore the entire system to that state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-3.5 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl mb-5 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="text-sm text-red-800 dark:text-red-300">
                <span className="font-bold block mb-0.5">DANGER ZONE</span>
                Restoring will <strong>permanently erase</strong> all current data. Create a fresh backup first.
              </div>
            </div>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <Button
              variant="destructive"
              className="w-full h-12 text-base rounded-xl gap-2 bg-red-600 hover:bg-red-700"
              onClick={handleRestoreClick}
            >
              <DatabaseBackup className="w-4 h-4" /> Restore Backup
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Backup Info */}
      <Card className="shadow-md border-none ring-1 ring-border">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Auto-Backup is Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The system automatically creates a backup every 24 hours. Up to 7 backups are stored on the server.
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Running
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="shadow-md border-none ring-1 ring-border">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-muted-foreground" />
              Backup History
            </CardTitle>
            <CardDescription className="text-sm mt-1">Last {Math.min(backupList.length, 7)} server-stored backups</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg gap-1.5 text-xs" onClick={() => refetchList()}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Desktop table */}
          <div className="hidden sm:block border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Date & Time</th>
                  <th className="px-5 py-3.5 font-semibold">Filename</th>
                  <th className="px-5 py-3.5 font-semibold">Size</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listLoading ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Loading...</td></tr>
                ) : backupList.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-muted-foreground">
                    <FileJson className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No backups stored yet</p>
                    <p className="text-xs mt-1">Create your first backup above or wait for auto-backup (runs every 24h)</p>
                  </td></tr>
                ) : (
                  backupList.map((b) => (
                    <tr key={b.filename} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {format(new Date(b.createdAt), "d MMM yyyy HH:mm")}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono truncate max-w-[260px]">
                        {b.filename}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">
                        {formatBytes(b.sizeBytes)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs gap-1.5 border-accent/30 text-accent hover:bg-accent/10"
                          onClick={() => handleDownload(b.filename)}
                        >
                          <Download className="w-3 h-3" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {listLoading ? (
              <p className="text-center text-muted-foreground py-10 text-sm">Loading...</p>
            ) : backupList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileJson className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No backups stored yet</p>
              </div>
            ) : (
              backupList.map((b) => (
                <div key={b.filename} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {format(new Date(b.createdAt), "d MMM yyyy HH:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatBytes(b.sizeBytes)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono break-all">{b.filename}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs gap-1.5 border-accent/30 text-accent hover:bg-accent/10"
                    onClick={() => handleDownload(b.filename)}
                  >
                    <Download className="w-3 h-3" /> Download
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto Snapshot History */}
      <Card className="shadow-md border-none ring-1 ring-border">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              Auto Snapshots
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Created every 5 minutes · Last {Math.min(snapshots.length, 10)} saved
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg gap-1.5 text-xs" onClick={() => refetchSnaps()}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="hidden sm:block border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Date & Time</th>
                  <th className="px-5 py-3.5 font-semibold">Filename</th>
                  <th className="px-5 py-3.5 font-semibold">Size</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapsLoading ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Loading...</td></tr>
                ) : snapshots.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-muted-foreground">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No snapshots yet</p>
                    <p className="text-xs mt-1">First snapshot runs 10 seconds after server starts, then every 5 minutes</p>
                  </td></tr>
                ) : (
                  snapshots.map((b) => (
                    <tr key={b.filename} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {format(new Date(b.createdAt), "d MMM yyyy HH:mm")}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono truncate max-w-[260px]">{b.filename}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatBytes(b.sizeBytes)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={() => {
                            const url = `${BASE()}/api/backup/snapshot-download/${encodeURIComponent(b.filename)}`;
                            const a = document.createElement("a");
                            a.href = url; a.download = b.filename;
                            document.body.appendChild(a); a.click(); a.remove();
                          }}
                        >
                          <Download className="w-3 h-3" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-3 mt-0">
            {snapsLoading ? (
              <p className="text-center text-muted-foreground py-10 text-sm">Loading...</p>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Camera className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No snapshots yet</p>
              </div>
            ) : (
              snapshots.map((b) => (
                <div key={b.filename} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {format(new Date(b.createdAt), "d MMM yyyy HH:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatBytes(b.sizeBytes)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono break-all">{b.filename}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      const url = `${BASE()}/api/backup/snapshot-download/${encodeURIComponent(b.filename)}`;
                      const a = document.createElement("a");
                      a.href = url; a.download = b.filename;
                      document.body.appendChild(a); a.click(); a.remove();
                    }}
                  >
                    <Download className="w-3 h-3" /> Download
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!confirmRestoreFile} onOpenChange={(open) => !open && setConfirmRestoreFile(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Restore
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-foreground">
              Restoring this backup will <strong>overwrite all current data</strong>. This cannot be undone.
            </p>
            {confirmRestoreFile && (
              <div className="bg-muted rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Selected file:</p>
                <p className="text-sm font-semibold font-mono break-all">{confirmRestoreFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(confirmRestoreFile.size)}</p>
              </div>
            )}
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">
                All products, customers, invoices, and history will be replaced with the data from this file.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmRestoreFile(null)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
              onClick={handleConfirmRestore}
              disabled={isRestoring}
            >
              {isRestoring
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Restoring...</>
                : <><DatabaseBackup className="w-4 h-4" /> Yes, Restore Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
