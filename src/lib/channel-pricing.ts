// Ceny na Allegro i OLX liczymy z ceny sklepu według reguł z tego pliku.
// Jedno miejsce do edycji: zmiana narzutu na Allegro to zmiana jednej liczby.
//
// Reguła: `percent` dolicza procent (prowizja portalu), `amount` dolicza kwotę,
// `round` zaokrągla wynik (np. do pełnych złotych albo do 0,99).
// Reguły kategorii mają pierwszeństwo przed regułą domyślną kanału.

export type PriceRule = {
  percent?: number
  amount?: number
  /** „pelne" → 199,00 · „0.99" → 198,99 · brak → bez zaokrąglania */
  round?: "pelne" | "0.99"
}

export type SalesChannel = {
  id: "allegro" | "olx"
  label: string
  /** Reguła stosowana, gdy nic nie pasuje po kategorii. */
  default: PriceRule
  /** Reguły per uchwyt kategorii Medusy. */
  categories?: Record<string, PriceRule>
  /** Marki wyłączone ze sprzedaży na tym kanale (np. zakaz producenta). */
  excludeBrands?: string[]
}

export const SALES_CHANNELS: SalesChannel[] = [
  {
    id: "allegro",
    label: "Allegro",
    // Prowizja Allegro zjada kilka procent — domyślnie doliczamy 9%.
    default: { percent: 9, round: "pelne" },
    categories: {
      // Silniki to duże kwoty, prowizja jest ograniczona kwotowo
      silniki: { percent: 3, round: "pelne" },
      spalinowe: { percent: 3, round: "pelne" },
      elektryczne: { percent: 3, round: "pelne" },
      "czesci-serwisowe": { percent: 12, round: "0.99" },
    },
  },
  {
    id: "olx",
    label: "OLX",
    default: { percent: 5, round: "pelne" },
  },
]

function applyRule(price: number, rule: PriceRule): number {
  let value = price
  if (rule.percent) value *= 1 + rule.percent / 100
  if (rule.amount) value += rule.amount

  if (rule.round === "pelne") return Math.round(value)
  if (rule.round === "0.99") return Math.floor(value) + 0.99
  return Math.round(value * 100) / 100
}

/** Cena produktu na danym kanale, policzona z ceny sklepu. */
export function channelPrice(
  shopPrice: number | null,
  channel: SalesChannel,
  categoryHandles: string[] = []
): number | null {
  if (typeof shopPrice !== "number") return null

  const categoryRule = categoryHandles
    .map((handle) => channel.categories?.[handle])
    .find(Boolean)

  return applyRule(shopPrice, categoryRule || channel.default)
}

export function isChannelEligible(title: string, channel: SalesChannel): boolean {
  if (!channel.excludeBrands?.length) return true
  const lowered = title.toLowerCase()
  return !channel.excludeBrands.some((brand) => lowered.includes(brand.toLowerCase()))
}

export function getChannel(id: string): SalesChannel | undefined {
  return SALES_CHANNELS.find((channel) => channel.id === id)
}
