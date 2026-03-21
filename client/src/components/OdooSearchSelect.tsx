/**
 * OdooSearchSelect — A searchable dropdown for Odoo Many2one fields.
 * Shows a text input that searches as you type and displays matching results.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { C, MONO } from "@/lib/data";

interface Option {
  id: number;
  name: string;
}

interface OdooSearchSelectProps {
  value: { id: number; name: string } | null;
  onChange: (selected: { id: number; name: string } | null) => void;
  options: Option[];
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function OdooSearchSelect({
  value,
  onChange,
  options,
  onSearch,
  isLoading,
  placeholder = "Search...",
  style,
}: OdooSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string>(value?.name || "");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // Reset query to current value name if user didn't select
        if (value) setQuery(value.name);
        else setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  // Sync query with value when value changes externally
  useEffect(() => {
    if (!open) {
      setQuery(value?.name || "");
    }
  }, [value, open]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(q), 300);
  }, [onSearch]);

  const handleSelect = useCallback((opt: Option) => {
    onChange(opt);
    setQuery(opt.name);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setQuery("");
    setOpen(false);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setOpen(true);
    onSearch(query);
  }, [onSearch, query]);

  const inputStyle: React.CSSProperties = {
    padding: "4px 8px",
    border: `1px solid ${C.inputBdr}`,
    borderRadius: 5,
    fontSize: 11,
    fontFamily: MONO,
    outline: "none",
    width: "100%",
    background: C.gBg,
    ...style,
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          style={inputStyle}
        />
        {value && (
          <button
            onClick={handleClear}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: C.muted, padding: "2px 4px",
              lineHeight: 1, flexShrink: 0,
            }}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 300,
          maxHeight: 180, overflowY: "auto",
        }}>
          {isLoading && (
            <div style={{ padding: "8px 10px", fontSize: 10, color: C.muted, textAlign: "center" }}>
              Searching...
            </div>
          )}
          {!isLoading && options.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 10, color: C.muted, textAlign: "center" }}>
              {query ? "No results found" : "Type to search"}
            </div>
          )}
          {!isLoading && options.map(opt => (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt)}
              style={{
                padding: "6px 10px", cursor: "pointer", fontSize: 11,
                background: value?.id === opt.id ? C.gBg2 : "transparent",
                borderBottom: `1px solid ${C.border}`,
                transition: "background .1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.gBg}
              onMouseLeave={e => e.currentTarget.style.background = value?.id === opt.id ? C.gBg2 : "transparent"}
            >
              <div style={{ fontWeight: value?.id === opt.id ? 600 : 400 }}>{opt.name}</div>
              <div style={{ fontSize: 9, color: C.muted }}>ID: {opt.id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
