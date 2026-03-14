import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import compression from "compression";
import router from "./routes";

const app: Express = express();

app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

app.use(session({
  secret:            process.env.SESSION_SECRET ?? "lumina-pos-secret-key-2026",
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   false,
    maxAge:   7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

export default app;
