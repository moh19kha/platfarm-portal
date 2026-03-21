// ═══════════════════════════════════════════════════════════════════════════
// Tradlinx Vessel Tracking Service
// Uses Tradlinx public API for vessel search and SSR scraping for position data
// ═══════════════════════════════════════════════════════════════════════════

import axios from "axios";

const TRADLINX_SEARCH_API = "https://api-shipgo.tradlinx.com/api/metadata/vessels/search";
const TRADLINX_METADATA_API = "https://api-shipgo.tradlinx.com/api/metadata/vessels";
const TRADLINX_VESSEL_PAGE = "https://www.tradlinx.com/vessel-tracking";

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─── Types ────────────────────────────────────────────────────────────────

export interface VesselSearchResult {
  vesselId: number;
  vesselNm: string;
  imoNo: string;
  mmsi: string;
  callSign: string;
}

export interface VesselPosition {
  vesselId: number;
  vesselName: string;
  imoNo: string;
  mmsi: string;
  callSign: string;
  course: number | null;
  speed: number | null;
  heading: number | null;
  turn: number | null;
  width: number | null;
  length: number | null;
  draught: number | null;
  flag: string | null;
  destination: string | null;
  eta: string | null;
  latitude: number | null;
  longitude: number | null;
  receivedDateTime: string | null;
  aisType?: string | null;
}

// ─── Simple in-memory cache ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const positionCache = new Map<number, CacheEntry<VesselPosition>>();
const negativeCacheMs = new Map<number, number>(); // vesselId -> timestamp of last failed attempt
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for failed lookups

function getCached<T>(cache: Map<string | number, CacheEntry<T>>, key: string | number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string | number, CacheEntry<T>>, key: string | number, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Search Vessels ──────────────────────────────────────────────────────

export async function searchVessels(keyword: string): Promise<VesselSearchResult[]> {
  if (!keyword || keyword.trim().length < 2) return [];

  try {
    const resp = await axios.get(TRADLINX_SEARCH_API, {
      params: { keyword: keyword.trim() },
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });

    if (resp.data && Array.isArray(resp.data.content)) {
      return resp.data.content.map((v: any) => ({
        vesselId: v.vesselId,
        vesselNm: v.vesselNm || v.vesselName || "",
        imoNo: v.imoNo || "",
        mmsi: v.mmsi || "",
        callSign: v.callSign || "",
      }));
    }
    return [];
  } catch (err: any) {
    console.error("[Tradlinx] Search error:", err.message);
    return [];
  }
}

// ─── Get Vessel Metadata ─────────────────────────────────────────────────

export async function getVesselMetadata(vesselId: number): Promise<VesselSearchResult | null> {
  try {
    const resp = await axios.get(`${TRADLINX_METADATA_API}/${vesselId}`, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });

    if (resp.data && resp.data.vesselId) {
      return {
        vesselId: resp.data.vesselId,
        vesselNm: resp.data.vesselNm || resp.data.vesselName || "",
        imoNo: resp.data.imoNo || "",
        mmsi: resp.data.mmsi || "",
        callSign: resp.data.callSign || "",
      };
    }
    return null;
  } catch (err: any) {
    console.error("[Tradlinx] Metadata error:", err.message);
    return null;
  }
}

// ─── Get Vessel Position (scrape from SSR page) ──────────────────────────

export async function getVesselPosition(vesselId: number, vesselName?: string, mmsi?: string, imo?: string): Promise<VesselPosition | null> {
  // Check cache first
  const cached = getCached(positionCache, vesselId);
  if (cached) return cached;

  // Check negative cache to avoid hammering on repeated failures
  const lastFail = negativeCacheMs.get(vesselId);
  if (lastFail && Date.now() - lastFail < NEGATIVE_CACHE_TTL_MS) {
    return null;
  }

  try {
    // If we don't have metadata, fetch it first
    if (!vesselName || !mmsi || !imo) {
      const meta = await getVesselMetadata(vesselId);
      if (!meta) return null;
      vesselName = meta.vesselNm;
      mmsi = meta.mmsi;
      imo = meta.imoNo;
    }

    // Build the URL slug
    const slug = vesselName.replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "");
    const url = `${TRADLINX_VESSEL_PAGE}/${vesselId}-${slug}-MMSI-${mmsi}-IMO-${imo}`;

    const resp = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 20000,
    });

    const html = resp.data as string;

    // Extract vessel data from the RSC payload embedded in the HTML
    // The RSC payload uses escaped quotes (\"key\":\"value\")
    const escapedPattern = new RegExp(
      `\\\\?"vesselId\\\\?"\\s*:\\s*${vesselId}\\s*,\\s*\\\\?"imoNo\\\\?"[^}]+\\}`,
      "g"
    );
    const matches = html.match(escapedPattern);

    if (matches && matches.length > 0) {
      // Take the longest match (most complete data)
      const bestMatch = matches.reduce((a, b) => (a.length > b.length ? a : b));

      try {
        // Unescape the RSC payload quotes
        const unescaped = bestMatch.replace(/\\"/g, '"');
        // Extract just up to the first closing brace to avoid trailing content
        const closingBrace = unescaped.indexOf('}');
        const cleanStr = closingBrace >= 0 ? unescaped.substring(0, closingBrace) : unescaped;
        const jsonStr = `{${cleanStr}}`;
        const data = JSON.parse(jsonStr);
        const position: VesselPosition = {
          vesselId: data.vesselId,
          vesselName: data.vesselName || vesselName,
          imoNo: data.imoNo || imo,
          mmsi: data.mmsi || mmsi,
          callSign: data.callSign || "",
          course: data.course ?? null,
          speed: data.speed ?? null,
          heading: data.heading ?? null,
          turn: data.turn ?? null,
          width: data.width ?? null,
          length: data.length ?? null,
          draught: data.draught ?? null,
          flag: data.flag ?? null,
          destination: data.destination ?? null,
          eta: data.eta ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          receivedDateTime: data.receivedDateTime ?? null,
        };

        // Cache the result
        setCache(positionCache, vesselId, position);
        return position;
      } catch (parseErr) {
        console.error("[Tradlinx] JSON parse error:", parseErr);
      }
    }

    // Fallback: try to extract individual fields with regex
    const extractField = (field: string, isNum = false): any => {
      const regex = new RegExp(`"${field}"\\s*:\\s*"?([^",}]+)"?`);
      const m = html.match(regex);
      if (!m) return null;
      return isNum ? parseFloat(m[1]) : m[1];
    };

    // Check if we can find at least the basic data
    const imoFound = extractField("imoNo");
    if (imoFound === imo) {
      const position: VesselPosition = {
        vesselId,
        vesselName: vesselName || "",
        imoNo: imo || "",
        mmsi: mmsi || "",
        callSign: extractField("callSign") || "",
        course: extractField("course", true),
        speed: extractField("speed", true),
        heading: extractField("heading", true),
        turn: extractField("turn", true),
        width: extractField("width", true),
        length: extractField("length", true),
        draught: extractField("draught", true),
        flag: extractField("flag"),
        destination: extractField("destination"),
        eta: extractField("eta"),
        latitude: extractField("latitude", true),
        longitude: extractField("longitude", true),
        receivedDateTime: extractField("receivedDateTime"),
      };

      setCache(positionCache, vesselId, position);
      return position;
    }

    console.warn("[Tradlinx] Could not extract vessel data from page:", url);
    negativeCacheMs.set(vesselId, Date.now());
    return null;
  } catch (err: any) {
    console.error("[Tradlinx] Position scrape error:", err.message);
    negativeCacheMs.set(vesselId, Date.now());
    return null;
  }
}

// ─── Search and get position in one call ─────────────────────────────────

export async function searchVesselWithPosition(keyword: string): Promise<VesselPosition | null> {
  const results = await searchVessels(keyword);
  if (results.length === 0) return null;

  // Get position for the first result
  const first = results[0];
  const position = await getVesselPosition(first.vesselId, first.vesselNm, first.mmsi, first.imoNo);

  // If first attempt failed, retry once after a short delay
  if (!position) {
    // Clear negative cache for retry
    negativeCacheMs.delete(first.vesselId);
    await new Promise(r => setTimeout(r, 2000));
    return getVesselPosition(first.vesselId, first.vesselNm, first.mmsi, first.imoNo);
  }

  return position;
}
