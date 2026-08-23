// Skąd bierze się konfigurator na stronie modelu.
//
// Do tej pory dane 56 konfiguratorów siedziały wyłącznie w repozytorium, więc
// każda zmiana ceny opcji wymagała wdrożenia. Teraz pierwszeństwo ma Directus
// (klient edytuje w panelu), a repozytorium zostaje jako zapas: gdy Directus
// nie odpowie albo dany model nie został jeszcze przeniesiony, strona
// pokazuje to, co zawsze pokazywała — konfigurator nie znika.

import {
  getConfiguratorData,
  type BoatConfiguratorData,
  type ConfiguratorGroup,
} from "@/lib/configurator-data"

const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_DIRECTUS_URL ||
  "https://dms.marinero.150197.pl"

const FIELDS = [
  "slug",
  "currency",
  "base_price",
  "base_package_name",
  "vat_rate",
  "pln_rate",
  "groups.title",
  "groups.type",
  "groups.sort",
  "groups.options.name",
  "groups.options.price",
  "groups.options.selected",
  "groups.options.sort",
].join(",")

function bySort(a: { sort?: number }, b: { sort?: number }) {
  return (Number(a.sort) || 0) - (Number(b.sort) || 0)
}

function mapConfigurator(item: any): BoatConfiguratorData | null {
  const groups: ConfiguratorGroup[] = (item?.groups || [])
    .slice()
    .sort(bySort)
    .map((group: any, groupIndex: number) => ({
      id: `g${groupIndex + 1}`,
      title: String(group?.title || ""),
      type: group?.type === "radio" ? "radio" : "checkbox",
      options: (group?.options || [])
        .slice()
        .sort(bySort)
        .map((option: any, optionIndex: number) => ({
          id: `g${groupIndex + 1}-${optionIndex + 1}`,
          name: String(option?.name || ""),
          price: Number(option?.price) || 0,
          ...(option?.selected ? { selected: true } : {}),
        }))
        .filter((option: any) => option.name),
    }))
    .filter((group: ConfiguratorGroup) => group.title && group.options.length)

  if (!groups.length) return null

  const currency = item?.currency === "USD" ? "USD" : item?.currency === "PLN" ? "PLN" : "EUR"

  return {
    currency,
    vatRate: Number(item?.vat_rate) || 0.23,
    defaultUsdToPln: Number(item?.pln_rate) || 4.3,
    basePrice: Number(item?.base_price) || 0,
    basePackageName: String(item?.base_package_name || ""),
    groups,
  }
}

/**
 * Konfigurator modelu: najpierw Directus, w razie czego dane z repozytorium.
 * Odświeżanie co 5 minut — tyle czeka klient na efekt zmiany w panelu.
 */
export async function getConfigurator(slug: string): Promise<BoatConfiguratorData | null> {
  const fallback = getConfiguratorData(slug)

  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/configurators?limit=1&fields=${FIELDS}` +
        `&filter[slug][_eq]=${encodeURIComponent(slug)}&filter[status][_eq]=published`,
      { next: { revalidate: 300 } }
    )

    if (!response.ok) return fallback

    const body = await response.json()
    return mapConfigurator(body?.data?.[0]) || fallback
  } catch {
    return fallback
  }
}
