/**
 * useCompanySelector
 * ──────────────────
 * Shared hook for company selection across all modules.
 *
 * Behaviour:
 * 1. Fetches the current user's company access settings from the backend
 *    (trpc.userManagement.myCompanyAccess).
 * 2. Fetches all Odoo companies (trpc.odoo.companies).
 * 3. Filters the company list to only those the user is allowed to see.
 *    - Admins and users with no restrictions see all companies.
 * 4. Resolves the active company from (in priority order):
 *    FOR RESTRICTED USERS (non-admin with allowedCompanyIds):
 *      a. Admin-configured default company (ALWAYS wins on page load)
 *      b. First company in the allowed list
 *    FOR ADMIN USERS:
 *      a. Previously selected company in localStorage
 *      b. Cairo company (fallback)
 *      c. First company in the list
 * 5. Persists the selected company to localStorage using a unified JSON format:
 *    { id: number | "ALL", name: string }
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";

const COMPANY_KEY = "platfarm_company";

export interface CompanyOption {
  id: number;
  name: string;
  currency: string | null;
  country: string | null;
}

export type CompanyId = number | "ALL";

interface UseCompanySelectorOptions {
  /** If true, "ALL" is a valid selection. Defaults to true. */
  allowAll?: boolean;
  /** Default company name fragment to pre-select (case-insensitive). Defaults to "cairo". */
  defaultCompanyFragment?: string;
}

interface UseCompanySelectorReturn {
  companies: CompanyOption[];
  companiesLoading: boolean;
  activeCompanyId: CompanyId;
  activeCompany: CompanyOption | undefined;
  companyLabel: string;
  setActiveCompany: (id: CompanyId) => void;
  /** True once the initial company has been resolved from localStorage / default. */
  companyResolved: boolean;
  /** True if the current user is an admin or has no company restrictions. */
  isAdmin: boolean;
}

export function useCompanySelector(opts: UseCompanySelectorOptions = {}): UseCompanySelectorReturn {
  const { allowAll = true, defaultCompanyFragment = "cairo" } = opts;

  // Fetch user's company access settings
  const { data: accessData } = trpc.userMgmt.myCompanyAccess.useQuery();

  // Fetch all Odoo companies
  const { data: odooCompanies, isLoading: companiesLoading } = trpc.odoo.companies.useQuery();

  // Build the full company list
  const allCompanies = useMemo<CompanyOption[]>(() => {
    if (!odooCompanies) return [];
    return odooCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      currency: c.currency ?? null,
      country: c.country ?? null,
    }));
  }, [odooCompanies]);

  // Filter to only allowed companies (empty allowedCompanyIds = no restriction = all)
  // Return empty list while accessData is still loading to avoid flash of all companies
  const companies = useMemo<CompanyOption[]>(() => {
    if (!accessData) return []; // not loaded yet — wait for access data before showing anything
    const { allowedCompanyIds } = accessData;
    if (!allowedCompanyIds.length) return allCompanies; // no restriction (admin or unconfigured user)
    return allCompanies.filter((c) => allowedCompanyIds.includes(c.id));
  }, [allCompanies, accessData]);

  // ── Read initial value from localStorage ─────────────────────────────────
  const [activeCompanyId, setActiveCompanyIdRaw] = useState<CompanyId>(() => {
    try {
      const s = localStorage.getItem(COMPANY_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.id === "ALL" && allowAll) return "ALL";
        if (typeof p.id === "number") return p.id;
      }
    } catch { /* ignore */ }
    return allowAll ? "ALL" : 0; // 0 means "not yet resolved"
  });

  const [companyResolved, setCompanyResolved] = useState(false);
  const resolvedRef = useRef(false);

  // ── Resolve to a real company once the list + access data loads ───────────
  useEffect(() => {
    if (resolvedRef.current || !companies.length || !accessData) return;
    resolvedRef.current = true;

    const { defaultCompanyId } = accessData;
    const userIsAdmin = accessData.isAdmin || accessData.allowedCompanyIds.length === 0;

    // ── RESTRICTED USERS: admin-configured default ALWAYS wins ──
    if (!userIsAdmin) {
      // Priority 1: admin-configured default company
      if (defaultCompanyId !== null) {
        const co = companies.find((c) => c.id === defaultCompanyId);
        if (co) {
          setActiveCompanyIdRaw(co.id);
          localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: co.id, name: co.name }));
          setCompanyResolved(true);
          return;
        }
      }
      // Priority 2: first allowed company
      if (companies.length > 0) {
        setActiveCompanyIdRaw(companies[0].id);
        localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: companies[0].id, name: companies[0].name }));
      }
      setCompanyResolved(true);
      return;
    }

    // ── ADMIN USERS: respect localStorage, then fallback ──
    // Priority 1: admin-configured default (if set)
    if (defaultCompanyId !== null) {
      const co = companies.find((c) => c.id === defaultCompanyId);
      if (co) {
        // Only use admin default if no valid localStorage selection exists
        const saved = localStorage.getItem(COMPANY_KEY);
        if (!saved) {
          setActiveCompanyIdRaw(co.id);
          localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: co.id, name: co.name }));
          setCompanyResolved(true);
          return;
        }
      }
    }

    // Priority 2: previously selected company in localStorage (if still allowed)
    try {
      const s = localStorage.getItem(COMPANY_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.id === "ALL" && allowAll) { setCompanyResolved(true); return; }
        if (typeof p.id === "number") {
          const co = companies.find((c) => c.id === p.id);
          if (co) { setActiveCompanyIdRaw(co.id); setCompanyResolved(true); return; }
        }
        // Legacy: plain string name
        if (typeof p === "string" || typeof p.name === "string") {
          const name = typeof p === "string" ? p : p.name;
          const co = companies.find((c) => c.name === name || c.name?.toLowerCase().includes(name.toLowerCase()));
          if (co) {
            setActiveCompanyIdRaw(co.id);
            localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: co.id, name: co.name }));
            setCompanyResolved(true);
            return;
          }
        }
      }
    } catch { /* ignore */ }

    // Priority 3: Cairo company (default fallback)
    const cairo = companies.find((c) => c.name?.toLowerCase().includes(defaultCompanyFragment));
    if (cairo) {
      setActiveCompanyIdRaw(cairo.id);
      localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: cairo.id, name: cairo.name }));
      setCompanyResolved(true);
      return;
    }

    // Priority 4: first company in the list
    if (companies.length > 0) {
      setActiveCompanyIdRaw(companies[0].id);
      localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: companies[0].id, name: companies[0].name }));
    } else if (allowAll) {
      setActiveCompanyIdRaw("ALL");
    }
    setCompanyResolved(true);
  }, [companies, accessData]);

  // ── If the currently selected company is no longer in the allowed list, reset ──
  useEffect(() => {
    if (!companyResolved || !companies.length || !accessData) return;
    if (activeCompanyId === "ALL") return;
    if (typeof activeCompanyId === "number") {
      const stillAllowed = companies.find((c) => c.id === activeCompanyId);
      if (!stillAllowed) {
        const first = companies[0];
        setActiveCompanyIdRaw(first.id);
        localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: first.id, name: first.name }));
      }
    }
  }, [companies, accessData, companyResolved]);

  // ── If restricted user has "ALL" selected (stale localStorage), reset ──
  useEffect(() => {
    if (!companyResolved || !companies.length || !accessData) return;
    const userIsAdmin = accessData.isAdmin || accessData.allowedCompanyIds.length === 0;
    if (!userIsAdmin && activeCompanyId === "ALL") {
      const first = companies[0];
      if (first) {
        setActiveCompanyIdRaw(first.id);
        localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: first.id, name: first.name }));
      }
    }
  }, [companyResolved, companies, accessData, activeCompanyId]);

  // ── Setter that also persists ─────────────────────────────────────────────
  const setActiveCompany = (id: CompanyId) => {
    setActiveCompanyIdRaw(id);
    if (id === "ALL") {
      localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: "ALL", name: "All Companies" }));
    } else {
      const co = companies.find((c) => c.id === id);
      if (co) localStorage.setItem(COMPANY_KEY, JSON.stringify({ id: co.id, name: co.name }));
    }
  };

  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const companyLabel =
    activeCompanyId === "ALL" ? "All Companies" : activeCompany?.name ?? "Select Company";

  // isAdmin = true ONLY when access data confirms admin role OR no company restrictions
  // NEVER default to admin when data is missing (security: prevents privilege escalation on query failure)
  const isAdmin = !!accessData && (accessData.isAdmin || accessData.allowedCompanyIds.length === 0);

  return {
    companies,
    companiesLoading,
    activeCompanyId,
    activeCompany,
    companyLabel,
    setActiveCompany,
    companyResolved,
    isAdmin,
  };
}
