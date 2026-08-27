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
  S: "Krótka (S, 381 mm)",
  L: "Długa (L, 508 mm)",
  X: "Bardzo długa (X, 635 mm)",
  XX: "Ekstra długa (XX, 762 mm)",
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

/** Który filtr pominąć przy liczeniu — patrz `technicalFacets`. */
type FilterKey = "brands" | "availability" | "fuel" | "power" | "shaft" | "control"

function matchesPower(product: ShopProduct, values: string[]): boolean {
  if (!values.length) return true
  const power = enginePower(product.title)
  return values.some((value) => {
    const range = POWER_RANGES.find((item) => item.value === value)
    return range && power !== null && power > range.min - 0.001 && power <= range.max
  })
}

/**
 * Czy produkt przechodzi przez filtry — z możliwością pominięcia jednego.
 *
 * Pominięcie służy licznikom: przy liczeniu, ile zostanie po zaznaczeniu
 * „kolumna XX", nie bierzemy pod uwagę już zaznaczonych kolumn, ale bierzemy
 * wszystkie pozostałe filtry. Bez tego licznik pokazywałby liczby z całego
 * katalogu i „XX" stało z liczbą 8 przy filtrze „do 10 KM", gdzie takich
 * silników nie ma ani jednego.
 */
function matches(
  product: ShopProduct,
  filters: ShopFilterState,
  except?: FilterKey
): boolean {
  if (except !== "brands" && !matchesBrand(product, filters.brands)) return false
  if (except !== "availability" && !matchesAvailability(product, filters.availability)) {
    return false
  }

  if (except !== "fuel" && filters.fuel.length && !filters.fuel.includes(engineFuel(product) || "")) {
    return false
  }

  if (except !== "power" && !matchesPower(product, filters.power)) return false

  const traits = productTraits(product)
  if (except !== "shaft" && filters.shaft.length && !filters.shaft.includes(traits.shaft || "")) {
    return false
  }
  if (
    except !== "control" &&
    filters.control.length &&
    !filters.control.includes(traits.control || "")
  ) {
    return false
  }

  const price = product.price
  if (filters.priceFrom !== null && (price === null || price < filters.priceFrom)) return false
  if (filters.priceTo !== null && (price === null || price > filters.priceTo)) return false

  return true
}

/**
 * Domyślna kolejność na liście silników: **od najmniejszych**.
 *
 * Medusa oddaje produkty w swojej kolejności, przez którą lista silników
 * zaczynała się od DF 350. Najwięcej schodzi małych — pontonowych i pomocniczych
 * — więc to one mają stać na pierwszym ekranie. Sortujemy tylko wtedy, gdy
 * lista jest w większości silnikami: w katalogu wszystkiego naraz przestawianie
 * kolejności po mocy niczego by nie uporządkowało.
 */
function engineOrder(products: ShopProduct[]): ShopProduct[] {
  const withPower = products.filter((product) => enginePower(product.title) !== null)
  if (products.length < 2 || withPower.length < products.length * 0.8) return products

  return [...products].sort((a, b) => {
    const left = enginePower(a.title) ?? Infinity
    const right = enginePower(b.title) ?? Infinity
    if (left !== right) return left - right
    return a.title.localeCompare(b.title, "pl", { numeric: true })
  })
}

export function applyFilters(products: ShopProduct[], filters: ShopFilterState): ShopProduct[] {
  const filtered = products.filter((product) => matches(product, filters))

  if (filters.sort === "cena-rosnaco") {
    return [...filtered].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  }
  if (filters.sort === "cena-malejaco") {
    return [...filtered].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
  }
  return engineOrder(filtered)
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

/**
 * Liczniki filtrów technicznych, liczone **w kontekście pozostałych filtrów**.
 *
 * Przy „do 10 KM" nie ma ani jednego silnika z kolumną XX, więc taka pozycja
 * pokazuje zero i jest wyszarzona — zamiast obiecywać osiem sztuk, których nie
 * ma. Pozycję zostawiamy na liście (a nie chowamy), żeby układ filtrów nie
 * skakał przy każdym kliknięciu; znika dopiero wtedy, gdy w całej liście
 * nie ma jej wcale.
 */
export function technicalFacets(
  products: ShopProduct[],
  filters?: ShopFilterState
): {
  fuel: FacetOption[]
  power: FacetOption[]
  shaft: FacetOption[]
  control: FacetOption[]
} {
  const facet = (
    key: FilterKey,
    entries: { value: string; label: string }[],
    predicate: (product: ShopProduct, value: string) => boolean
  ): FacetOption[] =>
    entries
      .map(({ value, label }) => ({
        value,
        label,
        // Licznik: pozostałe filtry działają, ten jeden pomijamy.
        count: products.filter(
          (product) =>
            predicate(product, value) && (!filters || matches(product, filters, key))
        ).length,
        // Czy pozycja w ogóle ma sens na tej liście (bez żadnych filtrów).
        istnieje: products.some((product) => predicate(product, value)),
      }))
      .filter((item) => item.istnieje)
      .map(({ value, label, count }) => ({ value, label, count }))

  const fuel = facet(
    "fuel",
    Object.entries(FUEL_LABELS).map(([value, label]) => ({ value, label })),
    (product, value) => engineFuel(product) === value
  )

  const power = facet(
    "power",
    POWER_RANGES.map((range) => ({ value: range.value, label: range.label })),
    (product, value) => {
      const range = POWER_RANGES.find((item) => item.value === value)
      const moc = enginePower(product.title)
      return Boolean(range && moc !== null && moc > range.min - 0.001 && moc <= range.max)
    }
  )

  const shaft = facet(
    "shaft",
    Object.entries(SHAFT_LABELS).map(([value, label]) => ({ value, label })),
    (product, value) => productTraits(product).shaft === value
  )

  const control = facet(
    "control",
    Object.entries(CONTROL_LABELS).map(([value, label]) => ({ value, label })),
    (product, value) => productTraits(product).control === value
  )

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
