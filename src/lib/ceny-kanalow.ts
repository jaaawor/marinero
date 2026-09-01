// Wspólny widok cen: sklep i Allegro obok siebie, sparowane po SKU.
//
// To jedyne miejsce, które łączy oba źródła. Panel, eksport arkusza i import
// czytają stąd, żeby kolumna „Cena Allegro" znaczyła wszędzie to samo.

import { listOffers, readAllegroConfig, type AllegroOffer } from "@/lib/allegro"
import { cenaDetaliczna, przekreslonaWlaczona } from "@/lib/cena-detaliczna"
import { historiaCen, najnizszaZ30Dni, type WpisHistorii } from "@/lib/historia-cen"
import { medusaAdmin } from "@/lib/medusa-admin"

export type WierszCeny = {
  /** Pierwszy klucz pary: sygnatura sprzedawcy w Allegro to zwykle nasze SKU. */
  sku: string
  /** Drugi klucz pary — część ofert ma w sygnaturze EAN, nie SKU. */
  ean: string
  /** Po czym udało się sparować: `sku`, `ean` albo pusto. */
  poCzym: "sku" | "ean" | ""
  produktId: string
  wariantId: string
  tytul: string
  handle: string
  status: string
  kategoria: string
  /** Uchwyty kategorii — po nich reguła cenowa trafia we właściwy wyjątek. */
  kategorieUchwyty: string[]
  cenaSklep: number | null
  /** Stan w sklepie: sztuki na półce. Metadana produktu, nie magazyn Medusy. */
  sztuki: number | null
  /** Sugerowana cena detaliczna od dostawcy — do porównania, nie do sprzedaży. */
  cenaDetaliczna: number | null
  /** Czy pokazujemy ją klientowi jako przekreśloną cenę regularną. */
  przekreslona: boolean
  /** Kiedy ostatnio ruszaliśmy cenę sklepową (ISO albo pusto). */
  cenaZmieniona: string
  /** Kiedy ostatnio ruszaliśmy cenę detaliczną. */
  detalicznaZmieniona: string
  /** Historia cen sklepowych — z niej liczy się najniższa cena z 30 dni. */
  historia: WpisHistorii[]
  /** Najniższa cena z 30 dni przed dzisiaj; `null`, gdy nie ma jeszcze historii. */
  najnizsza30: number | null
  /** Notatka sprzedawcy — widoczna tylko w panelu, nigdy w sklepie. */
  notatka: string
  /**
   * Produkt, którego **nie wolno nam sprzedawać na Allegro** (umowa z dostawcą,
   * zakaz producenta, towar tylko do odbioru osobistego). Bez tego znacznika
   * „nie ma oferty na Allegro" znaczyło raz „jeszcze nie wystawiliśmy",
   * a raz „i nie wystawimy" — a to dwie zupełnie różne rzeczy przy przeglądaniu
   * listy braków.
   */
  bezAllegro: boolean
  /** Pusto, gdy produkt nie ma odpowiednika na Allegro. */
  ofertaId: string
  nazwaAllegro: string
  cenaAllegro: number | null
  stanAllegro: number | null
}

/**
 * Oferta z Allegro, której nie umiemy przypiąć do produktu — zwykle sygnatura
 * sprzedawcy jest pusta albo nie zgadza się z żadnym SKU ani EAN-em. To one
 * wypadają z zestawienia i z synchronizacji, więc muszą być widoczne: inaczej
 * „nie ma na Allegro" przy produkcie oznacza raz brak oferty, a raz literówkę
 * w sygnaturze i nie da się tego odróżnić.
 */
export type OfertaBezProduktu = {
  id: string
  nazwa: string
  sygnatura: string
  cena: number
  stan: number
}

const POLA =
  "id,title,handle,status,+metadata,categories.name,categories.handle," +
  "variants.id,variants.title,variants.sku,*variants.prices"

/** Liczba z metadanych — puste, „" i śmieci czytamy jako brak. */
function liczbaSztuk(wartosc: unknown): number | null {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null
  const liczba = Number(wartosc)
  return Number.isFinite(liczba) ? Math.max(0, Math.round(liczba)) : null
}

function cenaPln(wariant: any): number | null {
  const ceny = Array.isArray(wariant?.prices) ? wariant.prices : []
  const pln = ceny.find((c: any) => String(c.currency_code).toLowerCase() === "pln")
  return pln ? Number(pln.amount) : null
}

// Jedno zestawienie to cztery strony produktów z Medusy i trzy strony ofert
// z Allegro — siedem żądań po sieci, każde po sekundę czy dwie. Bez pamięci
// podręcznej każde wejście na stronę i każde odświeżenie po zapisie kazało
// czekać kilkanaście sekund, a przy Node z jednym wątkiem blokowało też resztę
// panelu. Minuta w zupełności wystarcza: ceny nie zmieniają się co sekundę,
// a zapis i tak odświeża zestawienie u siebie.
const WAZNOSC_MS = 60_000
type Zestawienie = {
  wiersze: WierszCeny[]
  allegroDziala: boolean
  ofertyBezProduktu: OfertaBezProduktu[]
}

let zapamietane: { kiedy: number; dane: Zestawienie } | null = null

/**
 * Trwające pobranie i jego słuchacze postępu.
 *
 * Zestawienie zapisuje się do pamięci **dopiero na końcu**, więc bez tego
 * drugie wejście w zakładkę — albo odświeżenie, albo druga karta — zaczynało
 * własny pełny przebieg: kolejne cztery strony produktów i trzy strony ofert.
 * Node jest jednowątkowy, więc dwa takie przebiegi duszą się nawzajem i panel
 * stawał na pasku „Pytam sklep o produkty…", czasem na minuty. To samo
 * zabezpieczenie stoi przy wymianie tokenu Allegro i z tego samego powodu.
 *
 * Kto dołączy do trwającego pobrania, dostaje jego postęp — pasek nie może
 * stać w miejscu tylko dlatego, że pracę zaczął ktoś inny.
 */
let wTrakcie: Promise<Zestawienie> | null = null
const sluchacze = new Set<(postep: Postep) => void>()

/**
 * Ostatni meldunek trwającego pobrania.
 *
 * Kto dołącza w połowie, dostaje go **natychmiast**. Bez tego czekałby na
 * następny etap — a między „Pytam sklep o produkty…" a pierwszą stroną mija
 * kilka sekund, więc pasek stałby mu na zerze i wyglądało to dokładnie tak
 * jak awaria, którą to wszystko naprawia.
 */
let ostatniPostep: Postep | null = null

/** Co się właśnie dzieje — panel rysuje z tego pasek postępu. */
export type Postep = { procent: number; opis: string }

/**
 * Podział paska na etapy.
 *
 * Produkty to zwykle cztery strony po sekundę, oferty Allegro trzy — więc
 * pierwszy etap dostaje większy kawałek paska. Liczby są z góry i przybliżone,
 * ale pasek ma pokazywać, że coś się dzieje, a nie mierzyć czas do sekundy.
 */
const ETAP_PRODUKTY = 60
const ETAP_ALLEGRO = 34

/**
 * Wszystkie produkty ze sklepu z dopiętą ofertą Allegro.
 *
 * Allegro może nie odpowiedzieć — wtedy kolumny Allegro zostają puste,
 * a tabela cen sklepu i tak działa. Odwrotnie się nie da: bez Medusy nie ma
 * czego pokazywać.
 */
export async function wierszeCen(
  opcje: { odswiez?: boolean; onPostep?: (postep: Postep) => void } = {}
): Promise<Zestawienie> {
  if (!opcje.odswiez && zapamietane && Date.now() - zapamietane.kiedy < WAZNOSC_MS) {
    opcje.onPostep?.({ procent: 99, opis: "Zestawienie sprzed chwili — biorę z pamięci" })
    return zapamietane.dane
  }

  if (opcje.onPostep) {
    sluchacze.add(opcje.onPostep)
    // Dołączającemu od razu mówimy, gdzie jesteśmy.
    if (wTrakcie && ostatniPostep) {
      try {
        opcje.onPostep(ostatniPostep)
      } catch {}
    }
  }

  try {
    // Trwa już pobranie — dołączamy do niego zamiast zaczynać drugie.
    if (wTrakcie) return await wTrakcie

    wTrakcie = pobierzZestawienie()
    try {
      return await wTrakcie
    } finally {
      wTrakcie = null
      ostatniPostep = null
    }
  } finally {
    if (opcje.onPostep) sluchacze.delete(opcje.onPostep)
  }
}

async function pobierzZestawienie(): Promise<Zestawienie> {
  const melduj = (procent: number, opis: string) => {
    const postep = { procent: Math.min(99, Math.round(procent)), opis }
    ostatniPostep = postep

    for (const sluchacz of sluchacze) {
      // Jeden zerwany strumień nie może przerwać pobierania dla pozostałych.
      try {
        sluchacz(postep)
      } catch {}
    }
  }

  melduj(2, "Pytam sklep o produkty…")

  // Pierwsza strona mówi, ile jest wszystkiego — resztę pobieramy **równolegle**,
  // zamiast czekać na każdą po kolei.
  const pierwsza = await medusaAdmin(`/admin/products?limit=100&offset=0&order=title&fields=${POLA}`)
  const produkty: any[] = [...(pierwsza?.products || [])]
  const ile = Number(pierwsza?.count) || produkty.length

  const postepProduktow = () =>
    melduj(
      2 + (ETAP_PRODUKTY * produkty.length) / Math.max(ile, 1),
      `Produkty ze sklepu: ${produkty.length} z ${ile}`
    )

  postepProduktow()

  // Każda strona melduje się z osobna — inaczej pasek stałby w miejscu przez
  // cały `Promise.all` i wyglądałby dokładnie tak, jak wyglądał komunikat
  // „pobieram": jak zawieszony.
  const dalsze: Promise<void>[] = []
  for (let offset = 100; offset < ile; offset += 100) {
    dalsze.push(
      medusaAdmin(`/admin/products?limit=100&offset=${offset}&order=title&fields=${POLA}`).then(
        (strona: any) => {
          produkty.push(...(strona?.products || []))
          postepProduktow()
        }
      )
    )
  }

  await Promise.all(dalsze)

  let oferty: AllegroOffer[] = []
  let allegroDziala = false

  const config = readAllegroConfig()
  if (config) {
    melduj(2 + ETAP_PRODUKTY, "Pytam Allegro o oferty…")
    try {
      oferty = await listOffers(config, (pobrane, wszystkie) =>
        melduj(
          2 + ETAP_PRODUKTY + (ETAP_ALLEGRO * pobrane) / Math.max(wszystkie, 1),
          `Oferty na Allegro: ${pobrane} z ${wszystkie}`
        )
      )
      allegroDziala = true
    } catch {
      // Cisza jest tu celowa: brak Allegro to mniej kolumn, nie awaria.
    }
  }

  melduj(2 + ETAP_PRODUKTY + ETAP_ALLEGRO, "Paruję produkty z ofertami…")

  // Jedna mapa na sygnatury — pary szukamy najpierw po SKU, potem po EAN-ie.
  // Sam SKU nie wystarcza: część ofert została wystawiona z EAN-em w polu
  // sygnatury i wypadała z zestawienia jako „nie ma na Allegro", choć jest.
  const poSygnaturze = new Map<string, AllegroOffer>()
  for (const oferta of oferty) {
    const klucz = (oferta.signature || "").trim()
    if (klucz) poSygnaturze.set(klucz, oferta)
  }

  const wiersze: WierszCeny[] = []
  const uzyte = new Set<string>()

  for (const produkt of produkty) {
    for (const wariant of produkt.variants || []) {
      const sku = String(wariant.sku || "").trim()
      const ean = String((produkt.metadata || {}).ean || "").trim()

      const poSku = sku ? poSygnaturze.get(sku) : undefined
      const poEan = !poSku && ean ? poSygnaturze.get(ean) : undefined
      const oferta = poSku || poEan
      if (oferta) uzyte.add(oferta.id)

      wiersze.push({
        sku,
        ean,
        poCzym: poSku ? "sku" : poEan ? "ean" : "",
        produktId: produkt.id,
        wariantId: wariant.id,
        tytul: produkt.title || "",
        handle: produkt.handle || "",
        status: produkt.status || "",
        kategoria: produkt.categories?.[0]?.name || "",
        kategorieUchwyty: (produkt.categories || []).map((k: any) => k.handle).filter(Boolean),
        cenaSklep: cenaPln(wariant),
        sztuki: liczbaSztuk((produkt.metadata || {}).sztuki),
        cenaDetaliczna: cenaDetaliczna(produkt.metadata || {}),
        przekreslona: przekreslonaWlaczona(produkt.metadata || {}),
        cenaZmieniona: String((produkt.metadata || {}).cena_zmieniona || ""),
        detalicznaZmieniona: String((produkt.metadata || {}).cena_detaliczna_zmieniona || ""),
        historia: historiaCen(produkt.metadata || {}),
        najnizsza30: najnizszaZ30Dni(produkt.metadata || {}),
        notatka: String((produkt.metadata || {}).notatka || ""),
        bezAllegro: (produkt.metadata || {}).bez_allegro === true,
        ofertaId: oferta?.id || "",
        nazwaAllegro: oferta?.name || "",
        cenaAllegro: oferta ? oferta.price : null,
        stanAllegro: oferta ? oferta.stock : null,
      })
    }
  }

  const ofertyBezProduktu: OfertaBezProduktu[] = oferty
    .filter((oferta) => !uzyte.has(oferta.id))
    .map((oferta) => ({
      id: oferta.id,
      nazwa: oferta.name,
      sygnatura: oferta.signature,
      cena: oferta.price,
      stan: oferta.stock,
    }))

  zapamietane = { kiedy: Date.now(), dane: { wiersze, allegroDziala, ofertyBezProduktu } }
  return zapamietane.dane
}

/** Po zapisie ceny zestawienie jest nieaktualne — kasujemy je, zamiast czekać. */
export function zapomnijCeny() {
  zapamietane = null
}

export const NAGLOWKI_ARKUSZA = [
  "SKU",
  "EAN",
  "Nazwa",
  "Kategoria",
  "Publikacja",
  "Cena sklep",
  "Cena Allegro",
  "Cena detaliczna",
  "Przekreślona",
  "Zmiana ceny",
  "Stan sklep",
  "Stan Allegro",
  "Oferta Allegro",
  "Bez Allegro",
  "Notatka",
]

/** Szerokości kolumn dobrane do treści — SKU i nazwy są długie. */
export const SZEROKOSCI_ARKUSZA = [20, 16, 52, 22, 12, 13, 14, 15, 13, 13, 13, 13, 16, 12, 46]

export function wierszDoArkusza(w: WierszCeny) {
  return [
    w.sku,
    // EAN jako tekst — zera wiodące i trzynaście cyfr, Excel zrobiłby z tego
    // liczbę i uciął pierwszą cyfrę.
    w.ean,
    w.tytul,
    w.kategoria,
    w.status === "published" ? "opublikowany" : "szkic",
    w.cenaSklep,
    w.cenaAllegro,
    w.cenaDetaliczna,
    w.przekreslona ? "tak" : "nie",
    // Data jako tekst „dd.mm.rrrr": Excel z surowego ISO robi ciąg znaków
    // i tak, a tekst przynajmniej czyta się bez tłumaczenia.
    w.cenaZmieniona ? new Date(w.cenaZmieniona).toLocaleDateString("pl-PL") : "",
    w.sztuki,
    w.stanAllegro,
    // Identyfikator oferty zapisujemy jako **tekst** (`inlineStr`), nie liczbę:
    // Excel zrobiłby z dwunastocyfrowego numeru notację wykładniczą i po
    // powrocie nie dałoby się go z niczym dopasować.
    w.ofertaId,
    w.bezAllegro ? "tak" : "nie",
    w.notatka,
  ]
}
