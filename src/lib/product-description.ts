// Opisy przyjechały z WooCommerce jako jeden ciąg tekstu — dane techniczne
// sklejone ze zdaniami, bez akapitów i bez tabel. Tutaj rozbijamy je na
// wstęp i listę parametrów, nie zmieniając ani jednego słowa źródła.

export type DescriptionSpec = { label: string; value: string }

export type FormattedDescription = {
  intro: string[]
  specs: DescriptionSpec[]
}

// Nagłówki, po których w opisach zaczyna się część techniczna.
const SPEC_HEADINGS = [
  "DANE TECHNICZNE",
  "OGÓLNE DANE TECHNICZE",
  "OGÓLNE DANE TECHNICZNE",
  "SPECYFIKACJA",
  "PARAMETRY",
]

// Etykiety parametrów spotykane w opisach silników i osprzętu.
// Dłuższe muszą być pierwsze, żeby „Pojemność skokowa" wygrała z „Pojemność".
const SPEC_LABELS = [
  "Prędkość obrotowa przy całkowicie otwartej przepustnicy",
  "Możliwe do zastosowania śruby napędowe",
  "Standardowa śruba napędowa (skok)",
  "Standardowa śruba napędowa",
  "Sposób trymowania i odchylania",
  "Rozruchowe wzbogacenie mieszanki",
  "Zalecana wysokość pawęży",
  "Pojemność zbiornika paliwa",
  "Pojemność miski olejowej",
  "Średnica x skok tłoka",
  "Schemat zmiany biegów",
  "Numer katalogowy",
  "Pojemność skokowa",
  "Liczba cylindrów",
  "Układ rozruchowy",
  "Mocowanie silnika",
  "Układ zapłonowy",
  "Rodzaj silnika",
  "Układ zasilania",
  "Masa silnika",
  "Wylot spalin",
  "Przełożenie",
  "Alternator",
  "Sterowanie",
  "Producent",
  "Moc maks.",
  "Gwarancja",
  "Materiał",
  "Wymiary",
  "Napięcie",
  "Model",
  "Masa",
  "Waga",
  "Moc",
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/^[:–—-]\s*/, "")
}

// Na końcu opisów siedzi ogon fraz pod wyszukiwarkę: „silnik 6 KM, silnik
// suzuki 6 KM, silnik zaburtowy 6 KM…". Dla czytelnika to szum.
function stripKeywordTail(text: string): string {
  const tail = text.slice(-320)
  const commaIndex = tail.indexOf(",")
  if (commaIndex < 0) return text

  const candidate = tail.slice(commaIndex)
  const parts = candidate.split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length < 3) return text

  const first = parts[0].split(/\s+/)[0]?.toLowerCase()
  if (!first) return text

  const repeats = parts.filter((part) => part.toLowerCase().startsWith(first)).length
  if (repeats < 3) return text

  return text.slice(0, text.length - candidate.length).trim().replace(/[.,;]$/, "")
}

// Garmin zapisuje parametry jako „WIELKIE LITERY : wartość".
function parseUppercasePairs(text: string): DescriptionSpec[] {
  const pattern = /([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ0-9 .,%()\/–-]{3,70}?)\s*:\s*/g
  const matches = [...text.matchAll(pattern)]
  if (matches.length < 3) return []

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length
      return { label: clean(match[1]), value: clean(text.slice(start, end)) }
    })
    .filter((spec) => spec.label && spec.value)
}

// Silniki mają etykiety pisane normalnie, bez dwukropka — rozcinamy po słowniku.
function parseLabelledPairs(text: string): DescriptionSpec[] {
  const pattern = new RegExp(`(${SPEC_LABELS.map(escapeRegExp).join("|")})`, "g")
  const matches = [...text.matchAll(pattern)]
  if (matches.length < 3) return []

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length
      return { label: clean(match[1]), value: clean(text.slice(start, end)) }
    })
    .filter((spec) => spec.value && spec.value.length < 220)
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9])/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Dzieli opis na czytelny wstęp i tabelę parametrów.
 * Gdy nic nie da się rozpoznać, zwraca sam tekst pocięty na akapity.
 */
export function formatDescription(description: string): FormattedDescription {
  const text = stripKeywordTail((description || "").replace(/\s+/g, " ").trim())
  if (!text) return { intro: [], specs: [] }

  const heading = SPEC_HEADINGS.map((item) => ({ item, index: text.indexOf(item) })).find(
    (entry) => entry.index >= 0
  )

  const introRaw = heading ? text.slice(0, heading.index) : text
  const specsRaw = heading ? text.slice(heading.index + heading.item.length) : ""

  const specs = specsRaw
    ? parseUppercasePairs(specsRaw).length >= 3
      ? parseUppercasePairs(specsRaw)
      : parseLabelledPairs(specsRaw)
    : parseUppercasePairs(text)

  // Gdy parametry wyszły z całego tekstu, wstęp to fragment przed pierwszym z nich
  const intro = heading
    ? splitSentences(introRaw)
    : specs.length
      ? splitSentences(text.slice(0, text.indexOf(specs[0].label)))
      : splitSentences(text)

  return { intro: intro.filter(Boolean), specs }
}
