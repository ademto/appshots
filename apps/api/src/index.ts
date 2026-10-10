import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { authRoutes } from "./routes/auth";
import { projectRoutes } from "./routes/projects";
import { uploadRoutes } from "./routes/uploads";

const app = new Hono();

// Allowed web origins (comma-separated in WEB_ORIGIN), e.g.
// "https://appshots.vercel.app,http://localhost:5173".
const allowedOrigins = env.WEB_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Allow the web app to call the API with credentials (session cookie).
app.use(
  "*",
  cors({
    origin: (origin) =>
      allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "appshots-api" }));

app.route("/auth", authRoutes);
app.route("/projects", projectRoutes);
app.route("/uploads", uploadRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`AppShots API listening on http://localhost:${env.PORT}`);
