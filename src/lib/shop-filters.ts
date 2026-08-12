// Filtry katalogu: marka, dostępność i przedział cen. Wszystko liczymy
// po stronie serwera na pobranej liście produktów — Medusa nie filtruje
// po nazwie marki ani po metadanych, a przy 387 produktach nie ma czego
// optymalizować.

import type { ShopProduct } from "@/lib/medusa"
import { getAvailability } from "@/lib/availability"
import { parseProduct } from "@/lib/product-family"

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

// Filtry techniczne dla silników — wartości bierzemy z nazw modeli
// (ten sam parser, który buduje wybór wersji na stronie produktu).
export const POWER_RANGES = [
  { value: "do-10", label: "do 10 KM", min: 0, max: 10 },
  { value: "10-30", label: "10–30 KM", min: 10, max: 30 },
  { value: "30-100", label: "30–100 KM", min: 30, max: 100 },
  { value: "100-200", label: "100–200 KM", min: 100, max: 200 },
  { value: "200-plus", label: "powyżej 200 KM", min: 200, max: 10000 },
]

export type ShopFilterState = {
  brands: string[]
  availability: AvailabilityFilter[]
  /** spalinowy | elektryczny */
  fuel: string[]
  power: string[]
  /** S | L | X | XX */
  shaft: string[]
  /** rumpel | manetka */
  control: string[]
  priceFrom: number | null
  priceTo: number | null
  sort: string
}

const FUEL_LABELS: Record<string, string> = {
  spalinowy: "Spalinowy",
  elektryczny: "Elektryczny",
}

const CONTROL_LABELS: Record<string, string> = {
  rumpel: "Rumpel",
  manetka: "Manetka",
}

const SHAFT_LABELS: Record<string, string> = {
  S: "Krótka (S, 15″)",
  L: "Długa (L, 20″)",
  X: "Bardzo długa (X, 25″)",
  XX: "Ekstra długa (XX, 30″)",
}

/** Moc silnika z nazwy: „Suzuki DF 6 AS" → 6, „Mercury 20 KM …" → 20. */
export function enginePower(title: string): number | null {
  const mercury = title.match(/Mercury\s+([\d.]+)\s*KM/i)
  if (mercury) return Number(mercury[1])

  const suzuki = title.match(/Suzuki\s+DF\s?([\d.]+)/i)
  if (suzuki) return Number(suzuki[1])

  const generic = title.match(/\b([\d.]+)\s*KM\b/i)
  return generic ? Number(generic[1]) : null
}

export function engineFuel(product: ShopProduct): string | null {
  const handles = product.categories.map((category) => category.handle)
  if (handles.includes("elektryczne") || handles.includes("silniki-elektryczne-torqeedo")) {
    return "elektryczny"
  }
  if (handles.includes("spalinowe")) return "spalinowy"
  if (/torqeedo|elektryczny/i.test(product.title)) return "elektryczny"
  return null
}

function productTraits(product: ShopProduct) {
  const parsed = parseProduct(product.title)
  const shaft = parsed?.traits.find((trait) => trait.key === "kolumna")?.value || null

  const versionDisplay =
    parsed?.traits.find((trait) => trait.key === "wersja")?.display?.toLowerCase() || ""
  const steering = parsed?.traits.find((trait) => trait.key === "sterowanie")?.value || null

  const control = steering
    ? steering
    : versionDisplay.includes("rumpel")
      ? "rumpel"
      : versionDisplay.includes("manetka")
        ? "manetka"
        : null

  return { shaft, control }
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
    fuel: list(search.paliwo),
    power: list(search.moc),
    shaft: list(search.kolumna),
    control: list(search.sterowanie),
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

    if (filters.fuel.length && !filters.fuel.includes(engineFuel(product) || "")) return false

    if (filters.power.length) {
      const power = enginePower(product.title)
      const fits = filters.power.some((value) => {
        const range = POWER_RANGES.find((item) => item.value === value)
        return range && power !== null && power > range.min - 0.001 && power <= range.max
      })
      if (!fits) return false
    }

    const traits = productTraits(product)
    if (filters.shaft.length && !filters.shaft.includes(traits.shaft || "")) return false
    if (filters.control.length && !filters.control.includes(traits.control || "")) return false

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

export type FacetOption = { value: string; label: string; count: number }

/** Liczniki filtrów technicznych — pokazujemy tylko te, które mają trafienia. */
export function technicalFacets(products: ShopProduct[]): {
  fuel: FacetOption[]
  power: FacetOption[]
  shaft: FacetOption[]
  control: FacetOption[]
} {
  const count = (predicate: (product: ShopProduct) => boolean) =>
    products.filter(predicate).length

  const fuel = Object.entries(FUEL_LABELS)
    .map(([value, label]) => ({ value, label, count: count((p) => engineFuel(p) === value) }))
    .filter((item) => item.count > 0)

  const power = POWER_RANGES.map((range) => ({
    value: range.value,
    label: range.label,
    count: count((product) => {
      const value = enginePower(product.title)
      return value !== null && value > range.min - 0.001 && value <= range.max
    }),
  })).filter((item) => item.count > 0)

  const shaft = Object.entries(SHAFT_LABELS)
    .map(([value, label]) => ({
      value,
      label,
      count: count((product) => productTraits(product).shaft === value),
    }))
    .filter((item) => item.count > 0)

  const control = Object.entries(CONTROL_LABELS)
    .map(([value, label]) => ({
      value,
      label,
      count: count((product) => productTraits(product).control === value),
    }))
    .filter((item) => item.count > 0)

  return { fuel, power, shaft, control }
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
