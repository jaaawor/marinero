// Skąd bierze się wyposażenie standardowe na stronie modelu.
//
// Do tej pory żyło wyłącznie w repozytorium (`standard-equipment-data.ts`
// i `generated-equipment.ts`), więc klient nie miał jak go poprawić — a to
// są setki pozycji przepisanych ze stron producentów, w których zawsze
// znajdzie się literówka albo nieaktualny zapis.
//
// Teraz pierwszeństwo ma Directus (kolekcje `equipment_groups` i
// `equipment_items`, edytowalne z poziomu modelu), a repozytorium zostaje
// jako **zapas** — dokładnie tak, jak przy konfiguratorach. Gdy Directus nie
// odpowie, wyposażenie nie znika ze strony.

import {
  getStandardEquipment as getFromRepo,
  type StandardEquipmentGroup,
} from "@/lib/standard-equipment-data"

const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_DIRECTUS_URL ||
  "https://dms.marinero.150197.pl"

export async function getStandardEquipmentFor(slug: string): Promise<StandardEquipmentGroup[]> {
  const fallback = getFromRepo(slug)

  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/equipment_groups?limit=100` +
        `&filter[boat_model][slug][_eq]=${encodeURIComponent(slug)}` +
        "&fields=title,sort,items.text,items.sort&sort=sort",
      { next: { revalidate: 300 } }
    )

    if (!response.ok) return fallback

    const body = await response.json()
    const groups: StandardEquipmentGroup[] = (body?.data || [])
      .map((group: any) => ({
        title: String(group?.title || ""),
        items: (group?.items || [])
          .slice()
          .sort((a: any, b: any) => (Number(a?.sort) || 0) - (Number(b?.sort) || 0))
          .map((item: any) => String(item?.text || ""))
          .filter(Boolean),
      }))
      .filter((group: StandardEquipmentGroup) => group.title && group.items.length)

    return groups.length ? groups : fallback
  } catch {
    return fallback
  }
}
