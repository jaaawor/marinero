// Rozbiór arkusza XLSX i CSV — sama logika, bez dostępu do dysku i bez
// `node:zlib`, żeby ten sam kod działał na serwerze i w przeglądarce.
//
// Czytanie pliku po stronie przeglądarki nie jest fanaberią: nginx przepuszcza
// domyślnie 1 MB, a cennik producenta bywa większy — wtedy zamiast odpowiedzi
// wracał HTML-owy błąd 413 i narzędzie wywalało się na „Unexpected token '<'".
// Skoro plik i tak zamieniamy na kilkaset wierszy tekstu, nie ma powodu wysyłać
// go w całości.

export type SheetData = { name: string; rows: string[][] }

export type ZipEntry = { name: string; data: Uint8Array }

const decoder = new TextDecoder("utf-8")

function text(data: Uint8Array): string {
  return decoder.decode(data)
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

  const xml = text(file.data)
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    // Tekst bywa porozbijany na `<r><t>` (fragmenty z różnym formatowaniem) —
    // sklejamy je w jeden napis.
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((part) => decodeXmlText(part[1]))
      .join("")
  )
}

/** Rozpakowane pliki archiwum → arkusze. */
export function parseSheets(entries: ZipEntry[]): SheetData[] {
  const strings = sharedStrings(entries)

  const workbook = entries.find((entry) => entry.name === "xl/workbook.xml")
  const names = workbook
    ? Array.from(text(workbook.data).matchAll(/<sheet[^>]*name="([^"]*)"/g)).map((match) =>
        decodeXmlText(match[1])
      )
    : []

  const sheets = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((a, b) => {
      const value = (name: string) => Number(name.match(/sheet(\d+)/)?.[1] || 0)
      return value(a.name) - value(b.name)
    })

  return sheets.map((sheet, index) => {
    const xml = text(sheet.data)
    const rows: string[][] = []

    for (const rowMatch of xml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = []

      // Excel pomija wiersze bez treści, więc pozycja w dokumencie nie jest
      // numerem wiersza w arkuszu. Numer bierzemy z atrybutu `r` — inaczej
      // „wiersz 44" w podglądzie wskazywałby na zupełnie inną pozycję pliku.
      const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1]) || rows.length + 1

      // Komórka pusta jest zapisana jako `<c r="A23" s="56"/>` — bez treści
      // i bez znacznika zamykającego. Regexp wymagający `</c>` łykał wtedy
      // zawartość NASTĘPNEJ komórki jako własną, przez co numer tekstu
      // z tablicy `sharedStrings` lądował w arkuszu jako goła liczba,
      // a prawdziwy opis znikał. Stąd „śmieciowe" wiersze w cennikach.
      for (const cellMatch of rowMatch[2].matchAll(
        /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
      )) {
        const attributes = cellMatch[1]
        const body = cellMatch[2] || ""
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

      // Pominięte wiersze uzupełniamy pustymi, żeby indeks w tablicy równał się
      // numerowi wiersza w arkuszu (minus jeden).
      while (rows.length < rowNumber - 1) rows.push([])
      rows[rowNumber - 1] = cells
    }

    return { name: names[index] || `Arkusz ${index + 1}`, rows: pad(rows) }
  })
}

function pad(rows: string[][]): string[][] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  for (const row of rows) {
    while (row.length < width) row.push("")
  }
  return rows
}

/** CSV/TSV — cenniki przychodzą też w tej postaci. */
export function readDelimited(input: string): SheetData[] {
  const clean = input.replace(/^﻿/, "")
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

  return [{ name: "CSV", rows: pad(rows) }]
}

/**
 * Katalog centralny ZIP-a → lista wpisów z surowymi (jeszcze spakowanymi)
 * danymi. Rozpakowanie zostawiamy wywołującemu, bo w Node robi to `zlib`,
 * a w przeglądarce `DecompressionStream`.
 */
export function zipEntries(
  buffer: Uint8Array
): { name: string; method: number; data: Uint8Array }[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  let eocd = -1
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 66000; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("To nie jest plik ZIP/XLSX")

  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const entries: { name: string; method: number; data: Uint8Array }[] = []

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break

    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLength))

    // Nagłówek lokalny ma własne długości nazwy i pola „extra" — te z katalogu
    // centralnego potrafią się różnić, więc czytamy je stąd.
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + localNameLength + localExtraLength

    entries.push({
      name,
      method,
      data: buffer.subarray(start, start + compressedSize),
    })

    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

export function looksLikeZip(buffer: Uint8Array): boolean {
  return (
    buffer.length > 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  )
}
