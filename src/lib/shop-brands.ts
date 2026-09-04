// Zajawki marek na stronie sklepu — wzorem garmin.com, gdzie każda rodzina
// sprzętu ma własny blok z kadrem i krótkim hasłem, zamiast jednej płaskiej listy.
//
// TREŚĆ EDYTUJE SIĘ W MEDUSIE: Ustawienia → Kategorie produktów → wybrana
// kategoria → Metadata. Klucze: `zajawka_nadlinia`, `zajawka_tytul`,
// `zajawka_opis`, `zajawka_zdjecie`. Wpisy poniżej są wartościami domyślnymi,
// używanymi dopóki w kategorii nie ma metadanych.
//
// `match` to fraza szukana w nazwie produktu (Medusa nie ma pola „marka”).
// `image` to plik z `public/marki-lifestyle` — PLACEHOLDER do podmiany na
// materiały producenta; bez pliku sekcja bierze kadr z galerii modeli.
//
// Teksty są po polsku, tak jak nazwy i opisy produktów z Medusy — one też
// nie są tłumaczone na pozostałe języki.

export type ShopBrandTeaser = {
  name: string
  match: string
  logo: string
  image?: string
  eyebrow: string
  title: string
  lead: string
  /** Kategoria, do której prowadzi „zobacz wszystko”. */
  categoryHandle?: string
}

export const BRAND_TEASERS: ShopBrandTeaser[] = [
  {
    name: "Garmin",
    match: "garmin",
    logo: "/marki-sklep/garmin.png",
    image: "/marki-lifestyle/garmin.jpg",
    eyebrow: "Nawigacja i echosondy",
    title: "Zobacz dno, zanim je poczujesz",
    lead:
      "Plotery GPSMAP i echomapy z ekranami od 7 do 12 cali, przetworniki oraz mapy Navionics. Montaż i konfigurację robimy u siebie w Gdyni.",
    categoryHandle: "garmin",
  },
  {
    name: "Torqeedo",
    match: "torqeedo",
    logo: "/marki-sklep/torqeedo.png",
    image: "/marki-lifestyle/torqeedo.jpg",
    eyebrow: "Napęd elektryczny",
    title: "Ciche silniki na wody, gdzie spalinowy nie wpłynie",
    lead:
      "Travel, Ultralight i Cruise — z baterią albo bez, z rumplem albo pod manetkę. Na jeziorach z zakazem spalinowych to jedyne wyjście.",
    categoryHandle: "silniki-elektryczne-torqeedo",
  },
  {
    name: "Suzuki",
    match: "suzuki",
    logo: "/marki-sklep/suzuki.png",
    image: "/marki-lifestyle/suzuki.png",
    eyebrow: "Silniki zaburtowe",
    title: "Od DF 2.5 do DF 350 — z serwisem, nie tylko ze sprzedaży",
    lead:
      "Cała gama Suzuki: krótka i długa kolumna, rumpel albo manetka, biały i czarny. Do każdego silnika mamy filtry, oleje i zestawy serwisowe.",
    categoryHandle: "silniki-suzuki",
  },
  {
    name: "Mercury",
    match: "mercury",
    logo: "/marki-sklep/mercury.png",
    eyebrow: "Autoryzowany serwis",
    title: "Mercury FourStroke i Avator, z częściami na miejscu",
    lead:
      "Silniki spalinowe i elektryczne Avator, a do nich oryginalne części, śruby i Quicksilver. Przeglądy robimy w naszym warsztacie.",
    categoryHandle: "silniki-zaburtowe-mercury",
  },
]

/** Nakłada treść z metadanych kategorii Medusy na wartości domyślne. */
export function applyBrandMetadata(
  brand: ShopBrandTeaser,
  metadata?: Record<string, unknown> | null
): ShopBrandTeaser {
  if (!metadata) return brand

  const text = (key: string) => {
    const value = metadata[key]
    return typeof value === "string" && value.trim() ? value.trim() : undefined
  }

  return {
    ...brand,
    eyebrow: text("zajawka_nadlinia") || brand.eyebrow,
    title: text("zajawka_tytul") || brand.title,
    lead: text("zajawka_opis") || brand.lead,
    image: text("zajawka_zdjecie") || brand.image,
  }
}

/**
 * Logotypy marek — pliki z materiałów Marinero (`public/marki-sklep`).
 * Jedno miejsce dla strony głównej sklepu i dla strony produktu.
 *
 * `match` to fraza szukana w nazwie produktu; Medusa nie ma pola „marka",
 * a po migracji z WooCommerce marka siedzi w tytule. Sprzedawca może to
 * nadpisać metadaną `marka` przy produkcie — tak samo jak przy parametrach.
 */
export type ShopBrandLogo = {
  name: string
  logo: string
  /** Fraza w nazwie produktu, po której poznajemy markę. */
  match: string
}

export const SHOP_BRAND_LOGOS: ShopBrandLogo[] = [
  { name: "Mercury", logo: "/marki-sklep/mercury.png", match: "mercury" },
  { name: "Suzuki", logo: "/marki-sklep/suzuki.png", match: "suzuki" },
  { name: "Garmin", logo: "/marki-sklep/garmin.png", match: "garmin" },
  { name: "Torqeedo", logo: "/marki-sklep/torqeedo.png", match: "torqeedo" },
  { name: "Fusion", logo: "/marki-sklep/fusion.png", match: "fusion" },
  { name: "Lowrance", logo: "/marki-sklep/lowrance.png", match: "lowrance" },
  { name: "Simrad", logo: "/marki-sklep/simrad.png", match: "simrad" },
]

/**
 * Marka produktu — najpierw metadana `marka` wpisana w panelu, potem odczyt
 * z nazwy. Gdy marki nie znamy albo nie mamy jej logotypu, oddajemy `null`
 * i strona produktu nic w tym miejscu nie pokazuje: pusty prostokąt nad nazwą
 * wygląda jak niezaładowany obrazek.
 */
export function brandLogoFor(
  title: string,
  metadata?: Record<string, unknown> | null
): ShopBrandLogo | null {
  const wpisana = String((metadata || {}).marka || "").trim().toLowerCase()
  if (wpisana) {
    return SHOP_BRAND_LOGOS.find((marka) => marka.name.toLowerCase() === wpisana) || null
  }

  const nazwa = (title || "").toLowerCase()
  return SHOP_BRAND_LOGOS.find((marka) => nazwa.includes(marka.match)) || null
}
