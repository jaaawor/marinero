// Rozpoznawanie cennika producenta i dopasowanie go do modeli w Directusie.
//
// Cenniki przychodzą po angielsku i w każdym roku w innym układzie: raz nazwa
// w kolumnie B, raz w D, raz z nagłówkiem „Model", raz „Description". Dlatego
// nie zakładamy niczego o kolumnach — szukamy ich po zawartości i pokazujemy
// człowiekowi, co wyszło, ZANIM cokolwiek zapiszemy.

export type PriceRow = {
  /** Numer wiersza w arkuszu — po nim człowiek odnajduje pozycję w Excelu. */
  line: number
  label: string
  price: number | null
  currency: string
}

export type ModelRef = {
  id: number | string
  name: string
  slug: string
  brand: string
  basePrice: number | null
  currency: string
}

export type Proposal = {
  line: number
  label: string
  price: number | null
  currency: string
  modelId: number | string | null
  modelName: string
  modelSlug: string
  currentPrice: number | null
  currentCurrency: string
  /** 0–1; poniżej `MATCH_MIN` nie proponujemy nic. */
  score: number
}

export const MATCH_MIN = 0.5
export const MATCH_SURE = 0.78

const CURRENCY_SIGNS: [RegExp, string][] = [
  [/€|\beur\b/i, "EUR"],
  [/\$|\busd\b/i, "USD"],
  [/zł|\bpln\b/i, "PLN"],
  [/£|\bgbp\b/i, "GBP"],
  [/\bnok\b/i, "NOK"],
  [/\bsek\b/i, "SEK"],
]

export function detectCurrency(text: string): string {
  for (const [pattern, code] of CURRENCY_SIGNS) {
    if (pattern.test(text)) return code
  }
  return ""
}

/**
 * „1 234,56", „1,234.56", „€ 885 000,-", „885000" → liczba.
 * O tym, czy przecinek jest częścią ułamkową czy separatorem tysięcy,
 * decyduje pozycja ostatniego separatora: dwie cyfry po nim = grosze.
 */
export function parseAmount(value: string): number | null {
  const text = String(value || "")
    .replace(/[\s ']/g, "")
    .replace(/[€$£]|zł|EUR|USD|PLN|GBP|NOK|SEK/gi, "")
    .replace(/,-$/, "")
    .trim()

  if (!text || !/\d/.test(text)) return null
  if (!/^[-+]?[\d.,]+$/.test(text)) return null

  const lastComma = text.lastIndexOf(",")
  const lastDot = text.lastIndexOf(".")
  let normalized = text

  if (lastComma > lastDot) {
    // Przecinek jest ostatni: albo grosze („1.234,56"), albo tysiące („1,234").
    const tail = text.length - lastComma - 1
    normalized = tail === 3 ? text.replace(/[.,]/g, "") : text.replace(/\./g, "").replace(",", ".")
  } else if (lastDot > lastComma) {
    const tail = text.length - lastDot - 1
    normalized = tail === 3 ? text.replace(/[.,]/g, "") : text.replace(/,/g, "")
  } else {
    normalized = text
  }

  const number = Number(normalized)
  if (!Number.isFinite(number)) return null
  return number
}

function looksLikeName(value: string): boolean {
  return /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3}/.test(value) && value.length >= 4 && value.length <= 120
}

/**
 * Kolumna z nazwą i kolumna z ceną — wybrane po zawartości, nie po nagłówku.
 * Cena to kolumna z największą liczbą sensownych kwot; nazwa to kolumna
 * tekstowa najbliżej lewej krawędzi, która ma najwięcej różnych wartości.
 */
export function detectColumns(rows: string[][]): { name: number; price: number } | null {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (!width) return null

  let priceColumn = -1
  let priceCount = 0

  for (let column = 0; column < width; column += 1) {
    const amounts = rows
      .map((row) => parseAmount(row[column] || ""))
      .filter((amount): amount is number => amount !== null && amount >= 1000)

    if (amounts.length > priceCount) {
      priceCount = amounts.length
      priceColumn = column
    }
  }

  if (priceColumn < 0 || priceCount < 2) return null

  let nameColumn = -1
  let nameScore = 0

  for (let column = 0; column < width; column += 1) {
    if (column === priceColumn) continue

    const values = rows.map((row) => (row[column] || "").trim()).filter(looksLikeName)
    const distinct = new Set(values.map((value) => value.toLowerCase())).size
    // Kolumny z lewej wygrywają remisy — tam zwykle stoi nazwa modelu.
    const score = distinct - column * 0.01

    if (distinct >= 2 && score > nameScore) {
      nameScore = score
      nameColumn = column
    }
  }

  if (nameColumn < 0) return null
  return { name: nameColumn, price: priceColumn }
}

export function extractRows(rows: string[][]): PriceRow[] {
  const columns = detectColumns(rows)
  if (!columns) return []

  // Waluta bywa podana raz, w nagłówku arkusza — bierzemy pierwszą znalezioną
  // w całym pliku i dopiero potem szukamy jej przy konkretnej kwocie.
  const sheetCurrency = detectCurrency(rows.flat().slice(0, 200).join(" "))

  const out: PriceRow[] = []

  rows.forEach((row, index) => {
    const label = (row[columns.name] || "").trim()
    const rawPrice = row[columns.price] || ""
    const price = parseAmount(rawPrice)

    if (!looksLikeName(label)) return
    if (price === null || price < 1000) return

    out.push({
      line: index + 1,
      label,
      price,
      currency: detectCurrency(rawPrice) || detectCurrency(label) || sheetCurrency || "EUR",
    })
  })

  return out
}

const NOISE = new Set([
  "boat", "boats", "yacht", "yachts", "model", "models", "price", "list", "netto", "net",
  "excl", "vat", "eur", "usd", "pln", "the", "and", "with", "new", "serie", "series",
])

function tokenize(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token && !NOISE.has(token))
}

function numbers(tokens: string[]): string[] {
  return tokens.filter((token) => /^\d+$/.test(token))
}

/**
 * Dopasowanie nazwy z cennika do modelu. Liczby traktujemy twardo: „895"
 * i „795" to dwie różne łodzie, więc rozbieżność w liczbach kasuje dopasowanie
 * niezależnie od tego, jak podobne są słowa.
 */
export function scoreMatch(label: string, model: ModelRef): number {
  const source = tokenize(label)
  // Nazwy w bazie bywają zapisane z marką („Jeanneau Merry Fisher 795"),
  // a bywają bez niej. Marka liczy się osobno i tylko na plus: cennik
  // Jeanneau nie powtarza słowa „Jeanneau" w każdym wierszu, więc karanie
  // za jego brak zbijało wszystkie dopasowania poniżej progu pewności.
  const brand = Array.from(new Set(tokenize(model.brand)))
  const full = Array.from(new Set(tokenize(model.name)))
  const core = full.filter((token) => !brand.includes(token))
  // Jeśli po odjęciu marki nic nie zostaje (model nazywa się jak marka),
  // wracamy do pełnej nazwy.
  const name = core.length ? core : full

  if (!source.length || !name.length) return 0

  const sourceSet = new Set(source)
  const sourceNumbers = new Set(numbers(source))
  const nameNumbers = numbers(name)

  if (nameNumbers.length) {
    // „895" i „795" to dwie różne łodzie — każda liczba z nazwy modelu
    // musi znaleźć się w cenniku, inaczej dopasowania nie ma w ogóle.
    if (!nameNumbers.every((token) => sourceNumbers.has(token))) return 0
  } else if (sourceNumbers.size) {
    return 0.2
  }

  const matched = name.filter((token) => sourceSet.has(token)).length
  const base = matched / name.length
  const brandBonus = brand.length && brand.every((token) => sourceSet.has(token)) ? 0.06 : 0

  // Nadmiar słów w cenniku („SERIE 2 CABIN VERSION") lekko obniża pewność.
  const known = new Set([...name, ...brand])
  const extra = source.filter((token) => !known.has(token)).length
  const penalty = Math.min(0.2, extra * 0.05)

  return Math.max(0, Math.min(1, base + brandBonus - penalty))
}

export function buildProposals(rows: PriceRow[], models: ModelRef[]): Proposal[] {
  return rows.map((row) => {
    let best: ModelRef | null = null
    let bestScore = 0

    for (const model of models) {
      const score = scoreMatch(row.label, model)
      if (score > bestScore) {
        bestScore = score
        best = model
      }
    }

    const matched = bestScore >= MATCH_MIN ? best : null

    return {
      line: row.line,
      label: row.label,
      price: row.price,
      currency: row.currency,
      modelId: matched?.id ?? null,
      modelName: matched?.name || "",
      modelSlug: matched?.slug || "",
      currentPrice: matched?.basePrice ?? null,
      currentCurrency: matched?.currency || "",
      score: matched ? Number(bestScore.toFixed(2)) : 0,
    }
  })
}
