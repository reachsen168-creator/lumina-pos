import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle2, AlertCircle, Users, Plus, Trash2, KeyRound, ShieldCheck, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const TG_TOKEN_KEY = "lumina_tg_token";
const TG_CHAT_KEY  = "lumina_tg_chat";
const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface UserRow { id: number; username: string; role: string; createdAt: string }

// ── User Management ────────────────────────────────────────────────────────────

function UserManagement() {
  const { user: me } = useAuth();
  const { toast }    = useToast();
  const qc           = useQueryClient();

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole,     setNewRole]     = useState("staff");
  const [resetId,     setResetId]     = useState<number | null>(null);
  const [resetPw,     setResetPw]     = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["auth-users"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/auth/users`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load users");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE()}/api/auth/users`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Account created successfully" });
      setNewUsername(""); setNewPassword(""); setNewRole("staff");
      qc.invalidateQueries({ queryKey: ["auth-users"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE()}/api/auth/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => {
      toast({ title: "Account deleted" });
      qc.invalidateQueries({ queryKey: ["auth-users"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const r = await fetch(`${BASE()}/api/auth/users/${id}/password`, {
        method:      "PUT",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ password }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => {
      toast({ title: "Password updated" });
      setResetId(null); setResetPw("");
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-6 space-y-5 border-none ring-1 ring-border shadow-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="font-semibold text-base">User Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage staff and admin logins</p>
        </div>
      </div>

      {/* Existing users */}
      <div className="rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No accounts found.</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${u.role === "admin" ? "bg-accent" : "bg-muted-foreground"}`}>
                  {u.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate flex items-center gap-1.5">
                    {u.username}
                    {u.role === "admin" && <ShieldCheck className="w-3.5 h-3.5 text-accent" />}
                    {u.id === me?.id && <span className="text-[10px] text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                </div>

                {/* Reset password inline */}
                {resetId === u.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="New password"
                      value={resetPw}
                      onChange={e => setResetPw(e.target.value)}
                      className="h-8 w-32 text-xs"
                    />
                    <Button size="sm" className="h-8 text-xs px-3"
                      onClick={() => resetMutation.mutate({ id: u.id, password: resetPw })}
                      disabled={resetPw.length < 4 || resetMutation.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs px-2"
                      onClick={() => { setResetId(null); setResetPw(""); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setResetId(u.id); setResetPw(""); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== me?.id && (
                      <button
                        onClick={() => { if (confirm(`Delete account "${u.username}"?`)) deleteMutation.mutate(u.id); }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create new account */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-accent" /> Create New Account
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input
              placeholder="e.g. staff01"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              placeholder="Min 4 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff"><span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Staff</span></SelectItem>
                <SelectItem value="admin"><span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Admin</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!newUsername.trim() || newPassword.length < 4 || createMutation.isPending}
          className="h-9 gap-2 rounded-xl"
        >
          <Plus className="w-4 h-4" />
          {createMutation.isPending ? "Creating…" : "Create Account"}
        </Button>
      </div>
    </Card>
  );
}

// ── Settings page ──────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
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

      {/* User Management — admin only */}
      {user?.role === "admin" && <UserManagement />}

      {/* Telegram */}
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
