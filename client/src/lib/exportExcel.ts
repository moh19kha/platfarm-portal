/**
 * exportToExcel — Client-side Excel export utility using SheetJS (xlsx).
 *
 * Usage:
 *   exportToExcel(rows, columns, "Purchase_Shipments");
 */
// xlsx is imported dynamically so the 286 KB bundle only downloads
// the first time a user actually clicks an export button.

export interface ExcelColumn<T> {
  header: string;
  /** Accessor function to extract the cell value from a row */
  value: (row: T) => string | number | null | undefined;
  /** Optional: column width in characters (default: 15) */
  width?: number;
}

export function exportToExcel<T>(
  rows: T[],
  columns: ExcelColumn<T>[],
  filename: string
): Promise<void> {
  // Build data synchronously while the library is loading
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((col) => {
      const v = col.value(row);
      return v === null || v === undefined ? "" : v;
    })
  );
  const dateStr = new Date().toISOString().split("T")[0];

  return import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = columns.map((c) => ({ wch: c.width || 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shipments");
    XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
  });
}
