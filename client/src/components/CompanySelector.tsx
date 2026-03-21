/**
 * CompanySelector
 * ───────────────
 * Unified company selector dropdown used across all modules.
 * Matches the Home.tsx visual style: design tokens, rounded-square avatar,
 * currency + country sub-line, shimmer loading skeleton, hover states.
 *
 * Usage:
 *   const cs = useCompanySelector();
 *   <CompanySelector {...cs} />
 */
import { useRef, useEffect } from "react";
import { C } from "@/lib/data";
import { ShimmerBox } from "@/components/LoadingIndicators";
import type { CompanyOption, CompanyId } from "@/hooks/useCompanySelector";

interface CompanySelectorProps {
  companies: CompanyOption[];
  companiesLoading: boolean;
  activeCompanyId: CompanyId;
  activeCompany: CompanyOption | undefined;
  companyLabel: string;
  setActiveCompany: (id: CompanyId) => void;
  /** Whether to show the "All Companies" option. Defaults to true. */
  allowAll?: boolean;
  /** Whether the dropdown is currently open. Controlled externally. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanySelector({
  companies,
  companiesLoading,
  activeCompanyId,
  activeCompany,
  companyLabel,
  setActiveCompany,
  allowAll = true,
  open,
  onOpenChange,
}: CompanySelectorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOpenChange]);

  const avatarInitials =
    activeCompanyId === "ALL"
      ? "⊕"
      : (activeCompany?.name ?? "?").substring(0, 2).toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* ── Trigger button ── */}
      <button
        onClick={() => onOpenChange(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px 4px 6px",
          background: open ? C.gBg2 : C.gBg,
          border: `1px solid ${open ? C.sage : C.gBdr}`,
          borderRadius: 6,
          cursor: "pointer",
          transition: "all .15s",
          minWidth: 160,
          maxWidth: 240,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: activeCompanyId === "ALL" ? C.forest : C.sage,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            color: C.white,
            flexShrink: 0,
          }}
        >
          {avatarInitials}
        </div>

        {/* Label + sub-line */}
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.dark,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {companyLabel}
          </div>
          {activeCompany && (activeCompany.currency || activeCompany.country) && (
            <div style={{ fontSize: 8, color: C.muted, lineHeight: 1.2 }}>
              {activeCompany.currency}
              {activeCompany.country ? ` · ${activeCompany.country}` : ""}
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .2s",
            flexShrink: 0,
          }}
        >
          <path
            d="M1 1L5 5L9 1"
            stroke={C.gray}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 260,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 300,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${C.border}`,
              background: C.gBg,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.sage,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Switch Company
            </div>
          </div>

          {/* "All Companies" option */}
          {allowAll && (
            <DropdownItem
              label="All Companies"
              subLabel="HQ consolidated view"
              initials="⊕"
              avatarBg={C.forest}
              isActive={activeCompanyId === "ALL"}
              onClick={() => {
                setActiveCompany("ALL");
                onOpenChange(false);
              }}
            />
          )}

          {/* Loading skeleton */}
          {companiesLoading && (
            <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <ShimmerBox width={26} height={26} borderRadius={4} />
                  <div style={{ flex: 1 }}>
                    <ShimmerBox width={100} height={11} style={{ marginBottom: 4 }} />
                    <ShimmerBox width={60} height={9} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Company list */}
          {companies.map((company) => (
            <DropdownItem
              key={company.id}
              label={company.name}
              subLabel={[company.currency, company.country].filter(Boolean).join(" · ")}
              initials={company.name.substring(0, 2).toUpperCase()}
              avatarBg={C.sage}
              isActive={activeCompanyId === company.id}
              onClick={() => {
                setActiveCompany(company.id);
                onOpenChange(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Internal helper ──────────────────────────────────────────────────────────
interface DropdownItemProps {
  label: string;
  subLabel?: string;
  initials: string;
  avatarBg: string;
  isActive: boolean;
  onClick: () => void;
}

function DropdownItem({ label, subLabel, initials, avatarBg, isActive, onClick }: DropdownItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        cursor: "pointer",
        background: isActive ? C.gBg2 : "transparent",
        borderBottom: `1px solid ${C.border}`,
        transition: "background .1s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = C.gBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? C.gBg2 : "transparent";
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 4,
          background: avatarBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: C.white,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.dark }}>{label}</div>
        {subLabel && (
          <div style={{ fontSize: 9, color: C.muted }}>{subLabel}</div>
        )}
      </div>
      {isActive && (
        <span style={{ fontSize: 11, color: C.forest, fontWeight: 700 }}>✓</span>
      )}
    </div>
  );
}
