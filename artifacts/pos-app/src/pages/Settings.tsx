import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TG_TOKEN_KEY = "lumina_tg_token";
const TG_CHAT_KEY  = "lumina_tg_chat";

export default function Settings() {
  const { toast } = useToast();
  const [token,  setToken]  = useState("");
  const [chatId, setChatId] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TG_TOKEN_KEY)  ?? "");
    setChatId(localStorage.getItem(TG_CHAT_KEY) ?? "");
  }, []);

  const handleSave = () => {
    localStorage.setItem(TG_TOKEN_KEY, token.trim());
    localStorage.setItem(TG_CHAT_KEY,  chatId.trim());
    toast({ title: "Telegram settings saved" });
  };

  const handleTest = async () => {
    const t = token.trim();
    const c = chatId.trim();
    if (!t || !c) {
      toast({ title: "Enter bot token and chat ID first", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${t}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: c, text: "✅ Lumina POS — Telegram connected!" }),
        }
      );
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Test message sent successfully!" });
      } else {
        toast({ title: `Telegram error: ${json.description}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to reach Telegram", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const saved = !!(localStorage.getItem(TG_TOKEN_KEY) && localStorage.getItem(TG_CHAT_KEY));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="App configuration and preferences"
      />

      <Card className="p-6 space-y-5 border-none ring-1 ring-border shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#229ED9]/10 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-[#229ED9]" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Telegram Notifications</h2>
            <p className="text-sm text-muted-foreground">Send invoices directly to a Telegram group</p>
          </div>
          {saved && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Configured
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tg-token">Bot Token</Label>
            <Input
              id="tg-token"
              type="password"
              placeholder="123456789:ABCdef..."
              value={token}
              onChange={e => setToken(e.target.value)}
              className="h-11 rounded-xl font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Get a token from <span className="font-medium">@BotFather</span> on Telegram
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tg-chat">Group / Channel Chat ID</Label>
            <Input
              id="tg-chat"
              placeholder="-1001234567890"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              className="h-11 rounded-xl font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              For groups use a negative ID e.g. <span className="font-medium">-100xxxxxxxxxx</span>.
              Add the bot as admin first.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button onClick={handleSave} className="rounded-xl h-11 px-6">
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="rounded-xl h-11 gap-2"
            >
              <Send className="w-4 h-4" />
              {testing ? "Sending…" : "Send Test Message"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm space-y-1.5">
          <p className="font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-accent" /> How to set up
          </p>
          <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Open Telegram and search for <strong>@BotFather</strong></li>
            <li>Send <code>/newbot</code> and follow the steps to get a token</li>
            <li>Add the bot to your group and make it an admin</li>
            <li>Get the group chat ID (use <strong>@userinfobot</strong> or forward a message)</li>
            <li>Paste the token and chat ID above and click Save</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
