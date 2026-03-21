/**
 * CDN Asset Loader
 * Downloads static assets (fonts, images) from CDN to /tmp at startup.
 * PDFKit requires local file paths, so we cache CDN files locally.
 */
import fs from "fs";
import path from "path";
import https from "https";

const TMP_DIR = "/tmp/platfarm-assets";
const FONTS_DIR = path.join(TMP_DIR, "fonts");

// CDN URLs for all assets
export const CDN_ASSETS = {
  fonts: {
    regular: "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/DMSans-Regular_f666fdb7.ttf",
    medium:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/DMSans-Medium_acdc7bbf.ttf",
    bold:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/DMSans-Bold_6435f63a.ttf",
  },
  images: {
    logo:      "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/logo_785ea63a.png",
    signature: "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/signature_375887cb.png",
    stamp:     "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/stamp_1236453a.png",
  },
};

// Local paths where assets are cached
export const ASSET_PATHS = {
  fonts: {
    regular: path.join(FONTS_DIR, "DMSans-Regular.ttf"),
    medium:  path.join(FONTS_DIR, "DMSans-Medium.ttf"),
    bold:    path.join(FONTS_DIR, "DMSans-Bold.ttf"),
  },
  images: {
    logo:      path.join(TMP_DIR, "logo.png"),
    signature: path.join(TMP_DIR, "signature.png"),
    stamp:     path.join(TMP_DIR, "stamp.png"),
  },
};

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      resolve();
      return;
    }
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { fs.unlinkSync(dest); reject(err); });
    }).on("error", (err) => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

let assetsReady = false;
let assetsPromise: Promise<void> | null = null;

export async function ensureAssets(): Promise<void> {
  if (assetsReady) return;
  if (assetsPromise) return assetsPromise;

  assetsPromise = (async () => {
    // Create directories
    fs.mkdirSync(FONTS_DIR, { recursive: true });

    // Download all assets in parallel
    const downloads: Array<[string, string]> = [
      [CDN_ASSETS.fonts.regular,  ASSET_PATHS.fonts.regular],
      [CDN_ASSETS.fonts.medium,   ASSET_PATHS.fonts.medium],
      [CDN_ASSETS.fonts.bold,     ASSET_PATHS.fonts.bold],
      [CDN_ASSETS.images.logo,    ASSET_PATHS.images.logo],
      [CDN_ASSETS.images.signature, ASSET_PATHS.images.signature],
      [CDN_ASSETS.images.stamp,   ASSET_PATHS.images.stamp],
    ];

    await Promise.all(downloads.map(([url, dest]) =>
      downloadFile(url, dest).catch((err) => {
        console.warn(`[assets-cdn] Warning: failed to download ${url}: ${err.message}`);
      })
    ));

    assetsReady = true;
    console.log("[assets-cdn] All assets ready in /tmp/platfarm-assets");
  })();

  return assetsPromise;
}
