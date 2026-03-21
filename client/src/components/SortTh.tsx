import { type ReactNode } from "react";
import { C } from "@/lib/data";
import { type SortDirection } from "@/hooks/useTableSort";

interface SortThProps {
  children: ReactNode;
  column: string;
  currentColumn: string | null;
  currentDirection: SortDirection;
  onSort: (column: string) => void;
  right?: boolean;
  sticky?: boolean;
}

export function SortTh({ children, column, currentColumn, currentDirection, onSort, right, sticky }: SortThProps) {
  const isActive = currentColumn === column && currentDirection !== null;

  return (
    <th
      onClick={() => onSort(column)}
      style={{
        padding: "8px 12px",
        textAlign: right ? "right" : "left",
        fontSize: 9,
        fontWeight: 700,
        color: C.sage,
        textTransform: "uppercase",
        letterSpacing: 1,
        borderBottom: `2px solid ${C.gBdr}`,
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        ...(sticky ? { position: "sticky" as const, left: 0, zIndex: 2, background: "#FFFFFF", boxShadow: "2px 0 4px rgba(0,0,0,0.06)" } : {}),
      }}
    >
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        justifyContent: right ? "flex-end" : "flex-start",
        width: "100%",
      }}>
        {children}
        <span style={{
          display: "inline-flex",
          flexDirection: "column",
          fontSize: 6,
          lineHeight: 1,
          gap: 0,
          opacity: isActive ? 1 : 0.35,
          transition: "opacity 0.15s",
        }}>
          <span style={{
            opacity: isActive && currentDirection === "asc" ? 1 : 0.3,
            color: isActive && currentDirection === "asc" ? C.forest : "inherit",
          }}>▲</span>
          <span style={{
            opacity: isActive && currentDirection === "desc" ? 1 : 0.3,
            color: isActive && currentDirection === "desc" ? C.forest : "inherit",
          }}>▼</span>
        </span>
      </span>
    </th>
  );
}
