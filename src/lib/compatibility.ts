import type { ShopProduct } from "@/lib/medusa"

// „Pasuje do" — dopasowanie produktów wyliczane z naszego katalogu.
//
// Reguły biorą się z tego, co realnie stoi w nazwach produktów:
//   • akcesoria Suzuki i Mercury niosą zakres mocy („5-140KM", „DF9.9-20",
//     „DF50AV/60AV") — pasują do silników mieszczących się w zakresie,
//   • baterie Torqeedo mają w nazwie rodzinę (Travel, Ultralight, Cruise),
//   • mapy obsługuje osobny moduł `map-compatibility`.
//
// Czego tu NIE ma: matrycy złączy przetworników Garmina (4/8/12 pin) ani
// listy radarów per seria. Tych danych nie ma w naszych nazwach, a garmin.com
// nie wystawia ich w formie do odczytu — do czasu, aż dostaniemy matrycę od
// dystrybutora, takie powiązania ustawia się ręcznie w Medusie:
// metadane produktu `pasuje_do` = uchwyty po przecinku.

export type CompatibilityGroup = {
  label: string
  reason: string
  items: ShopProduct[]
}

type Range = { min: number; max: number }

/** Moc silnika z nazwy: „Suzuki DF 20 ATL", „DF300APX", „Mercury F 15". */
export function parseEnginePower(title: string): number | null {
  const patterns = [
    /\bDF\s?(\d+(?:[.,]\d)?)\s?[A-Z]/i,
    /\bDF\s?(\d+(?:[.,]\d)?)\b/i,
    /\bF\s?(\d+(?:[.,]\d)?)\s?[A-Z]{2,}/,
    /\b(\d+(?:[.,]\d)?)\s?KM\b/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      const value = Number(match[1].replace(",", "."))
      if (Number.isFinite(value) && value > 1 && value <= 400) return value
    }
  }

  return null
}

/** Zakres mocy z nazwy akcesorium: „5-140KM", „DF9.9-20", „DF50AV/60AV". */
export function parsePowerRange(title: string): Range | null {
  const both = [
    /\bDF\s?(\d+(?:[.,]\d)?)\s?-\s?(\d+(?:[.,]\d)?)\b/i,
    /\bDF(\d+(?:[.,]\d)?)[A-Z]*\s?\/\s?(\d+(?:[.,]\d)?)[A-Z]*/i,
    /\b(\d+(?:[.,]\d)?)\s?-\s?(\d+(?:[.,]\d)?)\s?KM\b/i,
    /\b(\d+(?:[.,]\d)?)\s?-\s?(\d+(?:[.,]\d)?)\b(?=\s|$)/,
  ]

  for (const pattern of both) {
    const match = title.match(pattern)
    if (!match) continue

    const min = Number(match[1].replace(",", "."))
    const max = Number(match[2].replace(",", "."))

    if (Number.isFinite(min) && Number.isFinite(max) && min < max && max <= 400) {
      return { min, max }
    }
  }

  return null
}

/** Rodzina Torqeedo — bateria musi trafić w tę samą co silnik. */
function torqeedoFamily(title: string): string | null {
  const match = title.match(/\b(travel|ultralight|cruise)\b/i)
  return match ? match[1].toLowerCase() : null
}

function brandOf(title: string): string | null {
  const brands = ["suzuki", "mercury", "torqeedo", "garmin", "quicksilver", "lowrance"]
  const lower = title.toLowerCase()
  return brands.find((brand) => lower.includes(brand)) || null
}

const ACCESSORY_WORDS =
  /(śrub|filtr|olej|zestaw|anod|uszczel|świec|pompy|wkład|cięgn|zbiornik|linia|akumulator|bateria|pokrowiec|przetwornik|radar|mapa)/i

function isAccessory(product: ShopProduct): boolean {
  return ACCESSORY_WORDS.test(product.title)
}

function isEngine(product: ShopProduct): boolean {
  if (isAccessory(product)) return false
  return /silnik|\bDF\s?\d|\bF\s?\d{2,}/i.test(product.title)
}

/** Ręczne powiązania z panelu Medusy (metadane `pasuje_do`). */
function manualHandles(product: ShopProduct): string[] {
  const raw = product.metadata?.pasuje_do
  if (typeof raw !== "string") return []

  return raw
    .split(",")
    .map((handle) => handle.trim())
    .filter(Boolean)
}

/**
 * Zwraca grupy dopasowań dla produktu. `candidates` to pula, w której szukamy —
 * zwykle cały katalog.
 */
export function findCompatible(
  product: ShopProduct,
  candidates: ShopProduct[]
): CompatibilityGroup[] {
  const others = candidates.filter((item) => item.id !== product.id && item.thumbnail)
  const groups: CompatibilityGroup[] = []
  const used = new Set<string>()

  const push = (label: string, reason: string, items: ShopProduct[]) => {
    const fresh = items.filter((item) => !used.has(item.id)).slice(0, 8)
    if (fresh.length < 2) return

    fresh.forEach((item) => used.add(item.id))
    groups.push({ label, reason, items: fresh })
  }

  // 1) Ręczne powiązania mają pierwszeństwo — sprzedawca wie najlepiej.
  const manual = manualHandles(product)
  if (manual.length) {
    push(
      "Dobrane do tego produktu",
      "Powiązania ustawione w panelu sklepu.",
      others.filter((item) => manual.includes(item.handle))
    )
  }

  const brand = brandOf(product.title)

  // 2) Silnik → akcesoria obejmujące jego moc.
  const power = isEngine(product) ? parseEnginePower(product.title) : null
  if (power && brand) {
    const fitting = others.filter((item) => {
      if (brandOf(item.title) !== brand) return false
      if (!isAccessory(item)) return false

      const range = parsePowerRange(item.title)
      return Boolean(range && power >= range.min && power <= range.max)
    })

    push(
      "Pasuje do tego silnika",
      `Akcesoria z zakresem mocy obejmującym ${String(power).replace(".", ",")} KM.`,
      fitting
    )
  }

  // 3) Akcesorium → silniki mieszczące się w jego zakresie.
  const range = isAccessory(product) ? parsePowerRange(product.title) : null
  if (range && brand) {
    const engines = others.filter((item) => {
      if (brandOf(item.title) !== brand) return false
      if (!isEngine(item)) return false

      const enginePower = parseEnginePower(item.title)
      return Boolean(enginePower && enginePower >= range.min && enginePower <= range.max)
    })

    push(
      "Pasuje do silników",
      `Zakres z nazwy: ${String(range.min).replace(".", ",")}–${String(range.max).replace(
        ".",
        ","
      )} KM.`,
      engines
    )
  }

  // 4) Torqeedo — bateria i silnik z tej samej rodziny.
  const family = torqeedoFamily(product.title)
  if (family && brandOf(product.title) === "torqeedo") {
    const wantsBattery = /silnik/i.test(product.title)

    const matches = others.filter((item) => {
      if (brandOf(item.title) !== "torqeedo") return false
      if (torqeedoFamily(item.title) !== family) return false

      const isBattery = /akumulator|bateria/i.test(item.title)
      return wantsBattery ? isBattery : /silnik/i.test(item.title)
    })

    push(
      wantsBattery ? "Baterie do tego silnika" : "Silniki do tej baterii",
      `Ta sama rodzina Torqeedo: ${family[0].toUpperCase()}${family.slice(1)}.`,
      matches
    )
  }

  return groups
}
