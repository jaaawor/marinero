// Zajawki marek na stronie sklepu — wzorem garmin.com, gdzie każda rodzina
// sprzętu ma własny blok z kadrem i krótkim hasłem, zamiast jednej płaskiej listy.
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
    title: "Od DF 6 do DF 350 — z serwisem, nie tylko ze sprzedaży",
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
