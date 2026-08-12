// Filtry katalogu: marka, dostępność i przedział cen. Wszystko liczymy
// po stronie serwera na pobranej liście produktów — Medusa nie filtruje
// po nazwie marki ani po metadanych, a przy 387 produktach nie ma czego
// optymalizować.

import type { ShopProduct } from "@/lib/medusa"
import { getAvailability } from "@/lib/availability"

export const SHOP_BRANDS_FILTER = [
  "Suzuki",
  "Mercury",
  "Garmin",
  "Torqeedo",
  "Quicksilver",
  "Lowrance",
  "Osculati",
  "Dometic",
]

export type AvailabilityFilter = "od-reki" | "do-3-dni" | "na-zamowienie"

export const AVAILABILITY_FILTERS: { value: AvailabilityFilter; label: string }[] = [
  { value: "od-reki", label: "Od ręki (24 h)" },
  { value: "do-3-dni", label: "Do 3 dni roboczych" },
  { value: "na-zamowienie", label: "Na zamówienie" },
]

export type ShopFilterState = {
  brands: string[]
  availability: AvailabilityFilter[]
  priceFrom: number | null
  priceTo: number | null
  sort: string
}

export function parseFilters(search: Record<string, string | undefined>): ShopFilterState {
  const list = (value?: string) =>
    (value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

  const number = (value?: string) => {
    const parsed = Number(String(value || "").replace(",", "."))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return {
    brands: list(search.marki),
    availability: list(search.dostepnosc) as AvailabilityFilter[],
    priceFrom: number(search.cena_od),
    priceTo: number(search.cena_do),
    sort: search.sort || "",
  }
}

function matchesBrand(product: ShopProduct, brands: string[]): boolean {
  if (!brands.length) return true
  const title = product.title.toLowerCase()
  return brands.some((brand) => title.includes(brand.toLowerCase()))
}

function matchesAvailability(product: ShopProduct, wanted: AvailabilityFilter[]): boolean {
  if (!wanted.length) return true
  const code = getAvailability(product.metadata, product.title).code

  return wanted.some((item) => {
    if (item === "od-reki") return code === "od-reki"
    if (item === "do-3-dni") return code === "od-reki" || code === "2-3-dni"
    return code === "na-zamowienie" || code === "niedostepny"
  })
}

export function applyFilters(products: ShopProduct[], filters: ShopFilterState): ShopProduct[] {
  const filtered = products.filter((product) => {
    if (!matchesBrand(product, filters.brands)) return false
    if (!matchesAvailability(product, filters.availability)) return false

    const price = product.price
    if (filters.priceFrom !== null && (price === null || price < filters.priceFrom)) return false
    if (filters.priceTo !== null && (price === null || price > filters.priceTo)) return false

    return true
  })

  if (filters.sort === "cena-rosnaco") {
    return [...filtered].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  }
  if (filters.sort === "cena-malejaco") {
    return [...filtered].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
  }
  return filtered
}

/** Ile produktów zostałoby po zaznaczeniu danej marki — jak w filtrach x-koma. */
export function brandCounts(products: ShopProduct[]): { brand: string; count: number }[] {
  return SHOP_BRANDS_FILTER.map((brand) => ({
    brand,
    count: products.filter((product) =>
      product.title.toLowerCase().includes(brand.toLowerCase())
    ).length,
  })).filter((entry) => entry.count > 0)
}

export function availabilityCounts(
  products: ShopProduct[]
): { value: AvailabilityFilter; label: string; count: number }[] {
  return AVAILABILITY_FILTERS.map((filter) => ({
    ...filter,
    count: products.filter((product) => matchesAvailability(product, [filter.value])).length,
  })).filter((entry) => entry.count > 0)
}

/** Buduje adres z przełączoną jedną wartością filtra (linki działają bez JS). */
export function toggleParam(
  params: Record<string, string | undefined>,
  key: string,
  value: string
): string {
  const current = (params[key] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  const merged: Record<string, string> = {}
  for (const [name, item] of Object.entries(params)) {
    if (item && name !== "strona") merged[name] = item
  }

  if (next.length) merged[key] = next.join(",")
  else delete merged[key]

  const query = new URLSearchParams(merged).toString()
  return query ? `?${query}` : ""
}
