// Czytanie arkuszy XLSX po stronie serwera.
//
// Plik .xlsx to archiwum ZIP z XML-ami w środku. Node ma `zlib`, więc
// rozpakowanie to jedna funkcja — mniej niż koszt wciągnięcia kolejnej
// zależności do builda, który na VPS-ie musi działać bez niespodzianek.
// Cała reszta (rozbiór XML, CSV) siedzi w `xlsx-parse.ts`, bo tego samego
// kodu używa przeglądarka.

import { inflateRawSync } from "node:zlib"
import {
  looksLikeZip,
  parseSheets,
  readDelimited,
  zipEntries,
  type SheetData,
  type ZipEntry,
} from "@/lib/xlsx-parse"

export type { SheetData } from "@/lib/xlsx-parse"
export { readDelimited } from "@/lib/xlsx-parse"

export function readWorkbook(buffer: Buffer): SheetData[] {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  const entries: ZipEntry[] = zipEntries(bytes).map((entry) => ({
    name: entry.name,
    data: entry.method === 0 ? entry.data : new Uint8Array(inflateRawSync(entry.data)),
  }))

  return parseSheets(entries)
}

export function readSpreadsheet(buffer: Buffer, filename = ""): SheetData[] {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  if (looksLikeZip(bytes)) return readWorkbook(buffer)
  if (/\.(csv|tsv|txt)$/i.test(filename)) return readDelimited(buffer.toString("utf8"))
  return readDelimited(buffer.toString("utf8"))
}
