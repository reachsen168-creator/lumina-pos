import { useState, useEffect } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const KEY_GROUP = "lumina_telegram_group";

export default function Settings() {
  const { toast } = useToast();
  const [group, setGroup] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGroup(localStorage.getItem(KEY_GROUP) ?? "");
  }, []);

  const handleSave = () => {
    const clean = group.trim().replace(/^@/, "");
    localStorage.setItem(KEY_GROUP, clean);
    setGroup(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    toast({ title: "Settings saved" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure app integrations and preferences"
      />

      <Card className="p-6 shadow-sm border-none ring-1 ring-border max-w-xl">
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-display font-bold">Telegram Integration</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          When you tap <strong>Telegram</strong> on an invoice, it opens Telegram with the
          invoice text ready to forward to any chat or group.
        </p>

        <Separator className="mb-5" />

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="tg-group" className="text-sm font-semibold">
              Preferred Group Name <span className="font-normal text-muted-foreground">(for reference)</span>
            </Label>
            <div className="flex items-center rounded-xl ring-1 ring-border overflow-hidden bg-card focus-within:ring-2 focus-within:ring-accent transition-all">
              <span className="px-3 text-sm text-muted-foreground border-r border-border bg-muted/40 h-10 flex items-center select-none">
                @
              </span>
              <Input
                id="tg-group"
                placeholder="reach_delivery"
                value={group}
                onChange={e => setGroup(e.target.value.replace(/^@/, ""))}
                className="border-0 shadow-none ring-0 focus-visible:ring-0 rounded-none h-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This is stored for reference only. Invoices are shared via Telegram's share dialog.
            </p>
          </div>

          <Button className="rounded-xl h-10" onClick={handleSave}>
            {saved
              ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved</>
              : "Save Settings"
            }
          </Button>
        </div>
      </Card>
    </div>
  );
}
