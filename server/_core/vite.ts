import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Hashed assets: 1-year immutable cache.
  // Vite fingerprints every filename with a content hash so files never
  // change at a given URL — safe for browsers to cache indefinitely.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,
    })
  );

  // Other static files (favicon, manifest, robots.txt, etc.)
  // index:false prevents express.static from serving index.html so the
  // no-cache catch-all below always handles HTML responses.
  app.use(express.static(distPath, { maxAge: 0, etag: true, index: false }));

  // Missing hashed asset → 404 (prevents stale HTML being executed as JS
  // when a browser has cached an old index.html with outdated asset hashes).
  app.use("/assets", (_req, res) => {
    res.status(404).send("Asset not found");
  });

  // SPA catch-all: always serve fresh index.html so new deploys are
  // picked up immediately. Skip API routes.
  app.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) {
      return next();
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
