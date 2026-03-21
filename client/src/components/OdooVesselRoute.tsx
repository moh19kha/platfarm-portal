// ══════════════════════════════════════════════════════════════════════════════
// ODOO VESSEL ROUTE VISUALIZATION — V5
// Time-based vessel progress (ETD→ETA), ship icon, AIS live position,
// Google Maps mini-map with vessel pin, route polyline, MMSI/IMO links
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { Card, CardHdr, CHT, Lbl, Val } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";

interface OdooShipmentData {
  vesselName?: string | null;
  voyage?: string | null;
  shippingLine?: string | null;
  portLoad?: string | null;
  portDischarge?: string | null;
  etd?: string | null;
  eta?: string | null;
  state?: string;
  shipmentStatus?: string | null;
  incoterm?: { id: number; name: string } | string | null;
  freightType?: string | null;
  loadType?: string | null;
  transitTimeDays?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAisTimestamp(dt: string | null): string {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dt;
  }
}

function formatAisEta(eta: string | null | undefined): string {
  if (!eta) return "—";
  try {
    const d = new Date(eta);
    if (isNaN(d.getTime())) return eta;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return eta;
  }
}

/** Calculate vessel progress 0..1 based on current time between ETD and ETA */
function calcTimeProgress(etd: Date | null, eta: Date | null): number | null {
  if (!etd || !eta) return null;
  const now = new Date();
  let total = eta.getTime() - etd.getTime();
  if (total <= 0) {
    const etdStart = new Date(etd);
    etdStart.setHours(0, 0, 0, 0);
    const etaEnd = new Date(eta);
    etaEnd.setHours(23, 59, 59, 999);
    total = etaEnd.getTime() - etdStart.getTime();
    const elapsed = now.getTime() - etdStart.getTime();
    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 1;
    return elapsed / total;
  }
  const elapsed = now.getTime() - etd.getTime();
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 1;
  return elapsed / total;
}

// Ship SVG icon
function ShipIcon({ size = 22, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 19L4 21H20L22 19L20 14H4L2 19Z" fill={color} opacity="0.25" />
      <path d="M2 19L4 21H20L22 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 14H20L22 19H2L4 14Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 14V10H17V14" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 10V7H15V10" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M11 7V4H13V7" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 4C12 3 13 2.5 13.5 3" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <circle cx="9" cy="12" r="0.8" fill={color} />
      <circle cx="12" cy="12" r="0.8" fill={color} />
      <circle cx="15" cy="12" r="0.8" fill={color} />
      <path d="M1 22C3 21 5 22 7 21C9 20 11 22 13 21C15 20 17 22 19 21C21 20 23 22 23 22" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    </svg>
  );
}

// ─── Mini-Map Component ──────────────────────────────────────────────────

// ─── Maritime Sea-Lane Waypoint Network ────────────────────────────────────
// Key navigational waypoints for realistic vessel routing in the Middle East,
// Red Sea, Indian Ocean, and Mediterranean regions. Vessels follow sea lanes,
// not straight lines over land.

type WP = { lat: number; lng: number; id: string };

const SEA_WAYPOINTS: WP[] = [
  // Persian/Arabian Gulf
  { id: "gulf_central", lat: 26.2, lng: 52.5 },
  // Strait of Hormuz
  { id: "hormuz", lat: 26.3, lng: 56.4 },
  // Gulf of Oman
  { id: "oman_gulf", lat: 24.5, lng: 58.8 },
  // Arabian Sea (off Oman coast)
  { id: "arabian_sea_n", lat: 21.0, lng: 60.0 },
  // Arabian Sea (south of Oman)
  { id: "arabian_sea_s", lat: 15.0, lng: 54.0 },
  // Gulf of Aden entrance
  { id: "aden_east", lat: 12.8, lng: 50.0 },
  // Gulf of Aden mid
  { id: "aden_mid", lat: 12.5, lng: 46.0 },
  // Bab el-Mandeb Strait
  { id: "bab_mandeb", lat: 12.6, lng: 43.4 },
  // Red Sea south
  { id: "red_sea_s", lat: 15.5, lng: 41.5 },
  // Red Sea mid
  { id: "red_sea_m", lat: 20.0, lng: 38.5 },
  // Red Sea north (near Jeddah)
  { id: "red_sea_jeddah", lat: 21.5, lng: 38.8 },
  // Red Sea far north
  { id: "red_sea_n", lat: 26.0, lng: 35.0 },
  // Suez Gulf approach
  { id: "suez_approach", lat: 28.5, lng: 33.5 },
  // Suez Canal south
  { id: "suez_south", lat: 29.9, lng: 32.6 },
  // Mediterranean (Port Said)
  { id: "med_portsaid", lat: 31.3, lng: 32.3 },
  // Mediterranean central
  { id: "med_central", lat: 34.0, lng: 25.0 },
  // Indian Ocean (west of India)
  { id: "indian_w", lat: 15.0, lng: 65.0 },
  // Indian Ocean (south of India)
  { id: "indian_s", lat: 8.0, lng: 76.0 },
  // Bay of Bengal
  { id: "bengal", lat: 12.0, lng: 85.0 },
  // Strait of Malacca west
  { id: "malacca_w", lat: 5.0, lng: 95.0 },
  // Strait of Malacca east / Singapore
  { id: "singapore", lat: 1.3, lng: 104.0 },
  // South China Sea
  { id: "scs_s", lat: 5.0, lng: 110.0 },
  { id: "scs_n", lat: 15.0, lng: 115.0 },
  // East China Sea
  { id: "ecs", lat: 28.0, lng: 125.0 },
  // East Africa
  { id: "mombasa_off", lat: -3.0, lng: 42.0 },
  // South Africa
  { id: "durban_off", lat: -30.0, lng: 32.0 },
  { id: "cape_good_hope", lat: -34.5, lng: 18.5 },
];

// Define which waypoints connect to each other (sea lane graph edges)
const SEA_LANES: [string, string][] = [
  ["gulf_central", "hormuz"],
  ["hormuz", "oman_gulf"],
  ["oman_gulf", "arabian_sea_n"],
  ["arabian_sea_n", "arabian_sea_s"],
  ["arabian_sea_s", "aden_east"],
  ["aden_east", "aden_mid"],
  ["aden_mid", "bab_mandeb"],
  ["bab_mandeb", "red_sea_s"],
  ["red_sea_s", "red_sea_m"],
  ["red_sea_m", "red_sea_jeddah"],
  ["red_sea_jeddah", "red_sea_n"],
  ["red_sea_n", "suez_approach"],
  ["suez_approach", "suez_south"],
  ["suez_south", "med_portsaid"],
  ["med_portsaid", "med_central"],
  // Indian Ocean routes
  ["arabian_sea_n", "indian_w"],
  ["indian_w", "indian_s"],
  ["indian_s", "bengal"],
  ["bengal", "malacca_w"],
  ["malacca_w", "singapore"],
  ["singapore", "scs_s"],
  ["scs_s", "scs_n"],
  ["scs_n", "ecs"],
  // East Africa
  ["aden_east", "mombasa_off"],
  ["mombasa_off", "durban_off"],
  ["durban_off", "cape_good_hope"],
  // Direct Red Sea to Jeddah shortcut
  ["red_sea_m", "red_sea_n"],
];

function haversineDist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Find the nearest sea waypoint to a given coordinate */
function nearestWaypoint(pt: { lat: number; lng: number }): WP {
  let best = SEA_WAYPOINTS[0];
  let bestDist = Infinity;
  for (const wp of SEA_WAYPOINTS) {
    const d = haversineDist(pt, wp);
    if (d < bestDist) { bestDist = d; best = wp; }
  }
  return best;
}

/** Simple Dijkstra on the sea-lane graph to find shortest path between two waypoints */
function findSeaPath(startId: string, endId: string): WP[] {
  if (startId === endId) {
    const wp = SEA_WAYPOINTS.find(w => w.id === startId);
    return wp ? [wp] : [];
  }

  // Build adjacency list with distances
  const adj: Record<string, { id: string; dist: number }[]> = {};
  for (const wp of SEA_WAYPOINTS) adj[wp.id] = [];
  for (const [a, b] of SEA_LANES) {
    const wa = SEA_WAYPOINTS.find(w => w.id === a);
    const wb = SEA_WAYPOINTS.find(w => w.id === b);
    if (wa && wb) {
      const d = haversineDist(wa, wb);
      adj[a].push({ id: b, dist: d });
      adj[b].push({ id: a, dist: d });
    }
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const wp of SEA_WAYPOINTS) {
    dist[wp.id] = Infinity;
    prev[wp.id] = null;
  }
  dist[startId] = 0;

  while (true) {
    // Find unvisited node with smallest distance
    let u: string | null = null;
    let uDist = Infinity;
    for (const wp of SEA_WAYPOINTS) {
      if (!visited.has(wp.id) && dist[wp.id] < uDist) {
        u = wp.id;
        uDist = dist[wp.id];
      }
    }
    if (u === null || u === endId) break;
    visited.add(u);

    for (const neighbor of (adj[u] || [])) {
      const alt = dist[u] + neighbor.dist;
      if (alt < dist[neighbor.id]) {
        dist[neighbor.id] = alt;
        prev[neighbor.id] = u;
      }
    }
  }

  // Reconstruct path
  const path: WP[] = [];
  let cur: string | null = endId;
  while (cur) {
    const wp = SEA_WAYPOINTS.find(w => w.id === cur);
    if (wp) path.unshift(wp);
    cur = prev[cur];
  }

  return path.length > 0 && path[0].id === startId ? path : [];
}

/** Build a realistic sea-lane route between two coordinates */
function buildSeaRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  vesselPos?: { lat: number; lng: number } | null
): google.maps.LatLngLiteral[] {
  const directDist = haversineDist(origin, destination);

  // If ports are very close (< 300km), a direct line is fine (same body of water)
  if (directDist < 300) {
    const pts = [origin];
    if (vesselPos) pts.push(vesselPos);
    pts.push(destination);
    return pts;
  }

  const startWP = nearestWaypoint(origin);
  const endWP = nearestWaypoint(destination);

  // If both map to the same waypoint, just connect directly through it
  if (startWP.id === endWP.id) {
    const pts: google.maps.LatLngLiteral[] = [origin, { lat: startWP.lat, lng: startWP.lng }, destination];
    return pts;
  }

  const seaPath = findSeaPath(startWP.id, endWP.id);

  // If no path found, fall back to direct line
  if (seaPath.length === 0) {
    const pts = [origin];
    if (vesselPos) pts.push(vesselPos);
    pts.push(destination);
    return pts;
  }

  // Build full route: origin → sea waypoints → destination
  const route: google.maps.LatLngLiteral[] = [origin];

  // Only add waypoints that are between origin and destination (avoid backtracking)
  for (const wp of seaPath) {
    route.push({ lat: wp.lat, lng: wp.lng });
  }

  route.push(destination);
  return route;
}

function VesselMiniMap({
  vesselLat,
  vesselLng,
  portLoadName,
  portDischargeName,
}: {
  vesselLat: number;
  vesselLng: number;
  portLoadName?: string | null;
  portDischargeName?: string | null;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [routeDrawn, setRouteDrawn] = useState(false);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Add vessel marker
    const vesselMarkerEl = document.createElement("div");
    vesselMarkerEl.innerHTML = `<div style="
      width:32px;height:32px;border-radius:50%;
      background:linear-gradient(135deg,${C.forest},${C.sage});
      border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
    ">🚢</div>`;

    const vesselMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: vesselLat, lng: vesselLng },
      title: "Vessel Position",
      content: vesselMarkerEl,
    });
    markersRef.current.push(vesselMarker);

    // Geocode ports and draw realistic sea route
    if (portLoadName || portDischargeName) {
      const geocoder = new google.maps.Geocoder();

      const geocodePort = (name: string): Promise<google.maps.LatLngLiteral | null> => {
        return new Promise((resolve) => {
          geocoder.geocode({ address: `${name} port` }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
              geocoder.geocode({ address: name }, (results2, status2) => {
                if (status2 === "OK" && results2 && results2[0]) {
                  const loc = results2[0].geometry.location;
                  resolve({ lat: loc.lat(), lng: loc.lng() });
                } else {
                  resolve(null);
                }
              });
            }
          });
        });
      };

      (async () => {
        let originPt: google.maps.LatLngLiteral | null = null;
        let destPt: google.maps.LatLngLiteral | null = null;

        // Geocode origin port
        if (portLoadName) {
          originPt = await geocodePort(portLoadName);
          if (originPt) {
            const originEl = document.createElement("div");
            originEl.innerHTML = `<div style="
              padding:3px 8px;border-radius:12px;font-size:9px;font-weight:700;
              background:${C.forest};color:white;white-space:nowrap;
              box-shadow:0 2px 6px rgba(0,0,0,.2);
            ">📍 ${portLoadName}</div>`;
            const originMarker = new google.maps.marker.AdvancedMarkerElement({
              map, position: originPt, title: `POL: ${portLoadName}`, content: originEl,
            });
            markersRef.current.push(originMarker);
          }
        }

        // Geocode destination port
        if (portDischargeName) {
          destPt = await geocodePort(portDischargeName);
          if (destPt) {
            const destEl = document.createElement("div");
            destEl.innerHTML = `<div style="
              padding:3px 8px;border-radius:12px;font-size:9px;font-weight:700;
              background:${C.terra};color:white;white-space:nowrap;
              box-shadow:0 2px 6px rgba(0,0,0,.2);
            ">🏁 ${portDischargeName}</div>`;
            const destMarker = new google.maps.marker.AdvancedMarkerElement({
              map, position: destPt, title: `POD: ${portDischargeName}`, content: destEl,
            });
            markersRef.current.push(destMarker);
          }
        }

        // Build and draw realistic sea-lane route
        const vesselPos = { lat: vesselLat, lng: vesselLng };

        if (originPt && destPt) {
          // Full route: origin → waypoints → destination, with vessel marker
          const seaRoute = buildSeaRoute(originPt, destPt, vesselPos);

          // Draw the completed portion (origin to vessel) as solid
          // and remaining portion (vessel to destination) as dashed
          // For simplicity, draw the full sea route as one polyline
          polylineRef.current = new google.maps.Polyline({
            path: seaRoute,
            geodesic: false, // We handle routing ourselves
            strokeColor: "#FF6B00",
            strokeOpacity: 0.9,
            strokeWeight: 3.5,
            icons: [{
              icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5, strokeColor: "#FF6B00" },
              offset: "50%",
            }],
            map,
          });

          // Fit bounds to show all route points
          const bounds = new google.maps.LatLngBounds();
          seaRoute.forEach(p => bounds.extend(p));
          bounds.extend(vesselPos);
          map.fitBounds(bounds, 40);
          setRouteDrawn(true);
        } else if (originPt || destPt) {
          // Only one port geocoded — draw simple line through vessel
          const pts: google.maps.LatLngLiteral[] = [];
          if (originPt) pts.push(originPt);
          pts.push(vesselPos);
          if (destPt) pts.push(destPt);

          polylineRef.current = new google.maps.Polyline({
            path: pts,
            geodesic: true,
            strokeColor: "#FF6B00",
            strokeOpacity: 0.9,
            strokeWeight: 3.5,
            icons: [{
              icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5, strokeColor: "#FF6B00" },
              offset: "50%",
            }],
            map,
          });

          const bounds = new google.maps.LatLngBounds();
          pts.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, 40);
          setRouteDrawn(true);
        }
      })();
    }
  }, [vesselLat, vesselLng, portLoadName, portDischargeName]);

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <MapView
        className="vessel-mini-map"
        initialCenter={{ lat: vesselLat, lng: vesselLng }}
        initialZoom={5}
        mapTypeId="satellite"
        onMapReady={handleMapReady}
      />
      <style>{`.vessel-mini-map { height: 220px !important; min-height: 220px !important; }`}</style>
      {/* Route legend overlay */}
      {routeDrawn && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, padding: "4px 10px",
          background: "rgba(255,255,255,.92)", borderRadius: 6, fontSize: 9,
          display: "flex", gap: 10, alignItems: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,.15)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.forest, display: "inline-block" }} />
            POL
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 16, height: 2, background: "#FF6B00", display: "inline-block" }} />
            Route
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.terra, display: "inline-block" }} />
            POD
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function OdooVesselRoute({
  shipment,
  type = "purchase",
}: {
  shipment: OdooShipmentData;
  type?: "purchase" | "sales";
}) {
  // ─── AIS Data ───────────────────────────────────────────────────────────
  const [vesselSearchQuery] = useState(() => shipment.vesselName?.trim() || "");
  const [showAis, setShowAis] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const vesselSearch = trpc.vesselTracking.searchWithPosition.useQuery(
    { keyword: vesselSearchQuery },
    {
      enabled: vesselSearchQuery.length >= 2,
      staleTime: 10 * 60 * 1000,
      retry: 1,
    }
  );

  const aisData = vesselSearch.data;
  const aisLoading = vesselSearch.isLoading && vesselSearchQuery.length >= 2;
  const hasAis = !!aisData && (aisData.latitude != null || aisData.speed != null);
  const hasPosition = !!aisData && aisData.latitude != null && aisData.longitude != null;

  // ─── Dates ──────────────────────────────────────────────────────────────
  const etdDate = parseDate(shipment.etd);
  const etaDate = parseDate(shipment.eta);
  const now = new Date();

  const transitDays = shipment.transitTimeDays
    || (etdDate && etaDate ? Math.round((etaDate.getTime() - etdDate.getTime()) / 86400000) : null);
  const daysPassed = etdDate ? Math.max(0, Math.round((now.getTime() - etdDate.getTime()) / 86400000)) : null;
  const daysLeft = etaDate ? Math.round((etaDate.getTime() - now.getTime()) / 86400000) : null;

  // ─── Time-based Progress ────────────────────────────────────────────────
  const timeProgress = useMemo(() => calcTimeProgress(etdDate, etaDate), [etdDate, etaDate]);
  const progress = timeProgress != null ? Math.max(0, Math.min(1, timeProgress)) : 0;

  // ─── Port Names ─────────────────────────────────────────────────────────
  const originPort = shipment.portLoad || "Origin";
  const destPort = useMemo(() => {
    if (shipment.portDischarge) return shipment.portDischarge;
    if (aisData?.destination) return aisData.destination;
    return "Destination";
  }, [shipment.portDischarge, aisData?.destination]);

  // ─── AIS speed ──────────────────────────────────────────────────────────
  const aisSpeed = aisData?.speed != null ? aisData.speed / 10 : null;
  const isMoving = aisSpeed != null ? aisSpeed > 0.5 : progress > 0.02 && progress < 0.98;

  // ─── Status label ───────────────────────────────────────────────────────
  const statusLabel = useMemo(() => {
    if (progress >= 1) return "Arrived";
    if (progress <= 0 && etdDate && now < etdDate) return "Not Departed";
    if (progress <= 0) return "Pending";
    if (hasAis && aisSpeed != null && aisSpeed < 0.3) return "At Anchor";
    return "En Route";
  }, [progress, etdDate, now, hasAis, aisSpeed]);

  // ─── Vessel icon position ───────────────────────────────────────────────
  const showVessel = progress > 0.01 && progress < 0.99;
  const vesselPct = progress * 100;

  return (
    <Card p={0}>
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <CardHdr gradient>
        <CHT>⟶ Vessel Route</CHT>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {shipment.vesselName && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.95)", fontWeight: 700, letterSpacing: 0.3 }}>
              {shipment.vesselName}
            </span>
          )}
          {shipment.shippingLine && (
            <span style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 4,
              background: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.8)", fontWeight: 600,
            }}>
              {shipment.shippingLine.toUpperCase()}
            </span>
          )}
          {/* AIS badge */}
          {vesselSearchQuery.length >= 2 && (
            <span style={{
              fontSize: 9, padding: "3px 10px", borderRadius: 12,
              background: aisLoading ? "rgba(255,200,50,.3)" : hasAis ? "rgba(100,255,150,.25)" : "rgba(255,255,255,.1)",
              color: "rgba(255,255,255,.9)", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: aisLoading ? "#FFD700" : hasAis ? "#66FF99" : "#888",
                display: "inline-block",
                animation: aisLoading ? "pulse 1.2s infinite" : hasAis ? "pulse 3s infinite" : "none",
              }} />
              {aisLoading ? "Fetching AIS..." : hasAis ? "AIS Live" : "No AIS"}
            </span>
          )}
        </div>
      </CardHdr>

      <div style={{ padding: "20px 24px 16px" }}>
        {/* ─── Route Visualization ────────────────────────────────────── */}
        <div style={{ position: "relative", margin: "0 60px" }}>
          {/* Ship icon row */}
          <div style={{ position: "relative", height: showVessel ? 60 : 10 }}>
            {showVessel && (
              <div style={{
                position: "absolute",
                left: `${vesselPct}%`,
                bottom: 0,
                transform: "translateX(-50%)",
                zIndex: 10,
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <div style={{
                  marginBottom: 4, textAlign: "center",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                }}>
                  {hasAis && aisSpeed != null && (
                    <span style={{
                      fontSize: 10, color: aisSpeed > 0.5 ? C.sage : C.muted,
                      fontFamily: FONT, fontWeight: 700, whiteSpace: "nowrap",
                      letterSpacing: 0.3,
                    }}>
                      {aisSpeed.toFixed(1)} kn
                    </span>
                  )}
                  {daysLeft != null && daysLeft > 0 && (
                    <span style={{
                      fontSize: 9, color: C.terra,
                      fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {daysLeft}d left
                    </span>
                  )}
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.forest}, ${C.sage})`,
                  border: `3px solid ${C.white}`,
                  boxShadow: `0 3px 12px rgba(45,90,61,.45)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: isMoving ? "vesselBob 3s ease-in-out infinite" : "none",
                }}>
                  <ShipIcon size={18} color="#fff" />
                </div>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
                  borderTop: `5px solid ${C.forest}`, marginTop: -1,
                }} />
              </div>
            )}
          </div>

          {/* Track line row */}
          <div style={{ position: "relative", height: 4 }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: 4, background: C.border, borderRadius: 3,
            }} />
            <div style={{
              position: "absolute", top: 0, left: 0,
              width: `${progress * 100}%`, height: 4,
              background: `linear-gradient(90deg, ${C.forest}, ${C.sage})`,
              borderRadius: 3, transition: "width .8s ease",
            }} />
            <div style={{
              position: "absolute", left: 0, top: "50%", transform: "translate(-50%, -50%)",
              width: 16, height: 16, borderRadius: "50%",
              background: progress > 0 ? C.forest : C.card,
              border: `2.5px solid ${progress > 0 ? C.forest : C.border}`,
              zIndex: 3, boxShadow: progress > 0 ? `0 0 0 3px rgba(45,90,61,.15)` : "none",
            }} />
            <div style={{
              position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
              width: 8, height: 8, borderRadius: "50%",
              background: progress >= 0.5 ? C.sage : C.card,
              border: `2px solid ${progress >= 0.5 ? C.sage : C.border}`,
              zIndex: 3,
            }} />
            <div style={{
              position: "absolute", right: 0, top: "50%", transform: "translate(50%, -50%)",
              width: 16, height: 16, borderRadius: "50%",
              background: progress >= 0.98 ? C.forest : C.card,
              border: `2.5px solid ${progress >= 0.98 ? C.forest : C.border}`,
              zIndex: 3, boxShadow: progress >= 0.98 ? `0 0 0 3px rgba(45,90,61,.15)` : "none",
            }} />
          </div>

          {/* Labels row */}
          <div style={{ position: "relative", marginTop: 10 }}>
            <div style={{
              position: "absolute", left: 0, top: 0, transform: "translateX(-50%)",
              textAlign: "center", width: 140,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: progress > 0 ? C.dark : C.muted }}>
                {originPort}
              </div>
              {etdDate && (
                <div style={{ fontSize: 10, fontFamily: FONT, color: C.forest, marginTop: 2, fontWeight: 600 }}>
                  ETD {fmtDate(etdDate)}
                </div>
              )}
            </div>
            <div style={{
              position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)",
              textAlign: "center", width: 100,
            }}>
              <div style={{
                fontSize: 9, color: progress >= 0.5 ? C.sage : C.muted, fontWeight: 600,
              }}>
                {statusLabel}
              </div>
            </div>
            <div style={{
              position: "absolute", right: 0, top: 0, transform: "translateX(50%)",
              textAlign: "center", width: 140,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: progress >= 0.98 ? C.dark : C.muted }}>
                {destPort}
              </div>
              {(etaDate || (hasAis && aisData?.eta)) && (
                <div style={{
                  fontSize: 10, fontFamily: FONT,
                  color: progress >= 0.98 ? C.forest : C.terra,
                  marginTop: 2, fontWeight: 600,
                }}>
                  ETA {fmtDate(etaDate) !== "—" ? fmtDate(etaDate) : formatAisEta(aisData?.eta)}
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 40 }} />
        </div>

        {/* ─── Stats Bar ──────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8,
          marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.border}`,
        }}>
          {[
            transitDays ? { l: "Transit Time", v: `${transitDays} days` } : null,
            daysPassed != null && daysPassed > 0 ? { l: "Days Sailed", v: String(daysPassed), c: C.sage } : null,
            daysLeft != null ? { l: daysLeft > 0 ? "Days Remaining" : "Arrived", v: daysLeft > 0 ? `${daysLeft} days` : "✓", c: daysLeft > 0 ? C.terra : C.forest } : null,
          ].filter(Boolean).map((item) => (
            <div key={item!.l} style={{ textAlign: "center" }}>
              <Lbl>{item!.l}</Lbl>
              <Val color={item!.c}>{item!.v}</Val>
            </div>
          ))}
        </div>

        {/* ─── AIS Live Position Section ──────────────────────────────── */}
        {hasAis && (
          <div style={{ marginTop: 12 }}>
            <div
              onClick={() => setShowAis(!showAis)}
              style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "8px 12px", userSelect: "none",
                background: C.gBg, borderRadius: showAis ? "8px 8px 0 0" : 8,
                border: `1px solid ${C.gBdr}`,
                transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.gBg2}
              onMouseLeave={e => e.currentTarget.style.background = C.gBg}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: "#4CAF50",
                animation: "pulse 2s infinite",
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700, color: C.forest,
                textTransform: "uppercase", letterSpacing: 0.8,
              }}>
                AIS Live Position
              </span>
              <span style={{ fontSize: 9, color: C.muted }}>
                Updated {formatAisTimestamp(aisData!.receivedDateTime)}
              </span>
              {aisData!.destination && (
                <span style={{ fontSize: 9, color: C.sage, fontWeight: 600, marginLeft: 4 }}>
                  → {aisData!.destination}
                </span>
              )}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{
                marginLeft: "auto",
                transform: showAis ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .2s",
              }}>
                <path d="M1 1L5 5L9 1" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {showAis && (
              <div style={{
                padding: "12px 14px", background: C.gBg,
                borderRadius: "0 0 8px 8px",
                borderLeft: `1px solid ${C.gBdr}`,
                borderRight: `1px solid ${C.gBdr}`,
                borderBottom: `1px solid ${C.gBdr}`,
              }}>
                {/* AIS Data Grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
                  marginBottom: hasPosition ? 12 : 0,
                }}>
                  {hasPosition && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Position</Lbl>
                      <div style={{ fontSize: 10 }}>
                        <a
                          href={`https://www.google.com/maps?q=${aisData!.latitude!.toFixed(6)},${aisData!.longitude!.toFixed(6)}&z=8`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: MONO, fontWeight: 600, color: C.forest,
                            textDecoration: "underline", textUnderlineOffset: 2,
                            cursor: "pointer",
                          }}
                          title="Open in Google Maps"
                        >
                          {aisData!.latitude!.toFixed(4)}°, {aisData!.longitude!.toFixed(4)}°
                        </a>
                      </div>
                    </div>
                  )}
                  {aisData!.speed != null && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Speed</Lbl>
                      <Val mono color={aisData!.speed! > 0 ? C.sage : C.muted}>
                        {(aisData!.speed! / 10).toFixed(1)} kn
                      </Val>
                    </div>
                  )}
                  {aisData!.course != null && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Course</Lbl>
                      <Val mono>{(aisData!.course! / 10).toFixed(1)}°</Val>
                    </div>
                  )}
                  {aisData!.heading != null && aisData!.heading !== 511 && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Heading</Lbl>
                      <Val mono>{aisData!.heading}°</Val>
                    </div>
                  )}
                  {aisData!.destination && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>AIS Destination</Lbl>
                      <div style={{ fontSize: 10 }}><Val mono color={C.forest}>{aisData!.destination}</Val></div>
                    </div>
                  )}
                  {aisData!.eta && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>AIS ETA</Lbl>
                      <div style={{ fontSize: 10 }}><Val mono color={C.terra}>{formatAisEta(aisData!.eta)}</Val></div>
                    </div>
                  )}
                  {aisData!.draught != null && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Draught</Lbl>
                      <Val mono>{(aisData!.draught! / 10).toFixed(1)} m</Val>
                    </div>
                  )}
                  {aisData!.flag && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Flag</Lbl>
                      <Val mono>{aisData!.flag}</Val>
                    </div>
                  )}
                  {aisData!.length != null && aisData!.width != null && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Dimensions</Lbl>
                      <Val mono>{aisData!.length}m × {aisData!.width}m</Val>
                    </div>
                  )}
                  {/* MMSI — clickable to MarineTraffic */}
                  {aisData!.mmsi && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>MMSI</Lbl>
                      <div style={{ fontSize: 10 }}>
                        <a
                          href={`https://www.marinetraffic.com/en/ais/details/ships/${aisData!.mmsi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: MONO, fontWeight: 600, color: C.forest,
                            textDecoration: "underline", textUnderlineOffset: 2,
                            cursor: "pointer",
                          }}
                          title="View on MarineTraffic"
                        >
                          {aisData!.mmsi} ↗
                        </a>
                      </div>
                    </div>
                  )}
                  {/* IMO — clickable to VesselFinder */}
                  {aisData!.imoNo && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>IMO</Lbl>
                      <div style={{ fontSize: 10 }}>
                        <a
                          href={`https://www.vesselfinder.com/vessels/details/${aisData!.imoNo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: MONO, fontWeight: 600, color: C.terra,
                            textDecoration: "underline", textUnderlineOffset: 2,
                            cursor: "pointer",
                          }}
                          title="View on VesselFinder"
                        >
                          {aisData!.imoNo} ↗
                        </a>
                      </div>
                    </div>
                  )}
                  {aisData!.callSign && (
                    <div style={{ textAlign: "center" }}>
                      <Lbl>Call Sign</Lbl>
                      <div style={{ fontSize: 10 }}><Val mono>{aisData!.callSign}</Val></div>
                    </div>
                  )}
                </div>

                {/* ─── Mini-Map with vessel pin and route ──────────────── */}
                {hasPosition && (
                  <div style={{ marginTop: 4 }}>
                    <div
                      onClick={() => setShowMap(!showMap)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                        padding: "6px 10px", background: C.gBg2, borderRadius: showMap ? "6px 6px 0 0" : 6,
                        border: `1px solid ${C.gBdr}`, userSelect: "none",
                      }}
                    >
                      <span style={{ fontSize: 12 }}>🗺️</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.forest }}>
                        {showMap ? "Hide Map" : "Show Vessel on Map"}
                      </span>
                      <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>
                        with route POL → POD
                      </span>
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{
                        marginLeft: "auto",
                        transform: showMap ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform .2s",
                      }}>
                        <path d="M1 1L5 5L9 1" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    {showMap && (
                      <div style={{
                        borderLeft: `1px solid ${C.gBdr}`,
                        borderRight: `1px solid ${C.gBdr}`,
                        borderBottom: `1px solid ${C.gBdr}`,
                        borderRadius: "0 0 6px 6px",
                        overflow: "hidden",
                      }}>
                        <VesselMiniMap
                          vesselLat={aisData!.latitude!}
                          vesselLng={aisData!.longitude!}
                          portLoadName={shipment.portLoad}
                          portDischargeName={shipment.portDischarge}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes vesselBob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
      `}</style>
    </Card>
  );
}
