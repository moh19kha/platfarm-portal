import compression from "compression";
import { warmupOdooAuth } from "./odoo-hr.js";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Gzip compression (backup to nginx; handles direct traffic) ───────────
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }));

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  // ── Hashed assets: 1-year immutable cache (Vite content-hashes filenames) ─
  app.use(
    "/assets",
    express.static(path.join(staticPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,
    })
  );

  // ── Other static files: normal caching ──────────────────────────────────
  app.use(express.static(staticPath, {
    maxAge: "1h",
    etag: true,
  }));

  // ── HTML: always revalidate so new deploys are picked up immediately ─────
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    setTimeout(() => warmupOdooAuth().catch(() => {}), 2000);
  });
}

startServer().catch(console.error);
