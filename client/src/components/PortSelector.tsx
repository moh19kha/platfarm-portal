/**
 * PortSelector — Searchable dropdown for selecting trade ports with UN/LOCODE codes
 * Supports type-to-search across port code, name, and country.
 * Groups results by region for easy browsing.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { PORTS, searchPorts, getPortsByRegion, type Port } from "@/lib/ports";

interface Props {
  value: string;                    // Current port value (e.g., "SAJED - Jeddah" or free text)
  onChange: (value: string) => void; // Callback with formatted value "CODE - Name"
  placeholder?: string;
  style?: React.CSSProperties;
  accentColor?: string;             // Color accent for the dropdown (default: C.forest)
}

export function PortSelector({ value, onChange, placeholder = "Search port...", style, accentColor = C.forest }: Props) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filter ports based on search
  const filteredPorts = useMemo(() => searchPorts(search), [search]);

  // Group filtered ports by region
  const groupedPorts = useMemo(() => {
    if (!search || search.trim().length === 0) return getPortsByRegion();
    const map = new Map<string, Port[]>();
    for (const p of filteredPorts) {
      if (!map.has(p.region)) map.set(p.region, []);
      map.get(p.region)!.push(p);
    }
    return Array.from(map.entries()).map(([region, ports]) => ({ region, ports }));
  }, [filteredPorts, search]);

  const handleSelect = useCallback((port: Port) => {
    onChange(`${port.code} - ${port.name}`);
    setIsOpen(false);
    setSearch("");
  }, [onChange]);

  const handleInputChange = useCallback((val: string) => {
    setSearch(val);
    if (!isOpen) setIsOpen(true);
  }, [isOpen]);

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClear = useCallback(() => {
    onChange("");
    setSearch("");
    setIsOpen(true);
    inputRef.current?.focus();
  }, [onChange]);

  const totalResults = filteredPorts.length;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input field */}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          value={isOpen ? search : value}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={value || placeholder}
          style={{
            ...style,
            paddingRight: value ? 28 : 8,
          }}
        />
        {/* Clear button */}
        {value && !isOpen && (
          <button
            onClick={handleClear}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: C.muted, fontSize: 12, fontWeight: 700, lineHeight: 1,
              padding: "2px 4px", borderRadius: 3,
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.red}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}
            title="Clear selection"
          >×</button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
            maxHeight: 280, overflowY: "auto",
            background: C.card, borderWidth: 1, borderStyle: "solid", borderColor: C.border,
            borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            zIndex: 300, fontFamily: FONT,
          }}
        >
          {/* Search info bar */}
          <div style={{
            padding: "5px 10px", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: C.border,
            background: C.gBg, fontSize: 9, color: C.muted,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, zIndex: 1,
          }}>
            <span>{search ? `${totalResults} port${totalResults !== 1 ? "s" : ""} found` : `${PORTS.length} ports available`}</span>
            <span style={{ fontFamily: MONO, fontSize: 8 }}>UN/LOCODE</span>
          </div>

          {totalResults === 0 ? (
            <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 10, color: C.muted }}>
              No ports matching "{search}"
            </div>
          ) : (
            groupedPorts.map(group => (
              <div key={group.region}>
                {/* Region header */}
                <div style={{
                  padding: "4px 10px", background: C.gBg,
                  fontSize: 8, fontWeight: 700, color: accentColor,
                  textTransform: "uppercase", letterSpacing: 0.8,
                  borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: C.border,
                  position: "sticky", top: 26, zIndex: 1,
                }}>
                  {group.region}
                </div>

                {/* Port items */}
                {group.ports.map(port => {
                  const isSelected = value === `${port.code} - ${port.name}`;
                  return (
                    <div
                      key={port.code}
                      onClick={() => handleSelect(port)}
                      style={{
                        padding: "5px 10px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8,
                        background: isSelected ? C.gBg2 : "transparent",
                        borderLeftWidth: isSelected ? 2 : 0,
                        borderLeftStyle: "solid",
                        borderLeftColor: isSelected ? accentColor : "transparent",
                        transition: "background .1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.gBg; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Port code badge */}
                      <span style={{
                        fontFamily: MONO, fontSize: 9, fontWeight: 700,
                        color: accentColor, background: C.gBg2,
                        padding: "1px 5px", borderRadius: 3,
                        minWidth: 48, textAlign: "center",
                      }}>
                        {port.code}
                      </span>

                      {/* Port name + country */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 10, fontWeight: isSelected ? 700 : 500,
                          color: C.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {port.name}
                        </div>
                        <div style={{ fontSize: 8, color: C.muted }}>{port.country}</div>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <span style={{ fontSize: 10, color: accentColor }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
