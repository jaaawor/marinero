// Odczyt cennika-formularza zamówienia od producenta łodzi.
//
// Producenci przysyłają „order form": tabelę z kodem katalogowym, opisem
// i ceną jednostkową, poprzetykaną nagłówkami sekcji. Każda marka ma inny
// układ kolumn i inne nazwy nagłówków, więc niczego nie zakładamy —
// rozpoznajemy kolumny po zawartości i po słowach kluczowych w nagłówku.
//
// Najważniejszy jest **kod katalogowy**. Nasz konfigurator jest po polsku,
// a cennik po angielsku („Nawigacja Simrad NSS16" vs „Chartplotter Simrad
// NSS16" EVO3"), więc dopasowanie po nazwach jest z góry przegrane. Kod
// zapisany raz przy pierwszym imporcie sprawia, że każda kolejna aktualizacja
// trafia w punkt bez zgadywania.

import { parseAmount } from "@/lib/pricelist"
import type { SheetData } from "@/lib/xlsx-parse"

export type OrderFormOption = {
  /** Numer wiersza w arkuszu — po nim człowiek odnajdzie pozycję w Excelu. */
  line: number
  code: string
  name: string
  price: number
  /** Nazwa sekcji, pod którą pozycja stoi w cenniku. */
  group: string
  groupCode: string
  /** Sekcje z „(choose one)" to wybór jednej opcji, nie zaznaczanie wielu. */
  groupType: "radio" | "checkbox"
}

export type OrderForm = {
  boat: string
  basePrice: number | null
  currency: string
  options: OrderFormOption[]
  groups: { title: string; code: string; type: "radio" | "checkbox"; count: number }[]
}

const HEADER_CODE = /\b(part\s*code|kod|code|item|art\.?\s*nr|sku)\b/i
const HEADER_NAME = /\b(description|opis|name|nazwa|item|produkt)\b/i
const HEADER_PRICE = /\b(unit\s*price|price|cena|preis|prix|netto|eur|usd)\b/i

const BASE_PRICE = /boat\s*price|base\s*price|cena\s*bazowa|standard\s*equipment|according\s*to\s*standard/i
const CHOOSE_ONE = /\(\s*choose\s*one\s*\)|wybierz\s*jedn|choose\s*1/i

/** Wiersz nagłówka tabeli — ten, w którym stoją nazwy kolumn. */
function findHeader(rows: string[][]): { row: number; code: number; name: number; price: number } | null {
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const row = rows[index] || []
    let code = -1
    let name = -1
    let price = -1

    row.forEach((cell, column) => {
      const text = String(cell || "").trim()
      if (!text) return
      if (code < 0 && HEADER_CODE.test(text) && text.length < 24) code = column
      if (name < 0 && HEADER_NAME.test(text) && text.length < 24) name = column
      if (price < 0 && HEADER_PRICE.test(text) && text.length < 24) price = column
    })

    // Sam „Description" bez ceny to jeszcze nie tabela — nagłówek musi mieć oba.
    if (name >= 0 && price >= 0) return { row: index, code, name, price }
  }

  return null
}

/**
 * Kolumny bez nagłówka: nazwa to najbogatsza kolumna tekstowa, cena to
 * kolumna z największą liczbą kwot, kod stoi zwykle po lewej od nazwy.
 */
function guessColumns(rows: string[][]): { row: number; code: number; name: number; price: number } | null {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (!width) return null

  let price = -1
  let priceCount = 0
  let name = -1
  let nameScore = 0

  for (let column = 0; column < width; column += 1) {
    const amounts = rows
      .map((row) => parseAmount(row[column] || ""))
      .filter((amount): amount is number => amount !== null && amount >= 50)
    if (amounts.length > priceCount) {
      priceCount = amounts.length
      price = column
    }
  }

  for (let column = 0; column < width; column += 1) {
    if (column === price) continue
    const values = rows
      .map((row) => (row[column] || "").trim())
      .filter((value) => value.length >= 8 && /[a-z]{3}/i.test(value))
    const distinct = new Set(values).size
    if (distinct > nameScore) {
      nameScore = distinct
      name = column
    }
  }

  if (name < 0 || price < 0 || priceCount < 3) return null
  return { row: -1, code: name > 0 ? name - 1 : -1, name, price }
}

function looksLikeCode(value: string): boolean {
  const text = String(value || "").trim()
  if (!text || text.length > 20) return false
  // Kod ma cyfry i litery albo jest krótkim ciągiem alfanumerycznym bez spacji.
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(text) && /\d/.test(text)
}

export function readOrderForm(sheet: SheetData): OrderForm | null {
  const rows = sheet.rows
  const columns = findHeader(rows) || guessColumns(rows)
  if (!columns) return null

  const boat = (rows[0] || []).find((cell) => cell && cell.length > 2) || ""
  const all = rows.flat().join(" ")
  const currency = /€|\beur\b/i.test(all)
    ? "EUR"
    : /\$|\busd\b/i.test(all)
      ? "USD"
      : /zł|\bpln\b/i.test(all)
        ? "PLN"
        : "EUR"

  const options: OrderFormOption[] = []
  const groups: OrderForm["groups"] = []
  let basePrice: number | null = null
  let group = ""
  let groupCode = ""
  let groupType: "radio" | "checkbox" = "checkbox"

  for (let index = columns.row + 1; index < rows.length; index += 1) {
    const row = rows[index] || []
    const code = columns.code >= 0 ? String(row[columns.code] || "").trim() : ""
    const name = String(row[columns.name] || "").trim()
    const price = parseAmount(row[columns.price] || "")

    if (!name) continue

    // Cena bazowa: pierwszy wiersz mówiący o „boat price / standard equipment".
    if (basePrice === null && price !== null && price > 0 && BASE_PRICE.test(name)) {
      basePrice = price
      continue
    }

    // Nagłówek sekcji: opis bez ceny. To po nim dzielimy cennik na grupy.
    if (price === null) {
      group = name
      groupCode = looksLikeCode(code) ? code : ""
      groupType = CHOOSE_ONE.test(name) ? "radio" : "checkbox"
      groups.push({ title: group, code: groupCode, type: groupType, count: 0 })
      continue
    }

    options.push({
      line: index + 1,
      code: looksLikeCode(code) ? code : "",
      name,
      price,
      group,
      groupCode,
      groupType,
    })

    if (groups.length) groups[groups.length - 1].count += 1
  }

  if (!options.length) return null

  return {
    boat,
    basePrice,
    currency,
    options,
    groups: groups.filter((item) => item.count > 0),
  }
}

/** Pierwszy arkusz, z którego da się wyciągnąć cennik. */
export function findOrderForm(sheets: SheetData[]): { sheet: number; form: OrderForm } | null {
  for (let index = 0; index < sheets.length; index += 1) {
    const form = readOrderForm(sheets[index])
    if (form) return { sheet: index, form }
  }
  return null
}
