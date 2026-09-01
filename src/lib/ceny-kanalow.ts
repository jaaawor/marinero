// Wspólny widok cen: sklep i Allegro obok siebie, sparowane po SKU.
//
// To jedyne miejsce, które łączy oba źródła. Panel, eksport arkusza i import
// czytają stąd, żeby kolumna „Cena Allegro" znaczyła wszędzie to samo.

import { listOffers, readAllegroConfig, type AllegroOffer } from "@/lib/allegro"
import { medusaAdmin } from "@/lib/medusa-admin"

export type WierszCeny = {
  /** Pierwszy klucz pary: sygnatura sprzedawcy w Allegro to zwykle nasze SKU. */
  sku: string
  /** Drugi klucz pary — część ofert ma w sygnaturze EAN, nie SKU. */
  ean: string
  /** Po czym udało się sparować: `sku`, `ean` albo pusto. */
  poCzym: "sku" | "ean" | ""
  produktId: string
  wariantId: string
  tytul: string
  handle: string
  status: string
  kategoria: string
  cenaSklep: number | null
  /** Pusto, gdy produkt nie ma odpowiednika na Allegro. */
  ofertaId: string
  nazwaAllegro: string
  cenaAllegro: number | null
  stanAllegro: number | null
}

const POLA =
  "id,title,handle,status,+metadata,categories.name," +
  "variants.id,variants.title,variants.sku,*variants.prices"

function cenaPln(wariant: any): number | null {
  const ceny = Array.isArray(wariant?.prices) ? wariant.prices : []
  const pln = ceny.find((c: any) => String(c.currency_code).toLowerCase() === "pln")
  return pln ? Number(pln.amount) : null
}

// Jedno zestawienie to cztery strony produktów z Medusy i trzy strony ofert
// z Allegro — siedem żądań po sieci, każde po sekundę czy dwie. Bez pamięci
// podręcznej każde wejście na stronę i każde odświeżenie po zapisie kazało
// czekać kilkanaście sekund, a przy Node z jednym wątkiem blokowało też resztę
// panelu. Minuta w zupełności wystarcza: ceny nie zmieniają się co sekundę,
// a zapis i tak odświeża zestawienie u siebie.
const WAZNOSC_MS = 60_000
let zapamietane: { kiedy: number; dane: { wiersze: WierszCeny[]; allegroDziala: boolean } } | null =
  null

/**
 * Wszystkie produkty ze sklepu z dopiętą ofertą Allegro.
 *
 * Allegro może nie odpowiedzieć — wtedy kolumny Allegro zostają puste,
 * a tabela cen sklepu i tak działa. Odwrotnie się nie da: bez Medusy nie ma
 * czego pokazywać.
 */
export async function wierszeCen(
  opcje: { odswiez?: boolean } = {}
): Promise<{ wiersze: WierszCeny[]; allegroDziala: boolean }> {
  if (!opcje.odswiez && zapamietane && Date.now() - zapamietane.kiedy < WAZNOSC_MS) {
    return zapamietane.dane
  }

  // Pierwsza strona mówi, ile jest wszystkiego — resztę pobieramy **równolegle**,
  // zamiast czekać na każdą po kolei.
  const pierwsza = await medusaAdmin(`/admin/products?limit=100&offset=0&order=title&fields=${POLA}`)
  const produkty: any[] = [...(pierwsza?.products || [])]
  const ile = Number(pierwsza?.count) || produkty.length

  const dalsze: Promise<any>[] = []
  for (let offset = 100; offset < ile; offset += 100) {
    dalsze.push(
      medusaAdmin(`/admin/products?limit=100&offset=${offset}&order=title&fields=${POLA}`)
    )
  }

  for (const strona of await Promise.all(dalsze)) {
    produkty.push(...(strona?.products || []))
  }

  let oferty: AllegroOffer[] = []
  let allegroDziala = false

  const config = readAllegroConfig()
  if (config) {
    try {
      oferty = await listOffers(config)
      allegroDziala = true
    } catch {
      // Cisza jest tu celowa: brak Allegro to mniej kolumn, nie awaria.
    }
  }

  // Jedna mapa na sygnatury — pary szukamy najpierw po SKU, potem po EAN-ie.
  // Sam SKU nie wystarcza: część ofert została wystawiona z EAN-em w polu
  // sygnatury i wypadała z zestawienia jako „nie ma na Allegro", choć jest.
  const poSygnaturze = new Map<string, AllegroOffer>()
  for (const oferta of oferty) {
    const klucz = (oferta.signature || "").trim()
    if (klucz) poSygnaturze.set(klucz, oferta)
  }

  const wiersze: WierszCeny[] = []

  for (const produkt of produkty) {
    for (const wariant of produkt.variants || []) {
      const sku = String(wariant.sku || "").trim()
      const ean = String((produkt.metadata || {}).ean || "").trim()

      const poSku = sku ? poSygnaturze.get(sku) : undefined
      const poEan = !poSku && ean ? poSygnaturze.get(ean) : undefined
      const oferta = poSku || poEan

      wiersze.push({
        sku,
        ean,
        poCzym: poSku ? "sku" : poEan ? "ean" : "",
        produktId: produkt.id,
        wariantId: wariant.id,
        tytul: produkt.title || "",
        handle: produkt.handle || "",
        status: produkt.status || "",
        kategoria: produkt.categories?.[0]?.name || "",
        cenaSklep: cenaPln(wariant),
        ofertaId: oferta?.id || "",
        nazwaAllegro: oferta?.name || "",
        cenaAllegro: oferta ? oferta.price : null,
        stanAllegro: oferta ? oferta.stock : null,
      })
    }
  }

  zapamietane = { kiedy: Date.now(), dane: { wiersze, allegroDziala } }
  return zapamietane.dane
}

/** Po zapisie ceny zestawienie jest nieaktualne — kasujemy je, zamiast czekać. */
export function zapomnijCeny() {
  zapamietane = null
}

export const NAGLOWKI_ARKUSZA = [
  "SKU",
  "EAN",
  "Nazwa",
  "Kategoria",
  "Stan",
  "Cena sklep",
  "Cena Allegro",
  "Oferta Allegro",
]

/** Szerokości kolumn dobrane do treści — SKU i nazwy są długie. */
export const SZEROKOSCI_ARKUSZA = [20, 16, 52, 22, 12, 13, 14, 16]

export function wierszDoArkusza(w: WierszCeny) {
  return [
    w.sku,
    // EAN jako tekst — zera wiodące i trzynaście cyfr, Excel zrobiłby z tego
    // liczbę i uciął pierwszą cyfrę.
    w.ean,
    w.tytul,
    w.kategoria,
    w.status === "published" ? "opublikowany" : "szkic",
    w.cenaSklep,
    w.cenaAllegro,
    // Identyfikator oferty zapisujemy jako **tekst** (`inlineStr`), nie liczbę:
    // Excel zrobiłby z dwunastocyfrowego numeru notację wykładniczą i po
    // powrocie nie dałoby się go z niczym dopasować.
    w.ofertaId,
  ]
}
