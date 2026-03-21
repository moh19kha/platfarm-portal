import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

/**
 * Generic table sorting hook.
 * - Click a column header once → ascending
 * - Click again → descending
 * - Click a third time → reset (no sort)
 *
 * `accessor` maps a column key to the comparable value for a row.
 */
export function useTableSort<T>(
  data: T[],
  accessor: (row: T, column: string) => string | number | boolean | null | undefined
) {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  const toggleSort = useCallback((column: string) => {
    setSort(prev => {
      if (prev.column !== column) return { column, direction: "asc" as const };
      if (prev.direction === "asc") return { column, direction: "desc" as const };
      return { column: null, direction: null };
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sort.column || !sort.direction) return data;
    const col = sort.column;
    const dir = sort.direction === "asc" ? 1 : -1;

    return [...data].sort((a, b) => {
      let va = accessor(a, col);
      let vb = accessor(b, col);

      // Treat null/undefined/"" as lowest
      if (va == null || va === "") va = null;
      if (vb == null || vb === "") vb = null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;

      // Numeric comparison
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }

      // Boolean comparison
      if (typeof va === "boolean" && typeof vb === "boolean") {
        return ((va ? 1 : 0) - (vb ? 1 : 0)) * dir;
      }

      // String comparison (case-insensitive)
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sa.localeCompare(sb) * dir;
    });
  }, [data, sort, accessor]);

  return { sorted, sort, toggleSort };
}
