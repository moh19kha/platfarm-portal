import "dotenv/config";
import compression from "compression";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startDocumentAlertCron } from "../cron/documentAlerts";
import { startCompanyDocExpiryCron } from "../cron/companyDocExpiry";
import { warmupOdooAuth } from "../odoo-hr.js";
import { registerSupplierStatementPdfRoute } from "../supplier-statement-pdf";
import { registerQuotationPdfRoute } from "../quotation-pdf";
import { registerStatementOfAccountPdfRoute } from "../statement-of-account-pdf";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Gzip compression — backup to nginx; handles any direct traffic
  app.use(compression({ level: 6, threshold: 1024 }));

  // ── Canonical domain redirect (client-side) ────────────────────────────────
  // erp.platfarm.io is a CNAME to *.manus.space, so behind the proxy the Host
  // header is always the manus.space domain. Server-side redirect would loop.
  // Instead, we inject a small JS snippet into HTML responses that checks
  // window.location.hostname on the client and redirects if needed.
  // The OAuth redirect URI in const.ts is hardcoded to erp.platfarm.io,
  // so after login users always land on the correct domain.
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Custom email/password auth routes
  registerLocalAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Helper to resolve dashboard HTML files in both dev and production
  // Dev: server/_core/index.ts → ../../client/public/<file>
  // Prod: dist/index.js → public/<file> (vite copies client/public into dist/public)
  function resolveDashboardPath(filename: string): string {
    // Try production path first (dist/public/<file>)
    const prodPath = path.resolve(import.meta.dirname, "public", filename);
    if (fs.existsSync(prodPath)) return prodPath;
    // Fallback to development path (client/public/<file>)
    const devPath = path.resolve(import.meta.dirname, "../../client/public", filename);
    if (fs.existsSync(devPath)) return devPath;
    return "";
  }

  // Supplier Statement PDF export
  registerSupplierStatementPdfRoute(app);
  // Quotation / Invoice PDF export (server-side Puppeteer)
  registerQuotationPdfRoute(app);
  // Statement of Account PDF export
  registerStatementOfAccountPdfRoute(app);

  // Image proxy — fetches external images server-side so the browser can use them
  // in html2canvas without CORS taint (used by Quotation/Invoice PDF export)
  app.get("/api/proxy-image", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("Missing url");
    // Only allow fetching from our known CDN domains
    const allowed = ["d2xsxph8kpxj0f.cloudfront.net", "cloudfront.net", "amazonaws.com"];
    try {
      const parsed = new URL(url);
      if (!allowed.some(d => parsed.hostname.endsWith(d))) {
        return res.status(403).send("Domain not allowed");
      }
      const upstream = await fetch(url);
      if (!upstream.ok) return res.status(502).send("Upstream error");
      const contentType = upstream.headers.get("content-type") || "image/png";
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (e) {
      res.status(500).send("Proxy error");
    }
  });

  // Serve the supply chain dashboard HTML as a standalone page
  app.get("/api/supply-chain-dashboard", (_req, res) => {
    const filePath = resolveDashboardPath("supply-chain-dashboard.html");
    if (filePath) {
      res.setHeader("Content-Type", "text/html");
      res.sendFile(filePath);
    } else {
      res.status(404).send("Dashboard not found");
    }
  });

  // Serve the HR dashboard HTML as a standalone page
  app.get("/api/hr-dashboard", (_req, res) => {
    const filePath = resolveDashboardPath("hr-dashboard.html");
    if (filePath) {
      res.setHeader("Content-Type", "text/html");
      res.sendFile(filePath);
    } else {
      res.status(404).send("HR Dashboard not found");
    }
  });

  // Serve the DMS dashboard HTML as a standalone page
  app.get("/api/dms-dashboard", (_req, res) => {
    const filePath = resolveDashboardPath("dms-dashboard.html");
    if (filePath) {
      res.setHeader("Content-Type", "text/html");
      res.sendFile(filePath);
    } else {
      res.status(404).send("DMS Dashboard not found");
    }
  });

  // Serve the Petty Cash & Expenses dashboard HTML as a standalone page
  app.get("/api/pce-dashboard", (_req, res) => {
    const filePath = resolveDashboardPath("pce-dashboard.html");
    if (filePath) {
      res.setHeader("Content-Type", "text/html");
      res.sendFile(filePath);
    } else {
      res.status(404).send("PCE Dashboard not found");
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start daily document alert cron job (missing shipment documents)
    startDocumentAlertCron();

    // Start daily company document expiry alert cron job
    startCompanyDocExpiryCron();
    // Pre-warm Odoo auth + HR cache so first user request is served instantly
    setTimeout(() => warmupOdooAuth().catch(() => {}), 3000);
  });
}

startServer().catch(console.error);
