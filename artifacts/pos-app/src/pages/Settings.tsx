import { useState, useEffect } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const KEY_ENABLED  = "lumina_telegram_enabled";
const KEY_USERNAME = "lumina_telegram_username";

export function useTelegramSettings() {
  const enabled  = localStorage.getItem(KEY_ENABLED) === "true";
  const username = localStorage.getItem(KEY_USERNAME) ?? "";
  return { enabled, username };
}

export default function Settings() {
  const { toast } = useToast();

  const [enabled,  setEnabled]  = useState(false);
  const [username, setUsername] = useState("");
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem(KEY_ENABLED) === "true");
    setUsername(localStorage.getItem(KEY_USERNAME) ?? "");
  }, []);

  const handleSave = () => {
    const clean = username.trim().replace(/^@/, "");
    localStorage.setItem(KEY_ENABLED,  String(enabled));
    localStorage.setItem(KEY_USERNAME, clean);
    setUsername(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    toast({ title: "Settings saved" });
  };

  const handleTest = () => {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) {
      toast({ title: "Enter a Telegram group username first", variant: "destructive" });
      return;
    }
    const url = `https://t.me/${clean}?text=${encodeURIComponent("Telegram connection successful")}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure app integrations and preferences"
      />

      <Card className="p-6 shadow-sm border-none ring-1 ring-border max-w-xl">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-display font-bold">Telegram Integration</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Send sales invoices to a Telegram group with one tap.
        </p>

        <Separator className="mb-5" />

        <div className="space-y-5">
          {/* Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-semibold">Enable Telegram Sending</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show "Send to Telegram" button on each invoice
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Username field */}
          <div className="space-y-1.5">
            <Label htmlFor="tg-username" className="text-sm font-semibold">
              Telegram Group Username
            </Label>
            <div className="flex items-center rounded-xl ring-1 ring-border overflow-hidden bg-card focus-within:ring-2 focus-within:ring-accent transition-all">
              <span className="px-3 text-sm text-muted-foreground border-r border-border bg-muted/40 h-10 flex items-center select-none">
                t.me/
              </span>
              <Input
                id="tg-username"
                placeholder="reach_delivery"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/^@/, ""))}
                className="border-0 shadow-none ring-0 focus-visible:ring-0 rounded-none h-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter only the username — not the full link.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              className="rounded-xl h-10"
              onClick={handleTest}
            >
              <Send className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
            <Button
              className="rounded-xl h-10"
              onClick={handleSave}
            >
              {saved
                ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved</>
                : "Save Settings"
              }
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
