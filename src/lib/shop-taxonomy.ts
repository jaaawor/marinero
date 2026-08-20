// Kategorie w Medusie przyszły z WooCommerce jako płaska lista 56 wpisów —
// bez rodziców, z duplikatami nazw („Mercury" trzy razy) i pustymi gałęziami.
// Poprawianie tego w panelu Medusy byłoby ręczną robotą przy każdym imporcie,
// więc porządek trzymamy tutaj: repo jest źródłem prawdy dla nawigacji sklepu.
//
// `handle` wskazuje kategorię, do której prowadzi link; `children` to podkategorie
// pokazywane w rozwijanym menu. Pozycje bez produktów są odfiltrowywane
// w `buildShopMenu`, więc lista może być z zapasem.

export type TaxonomyItem = {
  label: string
  handle: string
  /** Nagłówek sekcji w menu — pozycje pod nim są wcięte. */
  section?: boolean
}

export type TaxonomyGroup = TaxonomyItem & {
  /** Krótki opis pod nazwą grupy w rozwijanym menu. */
  lead?: string
  /** Krótsza nazwa do paska nagłówka — pełna zostaje w rozwijanym menu. */
  short?: string
  children: TaxonomyItem[]
}

export const SHOP_TAXONOMY: TaxonomyGroup[] = [
  {
    label: "Silniki",
    handle: "silniki",
    lead: "Zaburtowe spalinowe i elektryczne",
    children: [
      { label: "Spalinowe", handle: "spalinowe", section: true },
      { label: "Suzuki", handle: "silniki-suzuki" },
      { label: "Mercury", handle: "silniki-zaburtowe-mercury" },
      { label: "Elektryczne", handle: "elektryczne", section: true },
      { label: "Torqeedo", handle: "silniki-elektryczne-torqeedo" },
      { label: "Mercury Avator", handle: "mercury" },
      { label: "Silniki trolingowe", handle: "silniki-trolingowe" },
    ],
  },
  {
    label: "Elektronika",
    handle: "garmin",
    lead: "Nawigacja, echosondy, audio",
    children: [
      // Lowrance i Fusion to osobne marki — pod nagłówkiem „Garmin" wyglądały
      // jak jego podkategorie. Mapy Navionics zostają przy Garminie, bo
      // Navionics należy do Garmina; jeśli mają stać osobno, wystarczy
      // przenieść je w Medusie do własnej kategorii.
      { label: "Garmin", handle: "garmin", section: true },
      { label: "Echomap", handle: "echomap-garmin" },
      { label: "GPSMAP", handle: "gps-map" },
      { label: "Striker", handle: "striker" },
      { label: "Mapy", handle: "mapy" },
      { label: "Pozostałe marki", handle: "lowrance", section: true },
      { label: "Lowrance", handle: "lowrance" },
      { label: "Fusion", handle: "fusion" },
    ],
  },
  {
    label: "Części",
    handle: "czesci",
    lead: "Osprzęt i części zamienne",
    children: [
      { label: "Części Mercury", handle: "czesci-mercury" },
      { label: "Cięgna", handle: "ciegna" },
      { label: "Śruby napędowe", handle: "sruby-napedowe-zawleczki" },
      { label: "Układ sterowania", handle: "uklad-sterowania" },
      { label: "Zbiornik paliwa", handle: "zbiornik-paliwa" },
      { label: "Linia paliwowa", handle: "linia-paliwowa" },
      { label: "Anody", handle: "anody" },
      { label: "Uszczelki", handle: "uszczelki" },
      { label: "Pozostałe", handle: "pozostale" },
    ],
  },
  {
    label: "Serwis",
    handle: "czesci-serwisowe",
    lead: "Przeglądy i naprawy",
    children: [
      { label: "Maintenance Kit", handle: "maintenance-kit" },
      { label: "Zestawy serwisowe", handle: "zestawy-serwisowe" },
      { label: "Filtry oleju", handle: "filtry-oleju" },
      { label: "Filtry paliwa Suzuki", handle: "filtry-paliwa" },
      { label: "Filtr paliwa Mercury", handle: "filtr-paliwa-mercury" },
      { label: "Świece zapłonowe", handle: "swiece-zaplonowe-suzuki" },
      { label: "Zestaw naprawczy pompy wody", handle: "zestaw-naprawczy-pompy-wody" },
    ],
  },
  {
    label: "Oleje i chemia",
    short: "Oleje",
    handle: "oleje-suzuki",
    lead: "Eksploatacja i konserwacja",
    children: [
      { label: "Oleje Suzuki", handle: "oleje-suzuki" },
      { label: "Suzuki ECSTAR", handle: "suzuki-oleje" },
      { label: "Mercury", handle: "mercury-oleje" },
      { label: "Quicksilver", handle: "quicksilver" },
      { label: "Materiały eksploatacyjne", handle: "materialy-eksploatacyjne" },
    ],
  },
  {
    label: "Akcesoria",
    handle: "akcesoria",
    lead: "Wyposażenie pokładowe",
    children: [
      { label: "Akcesoria", handle: "akcesoria" },
      { label: "Łodzie motorowe", handle: "lodzie-motorowe" },
      { label: "Promocje Garmin", handle: "promocje-garmin" },
    ],
  },
]

export type ShopMenuGroup = {
  label: string
  /** Krótsza nazwa do paska nagłówka — pełna zostaje w rozwijanym menu. */
  short?: string
  handle: string
  lead?: string
  productCount: number
  children: (TaxonomyItem & { productCount: number })[]
}

/**
 * Nakłada kuratorską strukturę na kategorie zwrócone przez Medusę.
 * Zostawia tylko to, co realnie ma produkty — dzięki temu pusta gałąź
 * w Medusie nie tworzy martwego linku w menu.
 */
export function buildShopMenu(
  categories: { name: string; handle: string; productCount?: number }[]
): ShopMenuGroup[] {
  const byHandle = new Map(categories.map((category) => [category.handle, category]))

  return SHOP_TAXONOMY.map((group) => {
    const children = group.children
      .map((child) => {
        const category = byHandle.get(child.handle)
        return category ? { ...child, productCount: category.productCount || 0 } : null
      })
      .filter((child): child is TaxonomyItem & { productCount: number } => {
        return Boolean(child && child.productCount > 0)
      })
      // Nagłówek sekcji bez ani jednej pozycji pod sobą byłby sierotą.
      .filter((child, index, list) => {
        if (!child.section) return true
        const next = list[index + 1]
        return Boolean(next && !next.section)
      })

    const root = byHandle.get(group.handle)
    const productCount =
      root?.productCount ||
      children.reduce((sum, child) => Math.max(sum, child.productCount), 0)

    return { ...group, children, productCount }
  }).filter((group) => group.productCount > 0 || group.children.length > 0)
}

/**
 * Dział, w którym siedzi dana kategoria — po nim budujemy pasek podkategorii.
 * Uwaga: uchwyt działu bywa taki sam jak uchwyt jego pierwszej pozycji
 * (Elektronika = `garmin`), więc najpierw szukamy wśród dzieci.
 */
export function findMenuGroup(
  menu: ShopMenuGroup[],
  handle?: string
): ShopMenuGroup | null {
  if (!handle) return null

  const byChild = menu.find((group) => group.children.some((child) => child.handle === handle))
  if (byChild) return byChild

  return menu.find((group) => group.handle === handle) || null
}

/**
 * Szybkie wejścia pod kadrem — wybór kuratorski, nie „sześć najliczniejszych".
 * Sortowanie po liczbie produktów wypychało na górę „Pozostałe" i „Maintenance Kit".
 */
export const QUICK_LINK_HANDLES = [
  "silniki-suzuki",
  "silniki-zaburtowe-mercury",
  "silniki-elektryczne-torqeedo",
  "garmin",
  "czesci",
  "zestawy-serwisowe",
]

/** Etykieta i licznik dla uchwytu — szuka i wśród działów, i wśród pozycji. */
export function findMenuEntry(
  menu: ShopMenuGroup[],
  handle: string
): { label: string; productCount: number } | null {
  for (const group of menu) {
    if (group.handle === handle) return { label: group.label, productCount: group.productCount }

    const child = group.children.find((item) => item.handle === handle)
    if (child) return { label: child.label, productCount: child.productCount }
  }
  return null
}
