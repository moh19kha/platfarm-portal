/**
 * OdooMultiSelect — A searchable multi-select for Odoo Many2many fields.
 * Shows selected items as avatar badges (initial + name), with a search dropdown to add more.
 * Designed for Receiving Team fields: Quality Supervisors, Off-Loading Drivers, Labor.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { C, MONO } from "@/lib/data";

interface Option {
  id: number;
  name: string;
}

interface OdooMultiSelectProps {
  value: Option[];
  onChange: (selected: Option[]) => void;
  options: Option[];
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  accentColor?: string;
}

/** Generate a deterministic color from a name string */
function getAvatarColor(name: string): string {
  const colors = [
    "#2D6A4F", "#E76F51", "#264653", "#E9C46A",
    "#6A4C93", "#1982C4", "#8AC926", "#FF595E",
    "#6D6875", "#B5838D", "#457B9D", "#E63946",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Get initials from a name (first letter of first and last word) */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar badge component */
function AvatarBadge({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: color, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff", flexShrink: 0,
      letterSpacing: -0.5,
    }}>
      {getInitials(name)}
    </div>
  );
}

/** Single person chip with avatar + name + optional remove button */
function PersonChip({ person, onRemove, readOnly }: { person: Option; onRemove?: () => void; readOnly?: boolean }) {
  const color = getAvatarColor(person.name);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "3px 6px 3px 3px", borderRadius: 6,
      background: C.gBg, border: `1px solid ${C.border}`,
      fontSize: 10, fontWeight: 500,
    }}>
      <AvatarBadge name={person.name} color={color} size={24} />
      <span style={{ whiteSpace: "nowrap" }}>{person.name}</span>
      {!readOnly && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 11, color: C.muted, padding: "0 2px",
            lineHeight: 1, flexShrink: 0,
          }}
          title={`Remove ${person.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function OdooMultiSelect({
  value,
  onChange,
  options,
  onSearch,
  isLoading,
  placeholder = "Search to add...",
  readOnly = false,
  accentColor,
}: OdooMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = accentColor || C.forest;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(q), 300);
  }, [onSearch]);

  const handleSelect = useCallback((opt: Option) => {
    // Don't add duplicates
    if (value.some(v => v.id === opt.id)) return;
    onChange([...value, opt]);
    setQuery("");
    // Keep dropdown open for adding more
    inputRef.current?.focus();
    onSearch("");
  }, [value, onChange, onSearch]);

  const handleRemove = useCallback((id: number) => {
    onChange(value.filter(v => v.id !== id));
  }, [value, onChange]);

  const handleFocus = useCallback(() => {
    setOpen(true);
    onSearch(query);
  }, [onSearch, query]);

  // Filter out already-selected from dropdown
  const selectedIds = new Set(value.map(v => v.id));
  const filteredOptions = options.filter(o => !selectedIds.has(o.id));

  // Read-only display
  if (readOnly) {
    if (!value || value.length === 0) {
      return <span style={{ fontSize: 10, color: C.muted }}>{"\u2014"}</span>;
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {value.map(person => (
          <PersonChip key={person.id} person={person} readOnly />
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {/* Selected items */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {value.map(person => (
            <PersonChip
              key={person.id}
              person={person}
              onRemove={() => handleRemove(person.id)}
            />
          ))}
        </div>
      )}

      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={value.length > 0 ? "Add more..." : placeholder}
        style={{
          padding: "4px 8px",
          border: `1px solid ${C.inputBdr}`,
          borderRadius: 5,
          fontSize: 11,
          fontFamily: MONO,
          outline: "none",
          width: "100%",
          background: C.gBg,
        }}
      />

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 300,
          maxHeight: 200, overflowY: "auto",
        }}>
          {isLoading && (
            <div style={{ padding: "8px 10px", fontSize: 10, color: C.muted, textAlign: "center" }}>
              Searching...
            </div>
          )}
          {!isLoading && filteredOptions.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 10, color: C.muted, textAlign: "center" }}>
              {query ? "No results found" : "Type to search employees"}
            </div>
          )}
          {!isLoading && filteredOptions.map(opt => {
            const color = getAvatarColor(opt.name);
            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: "5px 10px", cursor: "pointer", fontSize: 11,
                  display: "flex", alignItems: "center", gap: 8,
                  borderBottom: `1px solid ${C.border}`,
                  transition: "background .1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <AvatarBadge name={opt.name} color={color} size={22} />
                <div>
                  <div style={{ fontWeight: 500 }}>{opt.name}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>ID: {opt.id}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
