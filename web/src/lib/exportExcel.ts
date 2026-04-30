// web/src/lib/exportExcel.ts
// Client-side Excel export using SheetJS (xlsx) — no server round-trip needed.
// Install: npm install xlsx

import * as XLSX from 'xlsx'

/**
 * Export an array of objects to an .xlsx file and trigger a browser download.
 * @param rows   Array of plain objects (keys become column headers)
 * @param sheet  Worksheet name shown in Excel
 * @param filename  Downloaded filename (no extension needed)
 */
export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  sheet: string,
  filename: string,
) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}