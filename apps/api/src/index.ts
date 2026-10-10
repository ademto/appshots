import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { authRoutes } from "./routes/auth";
import { projectRoutes } from "./routes/projects";

const app = new Hono();

// Allow the web app to call the API with credentials (session cookie).
app.use(
  "*",
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "appshots-api" }));

app.route("/auth", authRoutes);
app.route("/projects", projectRoutes);

// Routes mounted in later steps:
// app.route("/uploads", uploadRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`AppShots API listening on http://localhost:${env.PORT}`);
