import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getQueue, clearQueue, replayQueue, subscribe, getState } from "@/lib/autoSave";
import { RefreshCw, Trash2, WifiOff } from "lucide-react";

export function RecoveryDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState(getQueue());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const q = getQueue();
    if (q.length > 0) {
      setQueue(q);
      setOpen(true);
    }
    const unsub = subscribe(() => {
      setQueue(getQueue());
    });
    return unsub;
  }, []);

  if (queue.length === 0 && !open) return null;

  const handleRestore = async () => {
    setIsSyncing(true);
    try {
      if (!navigator.onLine) {
        toast({
          title: "Still offline",
          description: "Changes will sync automatically when connection returns.",
          variant: "destructive",
        });
        setOpen(false);
        return;
      }
      const { replayed, failed } = await replayQueue();
      if (failed === 0) {
        toast({ title: `Synced ${replayed} pending change${replayed !== 1 ? "s" : ""}` });
        clearQueue();
        setOpen(false);
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast({
          title: `Synced ${replayed}, failed ${failed}`,
          description: "Some changes could not be applied. They have been discarded.",
          variant: "destructive",
        });
        clearQueue();
        setOpen(false);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDiscard = () => {
    clearQueue();
    setQueue([]);
    setOpen(false);
    toast({ title: "Pending changes discarded" });
  };

  const oldest = queue.reduce((min, q) => (q.timestamp < min ? q.timestamp : min), queue[0]?.timestamp ?? 0);
  const sessionTime = oldest ? format(new Date(oldest), "d MMM yyyy HH:mm") : "—";

  return (
    <Dialog open={open} onOpenChange={(v) => !isSyncing && setOpen(v)}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <WifiOff className="w-5 h-5" />
            Unsynced Changes Detected
          </DialogTitle>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <p className="text-sm text-foreground">
            The app closed while offline. There {queue.length === 1 ? "is" : "are"}{" "}
            <span className="font-semibold">{queue.length} pending change{queue.length !== 1 ? "s" : ""}</span>{" "}
            from your previous session that have not been saved to the database.
          </p>

          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 space-y-1 text-sm">
            <p className="text-muted-foreground text-xs">Session from</p>
            <p className="font-semibold text-foreground">{sessionTime}</p>
            <p className="text-muted-foreground text-xs">{queue.length} operation{queue.length !== 1 ? "s" : ""} queued</p>
          </div>

          <p className="text-xs text-muted-foreground">
            Choose <strong>Sync Now</strong> to apply these changes, or <strong>Discard</strong> to remove them permanently.
          </p>
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleDiscard} disabled={isSyncing}>
            <Trash2 className="w-4 h-4" />
            Discard
          </Button>
          <Button
            className="rounded-xl gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleRestore}
            disabled={isSyncing}
          >
            {isSyncing
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing...</>
              : <><RefreshCw className="w-4 h-4" /> Sync Now</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
