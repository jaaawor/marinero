// Parametry techniczne produktu — jedno miejsce dla panelu i dla filtrów.
//
// Katalog przyszedł z WooCommerce jako gołe nazwy, więc długość kolumny,
// sterowanie i moc **zgadujemy z tytułu** (`product-family.ts`). Działa to
// dla silników Suzuki, Mercury i Torqeedo, bo one mają regularne oznaczenia —
// i nie działa dla niczego, co sprzedawca dopisze ręcznie. Nowy produkt
// wpadał przez to do katalogu bez ani jednego filtra: nie dało się go znaleźć
// przez „do 10 KM", „rumpel" ani „krótka kolumna".
//
// Dlatego parametr **wpisany w panelu wygrywa** z odczytem z nazwy. Zgadywanie
// zostaje jako podkładka pod te 387 produktów, których nikt nie będzie
// przeklikiwał po jednym.

import type { ShopProduct } from "@/lib/medusa"
import { parseProduct } from "@/lib/product-family"

export type ParametrOpcja = { wartosc: string; nazwa: string }

export type Parametr = {
  /** Klucz w metadanych produktu w Medusie. */
  klucz: string
  /** Nazwa w panelu. */
  nazwa: string
  /** Lista wartości; brak listy = pole liczbowe. */
  opcje?: ParametrOpcja[]
  jednostka?: string
}

/**
 * Parametry, po których **da się filtrować w sklepie**.
 *
 * Celowo nie ma tu wszystkiego, co można o produkcie powiedzieć: pole,
 * którego nie ma w filtrach, to praca sprzedawcy zamieniona w nic. Kolejny
 * parametr dokładamy razem z filtrem, który go używa (`shop-filters.ts`).
 */
export const PARAMETRY: Parametr[] = [
  {
    klucz: "paliwo",
    nazwa: "Rodzaj silnika",
    opcje: [
      { wartosc: "spalinowy", nazwa: "Spalinowy" },
      { wartosc: "elektryczny", nazwa: "Elektryczny" },
    ],
  },
  {
    klucz: "moc",
    nazwa: "Moc",
    jednostka: "KM",
  },
  {
    klucz: "kolumna",
    nazwa: "Długość kolumny",
    opcje: [
      { wartosc: "S", nazwa: "S — krótka (381 mm)" },
      { wartosc: "L", nazwa: "L — długa (508 mm)" },
      { wartosc: "X", nazwa: "X — bardzo długa (635 mm)" },
      { wartosc: "XX", nazwa: "XX — ekstra długa (762 mm)" },
      { wartosc: "UL", nazwa: "UL — ultralekka (Torqeedo)" },
    ],
  },
  {
    klucz: "sterowanie",
    nazwa: "Sterowanie",
    opcje: [
      { wartosc: "rumpel", nazwa: "Rumpel" },
      { wartosc: "manetka", nazwa: "Manetka" },
    ],
  },
]

export const KLUCZE_PARAMETROW = PARAMETRY.map((p) => p.klucz)

/** Wartość parametru z metadanych — pusty string, gdy sprzedawca nic nie wpisał. */
function zMetadanych(metadata: Record<string, unknown> | undefined, klucz: string): string {
  const wartosc = metadata?.[klucz]
  if (wartosc === null || wartosc === undefined) return ""
  return String(wartosc).trim()
}

/** Moc silnika z nazwy: „Suzuki DF 6 AS" → 6, „Mercury 20 KM …" → 20. */
export function mocZNazwy(title: string): number | null {
  const mercury = title.match(/Mercury\s+([\d.]+)\s*KM/i)
  if (mercury) return Number(mercury[1])

  const suzuki = title.match(/Suzuki\s+DF\s?([\d.]+)/i)
  if (suzuki) return Number(suzuki[1])

  const generic = title.match(/\b([\d.]+)\s*KM\b/i)
  return generic ? Number(generic[1]) : null
}

/** Moc silnika: najpierw parametr z panelu, potem odczyt z nazwy. */
export function enginePower(product: ShopProduct | string): number | null {
  if (typeof product === "string") return mocZNazwy(product)

  const wpisana = Number(String(zMetadanych(product.metadata, "moc")).replace(",", "."))
  if (Number.isFinite(wpisana) && wpisana > 0) return wpisana

  return mocZNazwy(product.title)
}

/** Spalinowy czy elektryczny: parametr z panelu, potem kategoria, potem nazwa. */
export function engineFuel(product: ShopProduct): string | null {
  const wpisane = zMetadanych(product.metadata, "paliwo")
  if (wpisane === "spalinowy" || wpisane === "elektryczny") return wpisane

  const handles = product.categories.map((category) => category.handle)
  if (handles.includes("elektryczne") || handles.includes("silniki-elektryczne-torqeedo")) {
    return "elektryczny"
  }
  if (handles.includes("spalinowe")) return "spalinowy"
  if (/torqeedo|elektryczny/i.test(product.title)) return "elektryczny"
  return null
}

/**
 * Kolumna i sterowanie. Parametr z panelu wygrywa; bez niego czytamy oznaczenie
 * z nazwy, a przy sterowaniu — jeszcze opis wersji („EL**H**PT" → rumpel).
 */
export function cechyProduktu(product: ShopProduct): {
  kolumna: string | null
  sterowanie: string | null
} {
  const kolumnaWpisana = zMetadanych(product.metadata, "kolumna").toUpperCase()
  const sterowanieWpisane = zMetadanych(product.metadata, "sterowanie").toLowerCase()

  const parsed = parseProduct(product.title)
  const kolumnaZNazwy = parsed?.traits.find((trait) => trait.key === "kolumna")?.value || null

  const wersja =
    parsed?.traits.find((trait) => trait.key === "wersja")?.display?.toLowerCase() || ""
  const sterowanieZNazwy =
    parsed?.traits.find((trait) => trait.key === "sterowanie")?.value ||
    (wersja.includes("rumpel") ? "rumpel" : wersja.includes("manetka") ? "manetka" : null)

  return {
    kolumna: kolumnaWpisana || kolumnaZNazwy,
    sterowanie: sterowanieWpisane || sterowanieZNazwy,
  }
}

/** Parametry produktu do formularza w panelu — same wpisane wartości. */
export function parametryZMetadanych(
  metadata: Record<string, unknown> | undefined
): Record<string, string> {
  const wynik: Record<string, string> = {}
  for (const klucz of KLUCZE_PARAMETROW) wynik[klucz] = zMetadanych(metadata, klucz)
  return wynik
}

/**
 * Parametry z formularza do zapisu w metadanych.
 *
 * Pusta wartość idzie jako pusty string, **nie jest pomijana**: metadane
 * w Medusie się scalają i klucza nie da się skasować (`{"klucz": null}`
 * zostawia klucz z wartością `null`), więc wyczyszczenie pola musi zapisać
 * coś, co czytamy jako „brak". Pusty string tak właśnie czytamy.
 */
export function parametryDoZapisu(dane: Record<string, unknown>): Record<string, string> {
  const wynik: Record<string, string> = {}

  for (const parametr of PARAMETRY) {
    const surowa = dane?.[parametr.klucz]
    if (surowa === undefined) continue

    let wartosc = String(surowa).trim()

    if (parametr.opcje) {
      // Trzymamy się listy — wartość spoza niej nie trafi w żaden filtr,
      // a wyglądałaby w panelu na zapisaną.
      const dozwolone = parametr.opcje.map((o) => o.wartosc)
      const dopasowana = dozwolone.find((o) => o.toLowerCase() === wartosc.toLowerCase())
      wartosc = dopasowana || ""
    } else {
      const liczba = Number(wartosc.replace(",", "."))
      wartosc = Number.isFinite(liczba) && liczba > 0 ? String(liczba) : ""
    }

    wynik[parametr.klucz] = wartosc
  }

  return wynik
}
