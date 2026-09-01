// Wspólny widok cen: sklep i Allegro obok siebie, sparowane po SKU.
//
// To jedyne miejsce, które łączy oba źródła. Panel, eksport arkusza i import
// czytają stąd, żeby kolumna „Cena Allegro" znaczyła wszędzie to samo.

import { listOffers, readAllegroConfig, type AllegroOffer } from "@/lib/allegro"
import { medusaAdmin } from "@/lib/medusa-admin"

export type WierszCeny = {
  /** Klucz pary: sygnatura sprzedawcy w Allegro to nasze SKU wariantu. */
  sku: string
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
  "id,title,handle,status,categories.name,variants.id,variants.title,variants.sku,*variants.prices"

function cenaPln(wariant: any): number | null {
  const ceny = Array.isArray(wariant?.prices) ? wariant.prices : []
  const pln = ceny.find((c: any) => String(c.currency_code).toLowerCase() === "pln")
  return pln ? Number(pln.amount) : null
}

/**
 * Wszystkie produkty ze sklepu z dopiętą ofertą Allegro.
 *
 * Allegro może nie odpowiedzieć — wtedy kolumny Allegro zostają puste,
 * a tabela cen sklepu i tak działa. Odwrotnie się nie da: bez Medusy nie ma
 * czego pokazywać.
 */
export async function wierszeCen(): Promise<{ wiersze: WierszCeny[]; allegroDziala: boolean }> {
  const produkty: any[] = []

  for (let offset = 0; ; offset += 100) {
    const dane = await medusaAdmin(
      `/admin/products?limit=100&offset=${offset}&order=title&fields=${POLA}`
    )
    const partia = dane?.products || []
    produkty.push(...partia)
    if (partia.length < 100) break
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

  const poSku = new Map<string, AllegroOffer>()
  for (const oferta of oferty) {
    if (oferta.signature) poSku.set(oferta.signature.trim(), oferta)
  }

  const wiersze: WierszCeny[] = []

  for (const produkt of produkty) {
    for (const wariant of produkt.variants || []) {
      const sku = String(wariant.sku || "").trim()
      const oferta = sku ? poSku.get(sku) : undefined

      wiersze.push({
        sku,
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

  return { wiersze, allegroDziala }
}

export const NAGLOWKI_ARKUSZA = [
  "SKU",
  "Nazwa",
  "Kategoria",
  "Stan",
  "Cena sklep",
  "Cena Allegro",
  "Oferta Allegro",
]

/** Szerokości kolumn dobrane do treści — SKU i nazwy są długie. */
export const SZEROKOSCI_ARKUSZA = [20, 52, 22, 12, 13, 14, 16]

export function wierszDoArkusza(w: WierszCeny) {
  return [
    w.sku,
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
