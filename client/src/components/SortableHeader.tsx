import { type SortDirection } from "@/hooks/useTableSort";

interface SortableHeaderProps {
  label: string;
  column: string;
  currentColumn: string | null;
  currentDirection: SortDirection;
  onClick: (column: string) => void;
  style?: React.CSSProperties;
}

export function SortableHeader({
  label,
  column,
  currentColumn,
  currentDirection,
  onClick,
  style,
}: SortableHeaderProps) {
  const isActive = currentColumn === column && currentDirection !== null;

  return (
    <th
      onClick={() => onClick(column)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        {label}
        <span
          style={{
            display: "inline-flex",
            flexDirection: "column",
            fontSize: 7,
            lineHeight: 1,
            opacity: isActive ? 1 : 0.3,
            transition: "opacity 0.15s",
          }}
        >
          <span style={{ color: isActive && currentDirection === "asc" ? "currentColor" : "inherit", opacity: isActive && currentDirection === "asc" ? 1 : 0.4 }}>▲</span>
          <span style={{ color: isActive && currentDirection === "desc" ? "currentColor" : "inherit", opacity: isActive && currentDirection === "desc" ? 1 : 0.4 }}>▼</span>
        </span>
      </span>
    </th>
  );
}
