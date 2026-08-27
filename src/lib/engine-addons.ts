import type { ShopProduct } from "@/lib/medusa"
import { parseEnginePower, parsePowerRange } from "@/lib/compatibility"

/**
 * „Dokup do silnika" — śruba napędowa i zestaw instalacyjny przy zakupie
 * silnika zaburtowego.
 *
 * Tak działał stary sklep: na stronie silnika stały dwa pola dodatkowe —
 * „Zestaw instalacyjny elektryczny" (manetka topowa / boczna / instalacja
 * dwusilnikowa) i „Śruba napędowa (opcjonalne)". U nas produkty są osobnymi
 * wpisami w Medusie, nie polami przy jednym produkcie, więc zamiast dopłaty
 * doklejanej do ceny silnika pokazujemy je jako **osobne pozycje do koszyka**.
 * Wychodzi na to samo w zamówieniu, a klient widzi, co dokładnie kupuje.
 *
 * Dopasowanie idzie po **zakresie mocy z nazwy** („150-300KM", „DF9.9-20"),
 * tak samo jak w `compatibility.ts`. Nazwy produktów są jedynym miejscem,
 * gdzie ta informacja u nas jest.
 */

export type AddonGroup = {
  /** Klucz do tłumaczenia nagłówka wiersza. */
  key: "propeller" | "installation"
  items: ShopProduct[]
}

const SRUBA = /śrub/i

// Zestaw instalacyjny to u producenta manetka razem z wiązką i stacyjką.
// W katalogu stoją pod różnymi nazwami — „Manetka boczna…", „Zestaw
// Evinrude Manetka+wiązka+stacyjka" — więc łapiemy po obu słowach.
const INSTALACJA = /(manetk|zestaw instalacyjn|instalacja (dwu|jedno)silnikow|wiązk)/i

function isEngineProduct(product: ShopProduct): boolean {
  if (SRUBA.test(product.title) || INSTALACJA.test(product.title)) return false
  return /silnik|\bDF\s?\d|\bF\s?\d{2,}/i.test(product.title)
}

function brandOf(title: string): string | null {
  const brands = ["suzuki", "mercury", "torqeedo", "quicksilver", "honda", "yamaha", "evinrude"]
  const lower = title.toLowerCase()
  return brands.find((brand) => lower.includes(brand)) || null
}

/** Ręczne powiązania z panelu Medusy (metadane `pasuje_do` = uchwyty po przecinku). */
function manualHandles(product: ShopProduct): string[] {
  const raw = product.metadata?.pasuje_do
  if (typeof raw !== "string") return []
  return raw.split(",").map((handle) => handle.trim()).filter(Boolean)
}

/**
 * Czy ta pozycja pasuje do silnika o tej mocy.
 *
 * **Sam brak zakresu w nazwie nie wystarczy, żeby pokazać pozycję.** Manetki
 * Suzuki nie mają w nazwie mocy, a różnią się zasadniczo: elektroniczna KLS
 * idzie do silników drive-by-wire, mechaniczna do mniejszych. Pokazywanie
 * wszystkich przy każdym silniku dawałoby to samo, co dziurawe miniaturki
 * przy wariantach silnikowych — więcej mylenia niż pożytku.
 *
 * Dlatego liczy się albo zakres mocy z nazwy (tak działają śruby), albo
 * ręczne powiązanie `pasuje_do` ustawione w panelu przez sprzedawcę.
 */
function pasuje(item: ShopProduct, silnik: ShopProduct, power: number): boolean {
  if (manualHandles(item).includes(silnik.handle)) return true
  const range = parsePowerRange(item.title)
  return Boolean(range && power >= range.min && power <= range.max)
}

export function findEngineAddons(
  product: ShopProduct,
  candidates: ShopProduct[]
): AddonGroup[] {
  if (!isEngineProduct(product)) return []

  const power = parseEnginePower(product.title)
  const brand = brandOf(product.title)
  if (!power || !brand) return []

  const sameBrand = candidates.filter(
    (item) => item.id !== product.id && brandOf(item.title) === brand
  )

  const groups: AddonGroup[] = []

  const sruby = sameBrand
    .filter((item) => SRUBA.test(item.title) && pasuje(item, product, power))
    .slice(0, 8)
  if (sruby.length) groups.push({ key: "propeller", items: sruby })

  const zestawy = sameBrand
    .filter((item) => INSTALACJA.test(item.title) && pasuje(item, product, power))
    .slice(0, 8)
  if (zestawy.length) groups.push({ key: "installation", items: zestawy })

  return groups
}

/** Uchwyty pozycji pokazanych w „Dokup do silnika" — żeby nie wyszły drugi raz. */
export function addonHandles(groups: AddonGroup[]): Set<string> {
  const handles = new Set<string>()
  for (const group of groups) {
    for (const item of group.items) handles.add(item.handle)
  }
  return handles
}
