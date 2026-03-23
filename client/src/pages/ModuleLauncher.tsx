import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { SystemUserMgmt } from "./SystemUserMgmt";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

/* ═══ Alfalfa Bale Icon (double press) ═══ */
const AlfalfaBaleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="3" y1="14" x2="21" y2="14" />
    <line x1="8" y1="6" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="18" />
  </svg>
);

const modules=[{id:"purchase",title:"Purchase & Sales Shipments",desc:"Manage purchase orders, sales orders, shipments, loads, agreements, and track vessels across all companies.",active:true,route:"/dashboard",iconBg:"#1B3A2D",heroBg:"#1B3A2D",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h17.25M3.375 14.25V6.75A1.125 1.125 0 0 1 4.5 5.625h6.75a1.125 1.125 0 0 1 1.125 1.125v7.5m-12 0h12m0 0h5.625a1.125 1.125 0 0 1 1.125 1.125v1.5"/></svg>},{id:"production",title:"Double Press Production",desc:"Manage double pressing manufacturing orders, track shift operations, input/output materials, workforce, machine performance, and diesel consumption.",active:true,route:"/production",iconBg:"#7A5210",heroBg:"#7A5210",iconColor:"#fff",icon:<AlfalfaBaleIcon />},{id:"documents",title:"Quotation & Invoicing",desc:"Create professional quotations, invoices, and payment receipts with live preview and PDF export.",active:true,route:"/documents",iconBg:"#6B3D2A",heroBg:"#6B3D2A",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>},{id:"investments",title:"Investors Relationship Management",desc:"Manage investor relationships, prepare investment proposals, track investment cycles through CRM pipeline, and generate Murabaha contracts.",active:true,route:"/investments",iconBg:"#3D1F3F",heroBg:"#3D1F3F",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>},{id:"supplychain",title:"Supply Chain Financials",desc:"Full chain costing calculator with facility financials, export analysis, shipment P&L, breakeven charts, and logistics comparison.",active:true,route:"/supply-chain",iconBg:"#0F3D52",heroBg:"#0F3D52",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/></svg>},{id:"hr",title:"Human Resources",desc:"Employee management, attendance, payroll, and leave tracking.",active:true,route:"/hr",iconBg:"#2E3A4A",heroBg:"#2E3A4A",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>},{id:"dms",title:"Document Management",desc:"Centralized document storage, folder management, tagging, and file sharing integrated with Odoo Documents.",active:true,route:"/dms",iconBg:"#1E4D5A",heroBg:"#1E4D5A",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"/></svg>},{id:"accounting",title:"Finance",desc:"Financial health scorecard, cash overview, receivables, payables, expenses, expenditure analysis, SOA, export fees, and inventory valuation.",active:true,route:"/finance",iconBg:"#1A3A28",heroBg:"#1A3A28",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>},{id:"operations",title:"Operations Dashboard",desc:"Facility operations analytics: supply chain, quality, production output, export shipments, and logistics cost monitoring.",active:true,route:"/operations",iconBg:"#3A5A4A",heroBg:"#3A5A4A",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"/></svg>},{id:"inventory",title:"Inventory & Warehouse",desc:"Stock management, warehouse operations, and inventory tracking.",active:true,route:"/inventory",iconBg:"#2D5040",heroBg:"#2D5040",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>},{id:"meetings",title:"Periodic Meetings",desc:"Track and manage periodic meetings, monitor weekly attendance, view meeting history, and link attendance records to employee incentive calculations.",active:true,route:"/meetings",iconBg:"#1B3A4A",heroBg:"#1B3A4A",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></svg>},{id:"offline-ops",title:"Offline Operations",desc:"Field submissions dashboard: procurement receipts, quality reports, pressing shifts, and Dakhla-Sokhna transfers with sync status tracking.",active:true,route:"/offline-ops",iconBg:"#2C3E50",heroBg:"#2C3E50",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>},{id:"pce",title:"Petty Cash & Expenses",desc:"Manage petty cash balances, top-up requests, expense deductions, and employee reminders.",active:true,route:"/pce",iconBg:"#C0714A",heroBg:"#C0714A",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>},{id:"crm",title:"CRM",desc:"Customer relationship management, leads, and sales pipeline.",active:false,iconBg:"rgba(78,119,94,0.12)",heroBg:"#4e775e",iconColor:"#4e775e",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>},{id:"reports",title:"Reports & Analytics",desc:"Business intelligence, custom reports, and data analytics.",active:false,iconBg:"rgba(70,50,100,0.12)",heroBg:"#3A2A5C",iconColor:"#7B5EA7",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>},{id:"property-mgmt",title:"Property Management",desc:"Track your real estate portfolio across UAE and Egypt. Manage payment schedules, rental contracts, delivery status, and market values.",active:true,route:"/property-mgmt",iconBg:"#2D5A3D",heroBg:"#2D5A3D",iconColor:"#fff",icon:<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>}];

const features: Record<string, string[]> ={purchase:["Purchase Orders","Sales Orders","Shipment Tracking","Vessel Monitoring","Agreements"],production:["Manufacturing Orders","Shift Operations","Input/Output Tracking","Machine Performance","Workforce Management","Diesel Logging"],documents:["Quotations","Invoices","Payment Receipts","PDF Export","Saved Documents"],investments:["Investment Proposals","Murabaha Contracts","Investment Cycles","CRM Pipeline","Deal Tracking","PDF Export"],supplychain:["Facility Financials","Sokhna Export Analysis","Dakhla Export Analysis","Egypt Shipment P&L","International Shipments P&L"],accounting:["Financial Health","Cash Overview","Receivables","Payables","Expenses","Expenditure","SOA","Export Fees","Inventory Valuation"],operations:["Supply Chain","Quality Analytics","Production Output","Export Shipments","Logistics & Costs","Machine Monitoring"],inventory:["Stock Levels","Warehouse Ops","Transfers","Batch Tracking","Reorder Rules"],crm:["Lead Pipeline","Contacts","Opportunities","Activity Log","Email Integration"],hr:["Employee Directory","Attendance & Check-in","Leave Management","Bonus & Fines","Payroll & Payslips","Add Employee Wizard"],meetings:["Weekly Meetings","Attendance Tracking","Monthly Summary","Company Filter","Incentive Integration","Meeting History"],dms:["Workspace Management","Folder Tree Navigation","File Upload & Download","Tag-based Filtering","Document Search","Favorites & Locking"],reports:["Dashboards","Custom Reports","Exports","Scheduled Reports","KPI Tracking"],"offline-ops":["Procurement Receipts","Quality Reports","Pressing Shifts","Dakhla-Sokhna Transfers","Sync Dashboard","Period Filtering"],pce:["Employee Balances","Top-Up Requests","Expense Deductions","Confirm & Track","Reminders","Company Filtering"],"property-mgmt":["Property Portfolio","Payment Schedules","Upcoming Payments","Delivery Tracking","Rental Contracts","Market Value"]};;

// PlatfarmLogo is now imported from @/components/PlatfarmLogo
// Old local definition removed (had incorrect DFPLENERS text paths)

// ─── Helper: get user initials ───────────────────────────────────────────────
function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Helper: get greeting based on time ─────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Helper: format today's date ─────────────────────────────────────────────
function formatToday() {
  return new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function ModuleLauncher() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout: authLogout } = useAuth();

  // Skip login if user has already signed in this session
  const [phase, setPhase] = useState(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('platfarm_signed_in')) {
      return 'portal';
    }
    return 'login';
  });
  const [selectedId, setSelectedId] = useState("purchase");
  const [animKey, setAnimKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState("");
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  // Track whether we have already entered the portal so card keys stay stable
  const portalEntryAnimKey = useRef(0);

  // ─── Permissions ────────────────────────────────────────────────────────────
  const { data: permsData } = trpc.userMgmt.myPermissions.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // Build a set of accessible module IDs
  const accessibleModuleIds = useMemo(() => {
    if (!permsData) return null; // null = still loading
    if (permsData.isAdmin) return new Set(modules.map(m => m.id)); // admin = all
    return new Set(permsData.permissions.filter(p => p.canView === 1).map(p => p.moduleId));
  }, [permsData]);

  const canAccessModule = useCallback((moduleId: string) => {
    if (!accessibleModuleIds) return true; // loading: show all
    return accessibleModuleIds.has(moduleId);
  }, [accessibleModuleIds]);

  const isAdmin = useMemo(() => user?.role === "admin", [user]);

  const showLogin = ["login","login-exit","morph-expand","morph-settle-rev","login-enter"].includes(phase);
  const showPortal = ["portal","portal-exit","morph-expand-rev","morph-settle","portal-enter"].includes(phase);
  const busy = !["login","portal"].includes(phase);

  // Auto-enter portal if already authenticated, or redirect to /login if not
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && phase === 'login') {
      sessionStorage.setItem('platfarm_signed_in', '1');
      setPhase('portal');
    } else if (!isAuthenticated && phase === 'login') {
      // Redirect to custom email/password login page
      window.location.href = '/login';
    }
  }, [authLoading, isAuthenticated, phase]);

  const handleLogin = useCallback(() => {
    if (busy) return;
    // Redirect to custom email/password login page
    window.location.href = '/login';
  }, [busy]);

  const handleLogout = useCallback(async () => {
    if (busy) return;
    setMenuOpen(false);
    sessionStorage.removeItem('platfarm_signed_in');
    // Call real logout: clears the session cookie and redirects to /login
    await authLogout();
  }, [busy, authLogout]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuOpen && !(e.target as HTMLElement).closest(".avatar-wrapper")) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const selected = modules.find((m) => m.id === selectedId)!;
  const allOthers = modules.filter((m) => m.id !== selectedId);
  const others = moduleSearch.trim()
    ? allOthers.filter((m) => m.title.toLowerCase().includes(moduleSearch.trim().toLowerCase()))
    : allOthers;
  const handleSelect = (id: string) => { if (id !== selectedId && !busy) { setSelectedId(id); setAnimKey((k) => k + 1); } };
  const stableCardKey = `${selectedId}-${animKey}`;

  const morphClass = (() => {
    switch (phase) {
      case "morph-expand": return "morph morph-full";
      case "morph-settle": return "morph morph-full morph-to-topbar";
      case "portal-enter": return "morph morph-topbar-done";
      case "morph-expand-rev": return "morph morph-full";
      case "morph-settle-rev": return "morph morph-full morph-to-left";
      case "login-enter": return "morph morph-left-done";
      default: return "";
    }
  })();

  // Show loading screen while auth is resolving to prevent flash of landing page
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1B3A2D", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <PlatfarmLogo height={44} treeColor="rgba(255,255,255,0.85)" textColor="#D4845F" />
          <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.7)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // If UserMgmt panel is open, render it full-screen
  if (showUserMgmt) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <SystemUserMgmt onBack={() => setShowUserMgmt(false)} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F5F2ED", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <style>{`
        
        * { margin: 0; padding: 0; box-sizing: border-box; }

        /* ═══ MORPH OVERLAY ═══ */
        .morph { position: fixed; z-index: 9999; background: #1B3A2D; display: flex; align-items: center; justify-content: center; pointer-events: all; }
        .morph .morph-logo { opacity: 0; transform: scale(0.7); transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1); }

        .morph.morph-full { inset: 0; transition: none; }
        .morph.morph-full .morph-logo { opacity: 1; transform: scale(1); transition: opacity 0.3s ease 0.2s, transform 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s; }

        .morph.morph-to-topbar { inset: 0; animation: morphToTopbar 0.65s cubic-bezier(0.16,1,0.3,1) forwards; }
        .morph.morph-to-topbar .morph-logo { opacity: 0; transform: scale(0.6) translateY(-30px); transition: opacity 0.15s ease, transform 0.15s ease; }
        @keyframes morphToTopbar { 0% { inset: 0; } 100% { top: 0; left: 0; right: 0; bottom: calc(100% - 60px); } }

        .morph.morph-topbar-done { top: 0; left: 0; right: 0; height: 60px; opacity: 0; pointer-events: none; }

        .morph.morph-to-left { inset: 0; animation: morphToLeft 0.65s cubic-bezier(0.16,1,0.3,1) forwards; }
        .morph.morph-to-left .morph-logo { opacity: 0; transform: scale(0.6); transition: opacity 0.15s ease, transform 0.15s ease; }
        @keyframes morphToLeft { 0% { inset: 0; } 100% { top: 0; left: 0; right: 50%; bottom: 0; } }

        .morph.morph-left-done { top: 0; left: 0; width: 50%; height: 100%; opacity: 0; pointer-events: none; }

        /* ═══ LOGIN ═══ */
        .login-wrapper { min-height: 100vh; display: flex; }
        .login-brand { flex: 1; background: #1B3A2D; display: flex; flex-direction: column; justify-content: space-between; padding: 48px; position: relative; overflow: hidden; }
        .login-brand::before { content: ''; position: absolute; top: -30%; right: -20%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(122,158,126,0.12) 0%, transparent 60%); pointer-events: none; }
        .login-brand::after { content: ''; position: absolute; bottom: -20%; left: -10%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(196,112,75,0.08) 0%, transparent 60%); pointer-events: none; }
        .brand-content { position: relative; z-index: 1; margin-top: 80px; }
        .brand-tagline { font-size: 36px; font-weight: 300; color: white; line-height: 1.3; letter-spacing: -0.5px; max-width: 380px; margin-top: 48px; }
        .brand-tagline strong { font-weight: 700; color: #A8C5AB; }
        .brand-features { display: flex; flex-direction: column; gap: 16px; margin-top: 48px; }
        .brand-feature { display: flex; align-items: center; gap: 14px; }
        .brand-feature .feat-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(168,197,171,0.5); flex-shrink: 0; }
        .brand-feature span { font-size: 14px; color: rgba(255,255,255,0.5); letter-spacing: 0.2px; }
        .brand-footer { position: relative; z-index: 1; font-size: 12px; color: rgba(255,255,255,0.25); }

        /* Login form stagger */
        .le { transition: opacity 0.4s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1); }
        .phase-login .le { opacity: 1; transform: translateY(0); }
        .phase-login .le:nth-child(1) { transition-delay: 0.02s; }
        .phase-login .le:nth-child(2) { transition-delay: 0.06s; }
        .phase-login .le:nth-child(3) { transition-delay: 0.10s; }
        .phase-login .le:nth-child(4) { transition-delay: 0.14s; }
        .phase-login .le:nth-child(5) { transition-delay: 0.18s; }
        .phase-login-exit .le { opacity: 0 !important; transform: translateY(24px) !important; transition: opacity 0.2s ease, transform 0.25s ease; }
        .phase-login-enter .le { opacity: 0; transform: translateY(24px); transition: none; }

        .login-form-panel { width: 480px; min-width: 480px; display: flex; flex-direction: column; justify-content: center; padding: 60px; background: #FAF8F5; }
        .form-header { margin-bottom: 36px; }
        .form-header h2 { font-size: 24px; font-weight: 700; color: #1B3A2D; letter-spacing: -0.4px; margin-bottom: 8px; }
        .form-header p { font-size: 14px; color: #99A09C; }
        .login-btn { width: 100%; height: 50px; border: none; border-radius: 11px; background: #1B3A2D; color: white; font-family: 'DM Sans', system-ui, sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .login-btn:hover { background: #24503C; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(27,58,45,0.2); }
        .login-btn svg { width: 18px; height: 18px; transition: transform 0.25s; }
        .login-btn:hover svg { transform: translateX(3px); }

        /* ═══ PORTAL STAGGER ═══ */
        .pe { transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .phase-portal .pe { opacity: 1; transform: translateY(0); }
        .phase-portal-enter .pe { opacity: 0; transform: translateY(30px); }
        .phase-portal-enter .pe:nth-child(1) { opacity: 1; transform: translateY(0); transition: none; }
        .phase-portal-enter .pe:nth-child(2) { transition-delay: 0.1s; }
        .phase-portal-enter .pe:nth-child(3) { transition-delay: 0.22s; }
        .phase-portal-exit .pe { opacity: 0 !important; transform: translateY(-20px) !important; transition: opacity 0.2s ease, transform 0.25s ease; }
        .phase-portal-exit .pe:nth-child(1) { opacity: 1 !important; transform: translateY(0) !important; transition: none; }
        .phase-portal-exit .pe:nth-child(3) { transition-delay: 0s; }
        .phase-portal-exit .pe:nth-child(2) { transition-delay: 0.06s; }

        /* ═══ PORTAL STYLES ═══ */
        @keyframes heroIn { 0% { opacity: 0; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes heroContentIn { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes tagStagger { 0% { opacity: 0; transform: translateY(6px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes smallCardIn { 0% { opacity: 0; transform: translateY(8px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(122,158,126,0.3); } 50% { box-shadow: 0 0 0 4px rgba(122,158,126,0.08); } }
        .hero-card { animation: heroIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .hero-content { animation: heroContentIn 0.35s ease-out 0.1s both; }
        .feature-tag-anim { animation: tagStagger 0.3s ease-out both; }
        .small-card-anim { animation: smallCardIn 0.35s cubic-bezier(0.16,1,0.3,1) both; }
        .open-btn { display: inline-flex; align-items: center; gap: 10px; padding: 13px 28px; background: #C4704B; color: white; border: none; border-radius: 10px; font-family: 'DM Sans', system-ui, sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.25s; }
        .open-btn:hover { background: #D4845F; transform: translateX(2px); box-shadow: 0 4px 16px rgba(196,112,75,0.25); }
        .open-btn svg { transition: transform 0.25s; }
        .open-btn:hover svg { transform: translateX(3px); }
        .small-card { background: #FFF; border: 1.5px solid rgba(27,58,45,0.08); border-radius: 14px; padding: 16px 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.25,0.46,0.45,0.94); display: flex; align-items: center; gap: 16px; position: relative; overflow: hidden; }
        .small-card:hover { border-color: rgba(27,58,45,0.2); box-shadow: 0 6px 20px rgba(27,58,45,0.07); transform: translateY(-2px); }
        .small-card.is-active::after { content: ''; position: absolute; top: 12px; right: 12px; width: 7px; height: 7px; border-radius: 50%; background: #7A9E7E; animation: pulseGlow 2.5s ease-in-out infinite; }
        .small-card.is-soon { background: #FAF8F5; }
        .small-card.is-soon .sm-title, .small-card.is-soon .sm-desc { opacity: 0.5; }
        .small-card.is-soon .sm-icon svg { opacity: 0.4; }
        .small-card.is-locked { background: #FAF8F5; cursor: default; }
        .small-card.is-locked .sm-title, .small-card.is-locked .sm-desc { opacity: 0.4; }
        .small-card.is-locked .sm-icon svg { opacity: 0.3; }
        .small-card.is-locked:hover { transform: none; box-shadow: none; border-color: rgba(27,58,45,0.08); }
        .soon-badge-sm { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.7px; color: #99A09C; padding: 3px 8px; background: rgba(27,58,45,0.04); border-radius: 5px; position: absolute; top: 12px; right: 12px; }
        .locked-badge-sm { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.7px; color: #C94444; padding: 3px 8px; background: rgba(201,68,68,0.06); border-radius: 5px; position: absolute; top: 12px; right: 12px; display: flex; align-items: center; gap: 4px; }

        .avatar-wrapper { position: relative; }
        .avatar-btn { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; color: white; font-family: 'DM Sans', system-ui, sans-serif; }
        .avatar-btn:hover { background: rgba(255,255,255,0.25); }
        .avatar-btn.open { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.2); }
        @keyframes dropdownIn { 0% { opacity: 0; transform: translateY(-6px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .dropdown-menu { position: absolute; top: calc(100% + 10px); right: 0; width: 260px; background: #fff; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06); border: 1px solid rgba(27,58,45,0.08); overflow: hidden; animation: dropdownIn 0.25s cubic-bezier(0.16,1,0.3,1) both; z-index: 200; }
        .dropdown-header { padding: 18px 18px 14px; border-bottom: 1px solid rgba(27,58,45,0.06); }
        .dropdown-header .user-name { font-size: 15px; font-weight: 600; color: #1A1A1A; }
        .dropdown-header .user-email { font-size: 12px; color: #99A09C; margin-top: 2px; }
        .dropdown-header .user-role { display: inline-block; margin-top: 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.6px; color: #7A9E7E; padding: 3px 8px; background: rgba(122,158,126,0.1); border-radius: 5px; }
        .dropdown-items { padding: 6px; }
        .dropdown-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 9px; cursor: pointer; transition: background 0.15s; border: none; background: transparent; width: 100%; text-align: left; font-family: 'DM Sans', system-ui, sans-serif; }
        .dropdown-item:hover { background: rgba(27,58,45,0.04); }
        .dropdown-item .item-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dropdown-item .item-icon svg { width: 17px; height: 17px; }
        .dropdown-item .item-label { font-size: 14px; font-weight: 500; color: #1A1A1A; }
        .dropdown-item .item-desc { font-size: 11px; color: #99A09C; margin-top: 1px; }
        .dropdown-divider { height: 1px; background: rgba(27,58,45,0.06); margin: 2px 12px; }
        .dropdown-item.logout:hover { background: rgba(200,60,60,0.05); }
        .dropdown-item.logout .item-label { color: #C43C3C; }
        .dropdown-item.logout .item-icon { background: rgba(200,60,60,0.08); }
        .dropdown-item.logout .item-icon svg { stroke: #C43C3C; }

        /* Settings gear button */
        .settings-btn { width: 34px; height: 34px; border-radius: 8px; background: rgba(255,255,255,0.1); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.7); }
        .settings-btn:hover { background: rgba(255,255,255,0.2); color: white; }

        /* Module list scrollbar */
        .module-list-scroll::-webkit-scrollbar { width: 4px; }
        .module-list-scroll::-webkit-scrollbar-track { background: transparent; }
        .module-list-scroll::-webkit-scrollbar-thumb { background: rgba(27,58,45,0.15); border-radius: 4px; }

        .module-search-wrap { position: relative; margin-bottom: 10px; flex-shrink: 0; }
        .module-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: #99A09C; pointer-events: none; }
        .module-search-input { width: 100%; height: 36px; padding: 0 12px 0 32px; border: 1.5px solid rgba(27,58,45,0.1); border-radius: 9px; background: white; font-family: 'DM Sans', system-ui, sans-serif; font-size: 13px; color: #1A1A1A; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .module-search-input::placeholder { color: #C8D0CC; }
        .module-search-input:focus { border-color: #7A9E7E; box-shadow: 0 0 0 3px rgba(122,158,126,0.1); }
        .module-search-clear { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 50%; background: rgba(27,58,45,0.08); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #5C6360; transition: background 0.15s; }
        .module-search-clear:hover { background: rgba(27,58,45,0.15); }
        .module-search-empty { padding: 24px 12px; text-align: center; font-size: 13px; color: #99A09C; }

        @media (max-width: 900px) {
          .login-wrapper { flex-direction: column; }
          .login-brand { min-height: 260px; padding: 36px; }
          .brand-content { margin-top: 20px !important; }
          .brand-tagline { font-size: 24px !important; margin-top: 24px !important; }
          .brand-features { display: none; }
          .login-form-panel { width: 100% !important; min-width: 100% !important; padding: 36px 28px !important; }
        }
      `}</style>

      {/* ═══ MORPH OVERLAY ═══ */}
      {morphClass && (<div className={morphClass}><div className="morph-logo"><PlatfarmLogo height={52} treeColor="white" textColor="#D4845F" /></div></div>)}

      {/* ═══ LOGIN ═══ */}
      {showLogin && (
        <div className={`login-wrapper phase-${phase}`}>
          <div className="login-brand">
            <PlatfarmLogo height={34} treeColor="rgba(255,255,255,0.8)" textColor="#D4845F" />
            <div className="brand-content">
              <h2 className="brand-tagline">Your complete <strong>agribusiness operations</strong> platform</h2>
              <div className="brand-features">
                <div className="brand-feature"><span className="feat-dot"/><span>Multi-company trade management</span></div>
                <div className="brand-feature"><span className="feat-dot"/><span>End-to-end shipment tracking</span></div>
                <div className="brand-feature"><span className="feat-dot"/><span>Real-time vessel monitoring</span></div>
              </div>
            </div>
            <div className="brand-footer">Platfarm for Agritech and Agribusiness Ltd · Abu Dhabi Global Market</div>
          </div>
          <div className="login-form-panel">
            <div className="le form-header">
              <h2>Welcome back</h2>
              <p>Sign in with your Platfarm account</p>
            </div>
            <button className="le login-btn" onClick={handleLogin}>
              Sign In with Platfarm
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══ PORTAL ═══ */}
      {showPortal && (
        <div className={`phase-${phase}`} style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Sticky top nav */}
          <nav className="pe" style={{ position: "sticky", top: 0, zIndex: 100, height: 60, minHeight: 60, padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1B3A2D", color: "white" }}>
            <PlatfarmLogo height={32}/>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, opacity: 0.45 }}>{formatToday()}</span>

              {/* Settings gear — admin only */}
              {isAdmin && (
                <button
                  className="settings-btn"
                  onClick={() => setShowUserMgmt(true)}
                  title="User Management"
                >
                  <svg width="17" height="17" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                  </svg>
                </button>
              )}

              <div className="avatar-wrapper">
                <div className={`avatar-btn ${menuOpen?"open":""}`} onClick={()=>setMenuOpen(!menuOpen)}>
                  {initials(user?.name)}
                </div>
                {menuOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-header">
                      <div className="user-name">{user?.name ?? "User"}</div>
                      <div className="user-email">{user?.email ?? ""}</div>
                      <span className="user-role">{user?.role ?? "user"}</span>
                    </div>
                    <div className="dropdown-items">
                      {isAdmin && (
                        <button className="dropdown-item" onClick={() => { setMenuOpen(false); setShowUserMgmt(true); }}>
                          <div className="item-icon" style={{background:"rgba(122,158,126,0.1)"}}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#7A9E7E"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                          </div>
                          <div><div className="item-label">User Management</div><div className="item-desc">Manage access & permissions</div></div>
                        </button>
                      )}
                      <div className="dropdown-divider"/>
                      <button className="dropdown-item logout" onClick={handleLogout}>
                        <div className="item-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/></svg></div>
                        <div><div className="item-label">Sign Out</div></div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>

          {/* Main content area */}
          <div className="pe" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Sticky greeting */}
            <div style={{ textAlign: "center", padding: "36px 32px 24px", flexShrink: 0 }}>
              <h1 style={{ fontSize: 28, fontWeight: 300, color: "#1B3A2D", letterSpacing: -0.5 }}>
                {getGreeting()}, <strong style={{ fontWeight: 700 }}>{user?.name?.split(" ")[0] ?? "there"}</strong>
              </h1>
              <p style={{ marginTop: 6, fontSize: 14, color: "#99A09C" }}>
                {isAdmin ? "Full access \u2014 all modules available" : "Select a module to explore"}
              </p>

            </div>

            {/* Grid: Hero card + scrollable module list */}
            <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 32px 40px", width: "100%", overflow: "hidden" }}>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24, alignItems: "start" }}>
                {/* Hero card */}
                <div key={`hero-${stableCardKey}`} className="hero-card" style={{
                  background: selected.heroBg || "#1B3A2D", borderRadius: 18, padding: "36px 38px 44px", color: "white",
                  position: "relative", overflow: "hidden",
                  minHeight: 460, display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}>
                  <div style={{ position: "absolute", top: "-40%", right: "-15%", width: 320, height: 320, background: "radial-gradient(circle, rgba(122,158,126,0.15) 0%, transparent 65%)", pointerEvents: "none" }}/>
                  <div style={{ position: "absolute", bottom: "-25%", left: "-8%", width: 200, height: 200, background: "radial-gradient(circle, rgba(196,112,75,0.1) 0%, transparent 65%)", pointerEvents: "none" }}/>
                  <div className="hero-content" style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, color: "rgba(255,255,255,0.9)" }}><div style={{ width: 28, height: 28 }}>{selected.icon}</div></div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4, marginBottom: 10 }}>{selected.title}</h2>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.6)", maxWidth: 420, marginBottom: 20 }}>{selected.desc}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}>
                      {features[selected.id]?.map((f: string,i: number)=>(<span key={`${selectedId}-${f}`} className="feature-tag-anim" style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 100, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.06)", animationDelay: `${0.12+i*0.04}s` }}>{f}</span>))}
                    </div>
                  </div>
                  <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
                    {!canAccessModule(selected.id) ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: "rgba(255,255,255,0.06)", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        <svg width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
                        Access Restricted
                      </div>
                    ) : selected.active ? (
                      <button className="open-btn" onClick={() => navigate(selected.route || "/dashboard")}>
                        Open Module
                        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
                      </button>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: "rgba(255,255,255,0.06)", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }}/>Coming Soon
                      </div>
                    )}
                  </div>
                </div>

                {/* Module list — search + scrollable list */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: 520 }}>
                  <div className="module-search-wrap">
                    <svg className="module-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
                    <input
                      className="module-search-input"
                      type="text"
                      placeholder="Search modules…"
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                    />
                    {moduleSearch && (
                      <button className="module-search-clear" onClick={() => setModuleSearch("")}>
                        <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="module-list-scroll" style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, paddingRight: 4 }}>
                    {others.length === 0
                      ? <div className="module-search-empty">No modules match "{moduleSearch}"</div>
                      : others.map((m, i) => {
                          const accessible = canAccessModule(m.id);
                          const isLocked = !accessible;
                          const cardClass = `small-card small-card-anim ${isLocked ? "is-locked" : m.active ? "is-active" : "is-soon"}`;
                          return (
                            <div
                              key={`${m.id}-${stableCardKey}`}
                              className={cardClass}
                              style={{ animationDelay: `${0.05+i*0.05}s`, flexShrink: 0 }}
                              onClick={() => !isLocked && handleSelect(m.id)}
                            >
                              <div className="sm-icon" style={{ width: 42, height: 42, minWidth: 42, borderRadius: 11, background: isLocked ? "rgba(27,58,45,0.06)" : m.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: isLocked ? "#99A09C" : m.iconColor }}>
                                <div style={{ width: 22, height: 22 }}>{m.icon}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="sm-title" style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", letterSpacing: -0.2, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>
                                <div className="sm-desc" style={{ fontSize: 13, color: "#5C6360", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.desc}</div>
                              </div>
                              {isLocked ? (
                                <span className="locked-badge-sm">
                                  <svg width="9" height="9" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
                                  Locked
                                </span>
                              ) : !m.active ? (
                                <span className="soon-badge-sm">Soon</span>
                              ) : null}
                            </div>
                          );
                        })
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "0 32px 24px", fontSize: 12, color: "#99A09C", flexShrink: 0 }}>
              Platfarm for Agritech and Agribusiness Ltd · <span style={{ color: "#7A9E7E" }}>Abu Dhabi Global Market</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
