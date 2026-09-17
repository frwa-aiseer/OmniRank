import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getServerEnv } from "./src/server/env.ts";
import { tenancyRouter } from "./src/server/routes/tenancy.ts";
import brandBrainRouter from "./src/server/routes/brand-brain.ts";

async function startServer() {
  const app = express();
  const env = getServerEnv();
  const PORT = 3000;

  app.use(express.json());

  // Tenancy and Authorization API
  app.use("/api/tenancy", tenancyRouter);

  // Brand Brain Core API
  app.use("/api/brand-brain", brandBrainRouter);

  // Health and Diagnostic API route
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "OmniRank Server",
      timestamp: new Date().toISOString(),
      nodeEnv: env.NODE_ENV,
      authConfigured: Boolean(env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    });
  });

  // Inngest Event Webhook Endpoint Placeholder
  app.post("/api/inngest", (req, res) => {
    res.json({
      message: "OmniRank Inngest Endpoint active",
      received: true,
    });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OmniRank] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[OmniRank Server Startup Error]:", err);
  process.exit(1);
});
