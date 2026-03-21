#!/usr/bin/env node
/**
 * Patches html2canvas to support oklch/lch/oklab/lab/color CSS color functions.
 * html2canvas 1.4.x throws on these modern color formats used by Tailwind CSS 4.
 * This patch adds them as no-op fallbacks (return transparent) so PDF export works.
 *
 * Run automatically via postinstall or manually: node scripts/patch-html2canvas.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const targets = [
  // Main dist (CJS)
  join(root, "node_modules/html2canvas/dist/html2canvas.js"),
  join(root, "node_modules/.pnpm/html2canvas@1.4.1/node_modules/html2canvas/dist/html2canvas.js"),
  // ESM dist (used by Vite for pre-bundling)
  join(root, "node_modules/html2canvas/dist/html2canvas.esm.js"),
  join(root, "node_modules/.pnpm/html2canvas@1.4.1/node_modules/html2canvas/dist/html2canvas.esm.js"),
];

const MARKER = "_oklchFallback";

function patchFile(file) {
  if (!existsSync(file)) return false;
  let src = readFileSync(file, "utf8");
  if (src.includes(MARKER)) {
    console.log(`[patch-html2canvas] Already patched: ${file}`);
    return true;
  }

  // Insert the fallback function before SUPPORTED_COLOR_FUNCTIONS
  src = src.replace(
    /var SUPPORTED_COLOR_FUNCTIONS\s*=\s*\{/,
    `var _oklchFallback = function (_context, _args) { return 0x00000000; };\nvar SUPPORTED_COLOR_FUNCTIONS = {`
  );

  // Add oklch/lch/oklab/lab/color entries after rgba: rgb
  src = src.replace(
    /rgba:\s*rgb\s*\n?\s*\};/,
    `rgba: rgb,\n    oklch: _oklchFallback,\n    lch: _oklchFallback,\n    oklab: _oklchFallback,\n    lab: _oklchFallback,\n    color: _oklchFallback\n};`
  );

  writeFileSync(file, src, "utf8");
  console.log(`[patch-html2canvas] Patched: ${file}`);
  return true;
}

let patched = 0;
for (const file of targets) {
  if (patchFile(file)) patched++;
}

if (patched === 0) {
  console.warn("[patch-html2canvas] No html2canvas files found to patch.");
} else {
  console.log(`[patch-html2canvas] Done (${patched} file(s)).`);
}
