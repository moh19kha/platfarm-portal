/**
 * SearchableProductSelect — Type-to-search combobox for Odoo products
 * Debounces input and fetches matching products from the server.
 * Uses a React portal for the dropdown so it is not clipped by parent overflow.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { C, FONT, MONO } from "@/lib/data";

interface Product {
  id: number;
  name: string;
  uom: { id: number; name: string } | null;
  purchaseUom: { id: number; name: string } | null;
}

interface Props {
  value: number; // selected product_id (0 = none)
  companyId?: number;
  onChange: (productId: number, product: Product | null) => void;
  style?: React.CSSProperties;
}

export function SearchableProductSelect({ value, companyId, onChange, style }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Track dropdown position for portal rendering
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: 200,
  });

  // Debounce search input
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 300);
  }, []);

  // Fetch products with search + company filter
  const { data: products, isLoading } = trpc.odoo.products.useQuery(
    {
      search: debouncedSearch || undefined,
      companyId: companyId || undefined,
    },
    { placeholderData: (prev: any) => prev }
  );

  // Also fetch initial products (no search) to show default list
  const { data: initialProducts } = trpc.odoo.products.useQuery(
    { companyId: companyId || undefined }
  );

  // Resolve selected product name when value changes externally
  useEffect(() => {
    if (value === 0) {
      setSelectedName("");
      return;
    }
    // Try to find in current products list
    const allProducts = [...(products || []), ...(initialProducts || [])];
    const found = allProducts.find(p => p.id === value);
    if (found) {
      setSelectedName(found.name);
    }
  }, [value, products, initialProducts]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click is inside the portal dropdown
        const portalEl = document.getElementById("product-dropdown-portal");
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setIsOpen(false);
        if (value && selectedName) {
          setSearch("");
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value, selectedName]);

  // Update dropdown position when open
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Also update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const updatePos = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 2,
          left: rect.left,
          width: rect.width,
        });
      }
    };
    // Listen on all scrollable ancestors
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [isOpen]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const displayProducts = search ? products : initialProducts;

  const handleSelect = (product: Product) => {
    setSelectedName(product.name);
    setSearch("");
    setDebouncedSearch("");
    setIsOpen(false);
    onChange(product.id, product);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedName("");
    setSearch("");
    setDebouncedSearch("");
    onChange(0, null);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      {/* Input field */}
      <div style={{
        display: "flex", alignItems: "center",
        border: `1px solid ${isOpen ? C.sage : C.border}`,
        borderRadius: 5, background: C.card,
        transition: "border-color .15s",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : (selectedName || "")}
          placeholder={selectedName || "Search products..."}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          style={{
            flex: 1, padding: "5px 8px", border: "none", borderRadius: 5,
            fontSize: 11, fontFamily: FONT, outline: "none", background: "transparent",
            color: isOpen ? C.dark : (selectedName ? C.dark : C.muted),
          }}
        />
        {value > 0 && (
          <button
            onClick={handleClear}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 6px", color: C.muted, fontSize: 13, lineHeight: 1,
            }}
            title="Clear selection"
          >
            ×
          </button>
        )}
        <div style={{
          padding: "2px 6px", color: C.muted, fontSize: 8,
          cursor: "pointer", userSelect: "none",
        }} onClick={() => { setIsOpen(!isOpen); inputRef.current?.focus(); }}>
          ▼
        </div>
      </div>

      {/* Dropdown — rendered via portal to escape overflow:hidden parents */}
      {isOpen && createPortal(
        <div
          id="product-dropdown-portal"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: 240,
            overflowY: "auto",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 10000,
          }}
        >
          {isLoading && (
            <div style={{ padding: "10px 12px", fontSize: 10, color: C.muted, textAlign: "center" }}>
              Searching...
            </div>
          )}
          {!isLoading && (!displayProducts || displayProducts.length === 0) && (
            <div style={{ padding: "10px 12px", fontSize: 10, color: C.muted, textAlign: "center" }}>
              {search ? `No products matching "${search}"` : "No products available"}
            </div>
          )}
          {!isLoading && displayProducts && displayProducts.map(p => (
            <div
              key={p.id}
              onClick={() => handleSelect(p)}
              style={{
                padding: "7px 12px", cursor: "pointer", fontSize: 11,
                fontFamily: FONT, color: C.dark,
                background: p.id === value ? C.gBg2 : "transparent",
                borderBottom: `1px solid ${C.border}`,
                transition: "background .1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.gBg}
              onMouseLeave={e => e.currentTarget.style.background = p.id === value ? C.gBg2 : "transparent"}
            >
              <div style={{ fontWeight: p.id === value ? 600 : 400 }}>{p.name}</div>
              {p.uom && (
                <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>
                  UoM: {p.uom.name}
                  {p.purchaseUom && p.purchaseUom.id !== p.uom.id && ` · Purchase UoM: ${p.purchaseUom.name}`}
                </div>
              )}
            </div>
          ))}
          {search && displayProducts && displayProducts.length > 0 && (
            <div style={{ padding: "5px 12px", fontSize: 9, color: C.muted, textAlign: "center", background: C.gBg }}>
              {displayProducts.length} result{displayProducts.length !== 1 ? "s" : ""} · Type to refine
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
