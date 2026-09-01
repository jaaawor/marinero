// Cena detaliczna (sugerowana cena od dostawcy) i przekreślona cena regularna.
//
// Dwie różne rzeczy w jednym polu, więc rozdzielamy je świadomie:
//
//  1. **Liczba** (`cena_detaliczna`) to cena katalogowa producenta albo
//     hurtownika. Służy do porównania w panelu — widać obok, ile ktoś sugeruje,
//     a ile realnie bierzemy w sklepie i na Allegro.
//  2. **Przełącznik** (`cena_przekreslona`) mówi, czy pokazać ją klientowi jako
//     przekreśloną cenę regularną. Jest osobny, bo cena katalogowa jest prawie
//     zawsze wyższa od naszej i bez tego **cały katalog wyglądałby na
//     przeceniony** — a stała promocja przy każdej pozycji to nie promocja,
//     tylko szum, i w dodatku UOKiK ma o tym zdanie.
//
// Plik jest wolny od sieci i sekretów: czyta go panel, kafelek produktu,
// strona produktu i feed do Google — każdy z tych czterech musi pokazywać
// tę samą liczbę.

export type CenaRegularna = {
  /** Cena przed przecenią — ta przekreślona. */
  regularna: number
  /** Ile procent taniej, zaokrąglone w dół. */
  rabat: number
}

/** Sama liczba z metadanych — bez pytania, czy wolno ją pokazać klientowi. */
export function cenaDetaliczna(metadata: Record<string, unknown> | undefined): number | null {
  const surowa = metadata?.cena_detaliczna
  if (surowa === null || surowa === undefined || surowa === "") return null

  const liczba = Number(String(surowa).replace(",", "."))
  return Number.isFinite(liczba) && liczba > 0 ? Math.round(liczba * 100) / 100 : null
}

/** Czy sprzedawca włączył pokazywanie przekreślonej ceny przy tym produkcie. */
export function przekreslonaWlaczona(metadata: Record<string, unknown> | undefined): boolean {
  const surowa = metadata?.cena_przekreslona
  return surowa === true || surowa === "true" || surowa === 1 || surowa === "1"
}

/**
 * Co pokazać klientowi. `null` znaczy „nic" — i tak jest w trzech przypadkach:
 * przełącznik wyłączony, brak ceny detalicznej albo cena detaliczna **nie jest
 * wyższa** od naszej. Ten trzeci przypadek jest ważny: przekreślona kwota
 * niższa albo równa obecnej wygląda jak pomyłka w sklepie, a nie jak okazja.
 */
export function cenaRegularna(
  metadata: Record<string, unknown> | undefined,
  cena: number | null | undefined
): CenaRegularna | null {
  if (typeof cena !== "number" || !Number.isFinite(cena) || cena <= 0) return null
  if (!przekreslonaWlaczona(metadata)) return null

  const regularna = cenaDetaliczna(metadata)
  if (regularna === null || regularna <= cena) return null

  return { regularna, rabat: Math.floor(((regularna - cena) / regularna) * 100) }
}

/** Data ostatniej zmiany — z metadanych, jako `Date` albo `null`. */
export function kiedyZmieniona(
  metadata: Record<string, unknown> | undefined,
  klucz: "cena_zmieniona" | "cena_detaliczna_zmieniona"
): Date | null {
  const surowa = metadata?.[klucz]
  if (typeof surowa !== "string" || !surowa) return null

  const data = new Date(surowa)
  return Number.isNaN(data.getTime()) ? null : data
}

/** „12.03.2026" albo pusto — do tabeli w panelu. */
export function dzien(data: Date | null): string {
  if (!data) return ""
  return data.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
}
