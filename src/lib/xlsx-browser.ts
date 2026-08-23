"use client"

// Czytanie arkusza w przeglądarce. Dzięki temu na serwer idzie kilkaset
// wierszy tekstu zamiast całego pliku — a to omija limit `client_max_body_size`
// nginxa (domyślnie 1 MB), przez który większy cennik kończył się HTML-owym
// błędem 413 i komunikatem „Unexpected token '<'".
//
// Rozpakowanie robi `DecompressionStream("deflate-raw")` — jest w Chrome,
// Firefoksie i Safari od 2023 roku. Gdyby go zabrakło, wywołujący ma
// odesłać plik na serwer po staremu.

import {
  looksLikeZip,
  parseSheets,
  readDelimited,
  zipEntries,
  type SheetData,
  type ZipEntry,
} from "@/lib/xlsx-parse"

export type { SheetData } from "@/lib/xlsx-parse"

export function canReadInBrowser(): boolean {
  return typeof DecompressionStream !== "undefined"
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  )
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

export async function readSpreadsheetInBrowser(file: File): Promise<SheetData[]> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (!looksLikeZip(bytes)) {
    return readDelimited(new TextDecoder("utf-8").decode(bytes))
  }

  // Rozpakowujemy tylko to, co potrzebne do odczytu arkuszy — pomijamy style,
  // motywy i miniatury, których w cenniku bywa więcej niż samych danych.
  const wanted = /^xl\/(workbook\.xml|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/

  const entries: ZipEntry[] = []
  for (const entry of zipEntries(bytes)) {
    if (!wanted.test(entry.name)) continue
    entries.push({
      name: entry.name,
      data: entry.method === 0 ? entry.data : await inflateRaw(entry.data),
    })
  }

  return parseSheets(entries)
}
