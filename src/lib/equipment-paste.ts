// Wklejona lista wyposażenia → grupy i pozycje.
//
// Dodawanie wyposażenia po jednej pozycji w panelu jest nie do przejścia:
// przy jednej łodzi bywa i trzysta wierszy. Cennik czy specyfikację od
// producenta ma się zwykle w schowku, więc tu wystarczy je wkleić.
//
// Rozpoznajemy to, co realnie przychodzi z PDF-a, Worda i Excela:
// nagłówki sekcji, punktory, numerację, ceny w kilku zapisach i separatory
// kolumn (tabulator, średnik). Nic nie zgadujemy po cichu — wynik tej funkcji
// trafia najpierw na podgląd do poprawy.

export type PastedItem = {
  /** Nazwa pozycji. */
  text: string
  /** Dopłata; `null` przy wyposażeniu standardowym i przy pozycjach bez ceny. */
  price: number | null
}

export type PastedGroup = {
  title: string
  items: PastedItem[]
}

export type PasteMode = "standardowe" | "dodatkowe"

/** Punktory i numeracja z początku wiersza. */
const BULLET = /^[\s ]*(?:[-–—•·*▪●○o]|\(?\d{1,3}[.)]|[a-z][.)])\s+/i

/** Wiersz, który jest tylko numerem strony albo kreską — śmieć z PDF-a. */
const NOISE = /^[\s ]*(?:[-–—_=.·•]+|str\.?\s*\d+|strona\s*\d+|page\s*\d+|\d{1,3})[\s ]*$/i

/**
 * Cena na końcu wiersza. Bierzemy tylko koniec, bo nazwy same w sobie niosą
 * liczby („Głośniki 6,5" 200 W", „Winda kotwiczna 40 m") i szukanie liczby
 * gdziekolwiek w wierszu robiłoby z nich ceny.
 */
const PRICE_AT_END =
  /[\s ;\t|]+(?:za\s+)?(?:EUR|USD|PLN|€|\$|zł)?[\s ]*(\d{1,3}(?:[  .,]\d{3})+|\d+(?:[.,]\d{1,2})?)[\s ]*(?:EUR|USD|PLN|€|\$|zł|,-)?[\s ]*$/i

/** Wiersz z ceną „0", „w standardzie", „gratis" — pozycja jest, dopłaty nie ma. */
const FREE_AT_END =
  /[\s ;\t|]+(?:w\s+standardzie|standard|gratis|bezpłatnie|w\s+cenie|included|incl\.?)[\s ]*$/i

function toNumber(raw: string): number | null {
  // „12 500", „12.500", „12,500" to tysiące; „12,50" i „12.50" to grosze.
  let s = raw.replace(/[\s ]/g, "")
  const sep = s.match(/[.,](\d{1,2})$/)
  if (sep) {
    s = s.slice(0, sep.index).replace(/[.,]/g, "") + "." + sep[1]
  } else {
    s = s.replace(/[.,]/g, "")
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Rozbicie wiersza na nazwę i cenę. */
function splitPrice(line: string): { text: string; price: number | null } {
  const free = line.match(FREE_AT_END)
  if (free) return { text: line.slice(0, free.index).trim(), price: 0 }

  const m = line.match(PRICE_AT_END)
  if (!m) return { text: line.trim(), price: null }

  const text = line.slice(0, m.index).trim()
  // Sam numer bez nazwy to nie pozycja — zwykle ucięty wiersz z tabeli.
  if (!text) return { text: line.trim(), price: null }
  return { text, price: toNumber(m[1]) }
}

/** Nagłówek sekcji: wiersz zakończony dwukropkiem albo pisany wersalikami. */
function looksLikeHeading(line: string): boolean {
  if (/:\s*$/.test(line)) return true
  const litery = line.replace(/[^\p{L}]/gu, "")
  if (litery.length >= 3 && litery.length <= 60 && litery === litery.toUpperCase()) return true
  return false
}

function cleanup(line: string): string {
  return line
    .replace(/ /g, " ")
    .replace(BULLET, "")
    // Kropki wiodące do ceny („Radar ......... 3 750") i kreska zostawiona po
    // odcięciu ceny. Pojedynczej kropki nie ruszamy — inaczej „4 szt." robi
    // się „4 szt".
    .replace(/\s*[.·•]{2,}\s*$/, "")
    .replace(/\s*[-–—:;|]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Zamienia wklejony tekst na grupy z pozycjami.
 *
 * Przy trybie „dodatkowe" wiersz **z ceną** jest opcją, a wiersz **bez ceny**
 * nagłówkiem grupy — dokładnie tak, jak czytamy formularze zamówień od
 * producentów (`order-form.ts`). Przy „standardowym" cen nie ma wcale,
 * więc nagłówek poznajemy po dwukropku albo wersalikach.
 */
export function parseEquipmentPaste(raw: string, mode: PasteMode): PastedGroup[] {
  const groups: PastedGroup[] = []

  function open(title: string): PastedGroup {
    const group: PastedGroup = {
      title: title.replace(/:\s*$/, "").trim() || "Wyposażenie",
      items: [],
    }
    groups.push(group)
    return group
  }

  let current: PastedGroup | null = null

  for (const rawLine of String(raw || "").split(/\r?\n/)) {
    const line = rawLine.replace(/ /g, " ")
    if (!line.trim() || NOISE.test(line)) continue

    // Tabulator i średnik to separator kolumn z arkusza — cena stoi po nim.
    const columns = line.split(/\t|(?<!\d);(?!\d)/).map((x) => x.trim()).filter(Boolean)
    const joined = columns.length > 1 ? columns.join(" ") : line

    const { text, price } =
      mode === "dodatkowe" ? splitPrice(joined) : { text: joined, price: null }
    const name = cleanup(text)
    if (!name) continue

    const heading = mode === "dodatkowe" ? price === null : looksLikeHeading(line)
    if (heading) {
      current = open(name)
      continue
    }

    if (!current) {
      current = open(mode === "dodatkowe" ? "Wyposażenie dodatkowe" : "Wyposażenie standardowe")
    }
    current.items.push({ text: name, price: mode === "dodatkowe" ? price ?? 0 : null })
  }

  // Nagłówek bez ani jednej pozycji pod spodem to nie sekcja, tylko zdanie
  // wtrącone w listę — wraca jako zwykła pozycja do grupy obok.
  const wynik: PastedGroup[] = []
  for (const g of groups) {
    if (g.items.length) {
      wynik.push(g)
      continue
    }
    const prev = wynik[wynik.length - 1]
    if (prev) prev.items.push({ text: g.title, price: mode === "dodatkowe" ? 0 : null })
  }

  return wynik.filter((g) => g.items.length)
}

/** Ile pozycji w komplecie — do podsumowania nad podglądem. */
export function countItems(groups: PastedGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0)
}
