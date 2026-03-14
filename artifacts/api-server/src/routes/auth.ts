import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId:   number;
    username: string;
    role:     string;
  }
}

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
  res.json({ id: req.session.userId, username: req.session.username, role: req.session.role });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username.trim())).limit(1);
  if (!user) return res.status(401).json({ error: "Invalid username or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid username or password" });

  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.role     = user.role;
  res.json({ id: user.id, username: user.username, role: user.role });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

// GET /api/auth/users  (admin only)
router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.select({
    id:        usersTable.id,
    username:  usersTable.username,
    role:      usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

// POST /api/auth/users  (admin only)
router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role = "staff" } = req.body as { username?: string; password?: string; role?: string };
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username.trim())).limit(1);
  if (existing.length > 0) return res.status(409).json({ error: "Username already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db.insert(usersTable).values({
    username: username.trim(),
    passwordHash,
    role: role === "admin" ? "admin" : "staff",
  }).returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role });
  res.status(201).json(created);
});

// DELETE /api/auth/users/:id  (admin only)
router.delete("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (req.session.userId === id) return res.status(400).json({ error: "Cannot delete yourself" });
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// PUT /api/auth/users/:id/password (admin only — reset any user; or self)
router.put("/users/:id/password", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const isSelf  = req.session.userId === id;
  const isAdmin = req.session.role   === "admin";
  if (!isSelf && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { password } = req.body as { password?: string };
  if (!password || password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (req.session?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

export default router;
