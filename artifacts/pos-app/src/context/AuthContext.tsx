import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AuthUser {
  id:       number;
  username: string;
  role:     "admin" | "staff";
}

interface AuthContextValue {
  user:    AuthUser | null;
  loading: boolean;
  login:   (username: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE()}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser(data); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${BASE()}/api/auth/login`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error ?? "Login failed");
    }
    const data = await r.json();
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BASE()}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
