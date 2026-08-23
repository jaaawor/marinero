// Czytanie arkuszy XLSX bez zewnętrznej biblioteki.
//
// Plik .xlsx to archiwum ZIP z XML-ami w środku. Node ma `zlib`, więc rozpakowanie
// i wyciągnięcie komórek to dwie krótkie funkcje — mniej niż koszt wciągnięcia
// kolejnej zależności do builda, który na VPS-ie musi działać bez niespodzianek.
//
// Obsługujemy to, co realnie przychodzi w cennikach od producentów: teksty
// z tablicy `sharedStrings`, teksty wpisane w komórce (`inlineStr`), liczby
// i daty. Formuł nie liczymy — bierzemy ostatnią zapamiętaną wartość (`<v>`),
// którą Excel i tak zapisuje razem z formułą.

import { inflateRawSync } from "node:zlib"

type ZipEntry = { name: string; data: Buffer }

/** Minimalny czytnik ZIP — tylko to, czego trzeba do .xlsx. */
function unzip(buffer: Buffer): ZipEntry[] {
  // Katalog centralny leży na końcu pliku, za sygnaturą „PK\x05\x06".
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 66000; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("To nie jest plik ZIP/XLSX")

  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break

    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength)

    // Nagłówek lokalny ma własne długości nazwy i pola „extra" — te z katalogu
    // centralnego potrafią się różnić, więc czytamy je stąd.
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const raw = buffer.subarray(start, start + compressedSize)

    entries.push({ name, data: method === 0 ? raw : inflateRawSync(raw) })
    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
}

/** Kolumna „AB" → indeks 27. */
function columnIndex(reference: string): number {
  const letters = reference.replace(/\d+/g, "")
  let value = 0
  for (const letter of letters) {
    value = value * 26 + (letter.charCodeAt(0) - 64)
  }
  return value - 1
}

function sharedStrings(entries: ZipEntry[]): string[] {
  const file = entries.find((entry) => entry.name === "xl/sharedStrings.xml")
  if (!file) return []

  const xml = file.data.toString("utf8")
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    // Tekst bywa porozbijany na `<r><t>` (fragmenty z różnym formatowaniem) —
    // sklejamy je w jeden napis.
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((part) => decodeXmlText(part[1]))
      .join("")
  )
}

export type SheetData = { name: string; rows: string[][] }

/**
 * Wszystkie arkusze pliku jako tablice napisów. Puste komórki to pusty napis,
 * więc wiersze mają równą długość i można je porównywać kolumnami.
 */
export function readWorkbook(buffer: Buffer): SheetData[] {
  const entries = unzip(buffer)
  const strings = sharedStrings(entries)

  // Nazwy arkuszy siedzą w workbook.xml, a treść w kolejnych sheetN.xml.
  const workbook = entries.find((entry) => entry.name === "xl/workbook.xml")
  const names = workbook
    ? Array.from(workbook.data.toString("utf8").matchAll(/<sheet[^>]*name="([^"]*)"/g)).map(
        (match) => decodeXmlText(match[1])
      )
    : []

  const sheets = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((a, b) => {
      const value = (name: string) => Number(name.match(/sheet(\d+)/)?.[1] || 0)
      return value(a.name) - value(b.name)
    })

  return sheets.map((sheet, index) => {
    const xml = sheet.data.toString("utf8")
    const rows: string[][] = []

    for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = []

      for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attributes = cellMatch[1]
        const body = cellMatch[2]
        const reference = attributes.match(/r="([A-Z]+\d+)"/)?.[1]
        const type = attributes.match(/t="([^"]+)"/)?.[1]

        let value = ""
        if (type === "inlineStr") {
          value = Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
            .map((part) => decodeXmlText(part[1]))
            .join("")
        } else {
          const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || ""
          value = type === "s" ? strings[Number(raw)] ?? "" : decodeXmlText(raw)
        }

        const position = reference ? columnIndex(reference) : cells.length
        while (cells.length < position) cells.push("")
        cells[position] = value.trim()
      }

      // Komórki bez treści Excel pomija — wiersz może być krótszy niż sąsiedzi.
      rows.push(cells)
    }

    const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
    for (const row of rows) {
      while (row.length < width) row.push("")
    }

    return { name: names[index] || `Arkusz ${index + 1}`, rows }
  })
}

/** CSV/TSV — cenniki przychodzą też w tej postaci. */
export function readDelimited(text: string): SheetData[] {
  const clean = text.replace(/^﻿/, "")
  const sample = clean.slice(0, 5000)
  const delimiter = [";", "\t", ","]
    .map((candidate) => ({ candidate, count: sample.split(candidate).length }))
    .sort((a, b) => b.count - a.count)[0].candidate

  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]

    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(cell.trim())
      cell = ""
    } else if (char === "\n") {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }

  const width = rows.reduce((max, item) => Math.max(max, item.length), 0)
  for (const item of rows) {
    while (item.length < width) item.push("")
  }

  return [{ name: "CSV", rows }]
}

export function readSpreadsheet(buffer: Buffer, filename = ""): SheetData[] {
  const isZip = buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50
  if (isZip) return readWorkbook(buffer)
  if (/\.(csv|tsv|txt)$/i.test(filename) || !isZip) return readDelimited(buffer.toString("utf8"))
  return readWorkbook(buffer)
}
