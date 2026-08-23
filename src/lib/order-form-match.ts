// Dopasowanie pozycji z cennika producenta do opcji w naszym konfiguratorze.
//
// Nasze nazwy są po polsku, cennik jest po angielsku — „Nawigacja Simrad NSS16
// EVO3 (mapa EU+antena GPS)" kontra „Chartplotter Simrad NSS16" EVO3, Chart EU".
// Porównywanie słów nie ma tu sensu. Działają dwie rzeczy, które przetrwały
// tłumaczenie: **nazwy własne i symbole** (Simrad, NSS16, Verado, Webasto)
// oraz **cena**.
//
// Docelowo i tak nie zgadujemy: po pierwszym sparowaniu zapisujemy przy opcji
// kod katalogowy i każda kolejna aktualizacja trafia w punkt.

import type { OrderFormOption } from "@/lib/order-form"

export type OurOption = {
  id: number | string
  name: string
  price: number
  group: string
  code: string
}

export type Pairing = {
  option: OrderFormOption
  /** Nasza opcja albo `null`, gdy nic sensownego się nie znalazło. */
  ourId: number | string | null
  ourName: string
  ourPrice: number | null
  score: number
  /** Skąd wzięło się dopasowanie — po tym człowiek wie, czy ufać. */
  by: "kod" | "sugestia" | ""
}

// Słowa, które w obu językach znaczą to samo tyle co nic.
const STOP = new Set([
  "the", "and", "with", "for", "incl", "including", "option", "options", "system",
  "boat", "xo", "eu", "us", "version", "kit", "set", "pcs", "black", "white",
  "do", "na", "z", "ze", "w", "i", "oraz", "wersja", "zestaw", "opcja", "szt",
])

/**
 * „Twarde" cząstki nazwy: symbole z cyframi i nazwy własne. To one przechodzą
 * przez tłumaczenie bez zmian, więc tylko na nich można polegać.
 */
function hardTokens(value: string): Set<string> {
  const out = new Set<string>()

  for (const raw of String(value || "").split(/[^\p{L}\p{N}."]+/u)) {
    const token = raw.replace(/^[."]+|[."]+$/g, "")
    if (token.length < 2) continue

    const lower = token.toLowerCase()
    if (STOP.has(lower)) continue

    // Symbole modeli: mają cyfrę („NSS16", „300", „EVO3", „8M0123025").
    if (/\d/.test(token)) {
      out.add(lower)
      continue
    }

    // Nazwy własne: pisane z wielkiej litery w środku zdania albo wersalikami.
    if (/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(token) && token.length >= 3) {
      out.add(lower)
    }
  }

  return out
}

/**
 * Same liczby wyłuskane z nazwy: „300V8" → 300 i 8, „350KM L6" → 350 i 6.
 * To po nich poznaje się, że „Verado 425" i „Verado 350" to dwa różne silniki,
 * choć obie nazwy mają te same słowa.
 */
function numberParts(value: string): Set<string> {
  const out = new Set<string>()
  for (const match of String(value || "").matchAll(/\d+/g)) {
    // Jednocyfrowe bywają numerem wersji albo liczbą sztuk — za słabe,
    // żeby na nich rozstrzygać.
    if (match[0].length >= 2 || Number(match[0]) >= 4) out.add(String(Number(match[0])))
  }
  return out
}

function overlap(a: Set<string>, b: Set<string>): number {
  let hits = 0
  for (const token of a) if (b.has(token)) hits += 1
  return hits
}

export function scorePair(option: OrderFormOption, ours: OurOption): number {
  // Twarda blokada na liczbach — ta sama zasada, która przy cennikach marek
  // nie pozwala pomylić Merry Fisher 895 z 795. Bez niej „Verado 425V10"
  // wskakiwał na nasz „Verado 350KM L6" i podmieniał mu cenę.
  const theirNumbers = numberParts(option.name)
  const ourNumbers = numberParts(ours.name)
  if (theirNumbers.size && ourNumbers.size && !overlap(theirNumbers, ourNumbers)) return 0

  const theirs = hardTokens(option.name)
  const mine = hardTokens(ours.name)

  const shared = overlap(theirs, mine)
  const base = shared ? Math.min(0.6, 0.22 * shared) : 0

  // Cena to najmocniejszy sygnał: identyczna kwota przy tej samej łodzi
  // prawie zawsze znaczy tę samą pozycję.
  let priceBonus = 0
  if (option.price > 0 && ours.price > 0) {
    if (option.price === ours.price) priceBonus = 0.45
    else {
      const diff = Math.abs(option.price - ours.price) / Math.max(option.price, ours.price)
      if (diff <= 0.06) priceBonus = 0.3
      else if (diff <= 0.15) priceBonus = 0.15
    }
  }

  // Bez ani jednej wspólnej nazwy własnej sama zgodna cena to za mało:
  // w cenniku bywa kilka pozycji po 600 EUR.
  if (!shared && priceBonus < 0.45) return 0
  if (!shared) return 0.35

  return Math.min(1, base + priceBonus)
}

export const PAIR_MIN = 0.45
export const PAIR_SURE = 0.7

/**
 * Zestawia cennik z naszym konfiguratorem. Kod katalogowy ma bezwzględne
 * pierwszeństwo; reszta to propozycje do potwierdzenia przez człowieka.
 */
export function pairOptions(options: OrderFormOption[], ours: OurOption[]): Pairing[] {
  const byCode = new Map<string, OurOption>()
  for (const item of ours) {
    if (item.code) byCode.set(item.code.toLowerCase(), item)
  }

  const taken = new Set<number | string>()
  const result: Pairing[] = []

  // Najpierw kody — te są pewne i nie konkurują z niczym.
  for (const option of options) {
    const match = option.code ? byCode.get(option.code.toLowerCase()) : undefined
    if (match) {
      taken.add(match.id)
      result.push({
        option,
        ourId: match.id,
        ourName: match.name,
        ourPrice: match.price,
        score: 1,
        by: "kod",
      })
    } else {
      result.push({ option, ourId: null, ourName: "", ourPrice: null, score: 0, by: "" })
    }
  }

  // Potem propozycje — od najpewniejszych, żeby dobra para nie przegrała
  // z gorszą tylko dlatego, że była wcześniej na liście.
  const pending = result.filter((item) => !item.ourId)
  const scored: { item: Pairing; ours: OurOption; score: number }[] = []

  for (const item of pending) {
    for (const candidate of ours) {
      if (taken.has(candidate.id)) continue
      const score = scorePair(item.option, candidate)
      if (score >= PAIR_MIN) scored.push({ item, ours: candidate, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  for (const { item, ours: candidate, score } of scored) {
    if (item.ourId || taken.has(candidate.id)) continue
    taken.add(candidate.id)
    item.ourId = candidate.id
    item.ourName = candidate.name
    item.ourPrice = candidate.price
    item.score = Number(score.toFixed(2))
    item.by = "sugestia"
  }

  return result
}
