// Wspólny widok cen: sklep i Allegro obok siebie, sparowane po SKU.
//
// To jedyne miejsce, które łączy oba źródła. Panel, eksport arkusza i import
// czytają stąd, żeby kolumna „Cena Allegro" znaczyła wszędzie to samo.

import { listOffers, readAllegroConfig, type AllegroOffer } from "@/lib/allegro"
import { uzupelnijEany } from "@/lib/allegro-ean"
import { pobierzPary, type Pary } from "@/lib/allegro-pary"
import { cenaDetaliczna, przekreslonaWlaczona } from "@/lib/cena-detaliczna"
import { historiaCen, najnizszaZ30Dni, type WpisHistorii } from "@/lib/historia-cen"
import { wagaKg } from "@/lib/waga"
import { medusaAdmin } from "@/lib/medusa-admin"

export type WierszCeny = {
  /** Pierwszy klucz pary: sygnatura sprzedawcy w Allegro to zwykle nasze SKU. */
  sku: string
  /** Drugi klucz pary — część ofert ma w sygnaturze EAN, nie SKU. */
  ean: string
  /**
   * Po czym udało się sparować. `reczne` to para przypięta w panelu — stoi
   * dopóki ktoś jej nie odepnie i wygrywa nawet z dokładnym SKU.
   */
  poCzym: "reczne" | "sku" | "ean" | "ean-allegro" | "sku-luzno" | "ean-luzno" | ""
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
  /**
   * Waga w kilogramach — z metadanej `waga`, a gdy jej nie ma, z wagi wariantu
   * w Medusie. Idzie do feedu Google jako `g:shipping_weight`.
   */
  waga: number | null
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
  /**
   * Produkt **przygotowany, ale jeszcze nie wystawiony** — szkic założony
   * importem albo w edytorze, który nigdy nie był w sprzedaży. To co innego
   * niż szkic **wycofany** ze sprzedaży: pierwszy czeka na publikację, drugi
   * już jej nie chce. Jeden filtr na oba nie odpowiadał na żadne z dwóch pytań.
   */
  przygotowany: boolean
  /** Kod dostępności (`od-reki`, `2-3-dni`…); pusto = zgadujemy po marce. */
  dostepnosc: string
  /**
   * Para przypięta ręcznie, ale wskazanej oferty **nie ma wśród pobranych
   * z Allegro** — sprzedana, zakończona albo skasowana. Mówimy o tym wprost
   * zamiast po cichu szukać nowej: przypięcie było decyzją człowieka i to
   * człowiek ma zdecydować, co dalej.
   */
  paraZnikla: boolean
  /** Pusto, gdy produkt nie ma odpowiednika na Allegro. */
  ofertaId: string
  /**
   * EAN (GTIN) wpisany przy ofercie na Allegro. Prawie każda aukcja go ma,
   * a u nas przy części produktów pole EAN stoi puste — panel pokazuje go
   * wtedy jako podpowiedź do przepisania. Pusty, dopóki oferty o niego nie
   * zapytaliśmy (`allegro-ean.ts` dopytuje po garstce na wejście).
   */
  eanAllegro: string
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
  /**
   * Najbliższy produkt ze sklepu **po nazwie** — podpowiedź do sparowania
   * jednym kliknięciem, nie automat. Nazwy po obu stronach są nasze i po
   * polsku, więc tu porównanie tekstów ma sens (inaczej niż przy cennikach
   * producentów, gdzie nasze pozycje są po polsku, a cennik po angielsku).
   * Zawsze wymaga potwierdzenia: dwie „Anody aluminiowe Suzuki" różnią się
   * jednym zakresem mocy i pomyłka wpisałaby cenę nie tam, gdzie trzeba.
   */
  podpowiedz: { wariantId: string; tytul: string; sku: string; pewnosc: number } | null
}

const POLA =
  "id,title,handle,status,+metadata,categories.name,categories.handle," +
  "variants.id,variants.title,variants.sku,variants.weight,*variants.prices"

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
  /**
   * Ile ofert zapytaliśmy o EAN i przy ilu go znaleźliśmy. Widać to pod
   * tabelą: gdyby liczba z EAN-em stała na zerze mimo setek zapytanych ofert,
   * znaczyłoby to, że Allegro trzyma go w innym polu niż szukamy — i lepiej,
   * żeby było to widać, niż żeby kolumna po cichu została pusta.
   */
  eanyAllegro: { zapytane: number; zEanem: number; wszystkie: number }
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
  // cały czas pobierania i wyglądałby dokładnie tak, jak wyglądał komunikat
  // „pobieram": jak zawieszony.
  //
  // **Najwyżej dwie strony naraz.** Zapytanie ciągnie `*variants.prices`, czyli
  // cały moduł wyceny Medusy, i przy trzystu produktach jest to jej najcięższa
  // robota. Puszczone hurtem (przy 387 produktach to trzy takie zapytania
  // w jednej chwili) duszą się nawzajem na jednym procesie Node i każde z nich
  // ma szansę przekroczyć limit czasu — czyli cała zakładka pada przez to, że
  // za bardzo się spieszyliśmy. Dwie naraz są wyraźnie szybsze niż po kolei
  // i nie zajeżdżają sklepu.
  const offsety: number[] = []
  for (let offset = 100; offset < ile; offset += 100) offsety.push(offset)

  const RAZEM = 2
  const kolejka = [...offsety]

  const robotnik = async () => {
    for (;;) {
      const offset = kolejka.shift()
      if (offset === undefined) return
      const strona: any = await medusaAdmin(
        `/admin/products?limit=100&offset=${offset}&order=title&fields=${POLA}`
      )
      produkty.push(...(strona?.products || []))
      postepProduktow()
    }
  }

  await Promise.all(Array.from({ length: Math.min(RAZEM, kolejka.length) }, robotnik))

  let oferty: AllegroOffer[] = []
  let allegroDziala = false
  let eanyAllegro = { zapytane: 0, zEanem: 0, wszystkie: 0 }

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

  // **Druga mapa, na luźno.** Sygnatury wpisywane ręcznie w panelu Allegro
  // różnią się od naszych SKU kosmetyką: wielkością liter, spacją, myślnikiem
  // („55321-87J01-000" kontra „5532187J01000", „1166-00" kontra „116600").
  // Dla dopasowania to ten sam numer, a dla porównania tekstów — dwa różne,
  // więc dziesiątki pozycji wypadały z zestawienia jako „nie ma na Allegro".
  //
  // Klucz luźny zostawia **same litery i cyfry**. Gdy dwie różne oferty
  // sprowadzają się do tego samego klucza, **wyrzucamy go z mapy**: przy
  // niejednoznaczności lepiej zostawić obie w liście do ręcznego sparowania,
  // niż przypisać cenę nie tej ofercie, co trzeba.
  const luzny = (tekst: string) => tekst.toUpperCase().replace(/[^A-Z0-9]/g, "")

  const poLuznej = new Map<string, AllegroOffer | null>()
  for (const oferta of oferty) {
    const klucz = luzny(oferta.signature || "")
    if (!klucz) continue
    // `null` oznacza „klucz niejednoznaczny" — raz ustawiony, już nie wraca.
    poLuznej.set(klucz, poLuznej.has(klucz) ? null : oferta)
  }

  // **Pary przypięte ręcznie w panelu.** Stoją ponad całym parowaniem po
  // sygnaturze: sprzedawca raz powiedział „to jest ta oferta" i nie ma po co
  // wracać do tego przy każdym odświeżeniu. Odczyt Directusa jest jeden
  // i nie może przewrócić zestawienia — bez par działa ono jak dotąd.
  const pary: Pary = await pobierzPary().catch(() => ({}) as Pary)
  const poId = new Map(oferty.map((oferta) => [oferta.id, oferta]))

  // Pary po wariantach, których już nie ma w sklepie (produkt skasowany),
  // pomijamy: inaczej blokowałyby ofertę na zawsze, a wiersz, do którego ta
  // oferta pasuje po SKU, wyglądałby na „do wystawienia".
  const istnieje = new Set<string>()
  for (const produkt of produkty) {
    for (const wariant of produkt.variants || []) istnieje.add(wariant.id)
  }

  // Oferta przypięta do jednego produktu nie może wpaść drugiemu po sygnaturze
  // — ten drugi dostałby cudzą cenę, a zapis szedłby na cudzą aukcję.
  const zajete = new Set(
    Object.entries(pary)
      .filter(([wariantId]) => istnieje.has(wariantId))
      .map(([, para]) => para.oferta)
  )

  const wiersze: WierszCeny[] = []
  const uzyte = new Set<string>()

  for (const produkt of produkty) {
    for (const wariant of produkt.variants || []) {
      const sku = String(wariant.sku || "").trim()
      const ean = String((produkt.metadata || {}).ean || "").trim()

      const przypieta = pary[wariant.id]
      const zPary = przypieta ? poId.get(przypieta.oferta) : undefined

      // Wolne są tylko oferty nieprzypięte gdzie indziej. Kolejność dalej idzie
      // od najpewniejszego do najluźniejszego: dokładne SKU, dokładny EAN,
      // a dopiero potem to samo z pominięciem kosmetyki zapisu.
      const wolna = (oferta?: AllegroOffer | null) =>
        oferta && !zajete.has(oferta.id) ? oferta : undefined

      const poSku = przypieta ? undefined : wolna(sku ? poSygnaturze.get(sku) : undefined)
      const poEan = przypieta || poSku ? undefined : wolna(ean ? poSygnaturze.get(ean) : undefined)
      const luznoSku =
        przypieta || poSku || poEan ? undefined : wolna(sku ? poLuznej.get(luzny(sku)) : undefined)
      const luznoEan =
        przypieta || poSku || poEan || luznoSku
          ? undefined
          : wolna(ean ? poLuznej.get(luzny(ean)) : undefined)

      const oferta = zPary || poSku || poEan || luznoSku || luznoEan
      if (oferta) uzyte.add(oferta.id)

      wiersze.push({
        sku,
        ean,
        poCzym: zPary
          ? "reczne"
          : poSku
            ? "sku"
            : poEan
              ? "ean"
              : luznoSku
                ? "sku-luzno"
                : luznoEan
                  ? "ean-luzno"
                  : "",
        paraZnikla: Boolean(przypieta && !zPary),
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
        waga: wagaKg({ metadata: produkt.metadata || {}, variants: produkt.variants || [] }),
        notatka: String((produkt.metadata || {}).notatka || ""),
        bezAllegro: (produkt.metadata || {}).bez_allegro === true,
        przygotowany: (produkt.metadata || {}).przygotowany === true,
        dostepnosc: String((produkt.metadata || {}).dostepnosc || ""),
        ofertaId: oferta?.id || "",
        eanAllegro: "",
        nazwaAllegro: oferta?.name || "",
        cenaAllegro: oferta ? oferta.price : null,
        stanAllegro: oferta ? oferta.stock : null,
      })
    }
  }

  // **Drugie podejście: po EAN-ie wpisanym przy ofercie na Allegro.**
  //
  // Sygnatura bywa pusta albo z literówką, ale EAN (GTIN) ma tam praktycznie
  // każda aukcja — i jest to ten sam numer, który mamy przy produkcie. Lista
  // ofert go nie niesie, więc dopytujemy o niego po jednej ofercie i zapisujemy
  // u siebie; przy pierwszym wejściu dociągnie się garstka, przy kolejnych
  // reszta. Pytamy najpierw o oferty **bez pary** (tam EAN coś zmienia),
  // potem o te sparowane z produktem, przy którym EAN-u nie mamy — żeby dało
  // się go stamtąd przepisać.
  if (config && allegroDziala) {
    melduj(2 + ETAP_PRODUKTY + ETAP_ALLEGRO, "Sprawdzam EAN-y ofert…")

    const bezPary = oferty.filter((oferta) => !uzyte.has(oferta.id))
    // Kolejność jest kolejnością pożytku: najpierw oferty **bez pary** (tam EAN
    // może sparować), potem sparowane z produktem **bez EAN-u** (jest co
    // przepisać), a na końcu **cała reszta**.
    //
    // Reszta jest tu nie dla ozdoby: bez niej oferta sparowana z produktem,
    // który EAN już ma, nie trafiała do pytania **nigdy** — licznik stawał na
    // „285 z 286" i w kółko obiecywał, że dopyta resztę. Numer i tak się
    // przydaje, bo rozbieżny EAN po obu stronach jest sygnałem, że para może
    // być nie ta.
    const chetne = [
      ...bezPary.map((oferta) => oferta.id),
      ...wiersze.filter((wiersz) => wiersz.ofertaId && !wiersz.ean).map((wiersz) => wiersz.ofertaId),
      ...oferty.map((oferta) => oferta.id),
    ]

    const { mapa, znane } = await uzupelnijEany(config, chetne).catch(() => ({
      mapa: new Map<string, string>(),
      znane: 0,
    }))

    eanyAllegro = { zapytane: znane, zEanem: mapa.size, wszystkie: oferty.length }

    for (const wiersz of wiersze) {
      if (wiersz.ofertaId) wiersz.eanAllegro = mapa.get(wiersz.ofertaId) || ""
    }

    // Produkt o tym samym EAN-ie co oferta. Dwa produkty z jednym EAN-em to
    // niejednoznaczność — wtedy nie parujemy żadnego, tak samo jak przy
    // luźnych sygnaturach.
    const poEanProduktu = new Map<string, WierszCeny | null>()
    for (const wiersz of wiersze) {
      if (wiersz.ofertaId || wiersz.paraZnikla || !wiersz.ean) continue
      poEanProduktu.set(wiersz.ean, poEanProduktu.has(wiersz.ean) ? null : wiersz)
    }

    for (const oferta of bezPary) {
      const ean = mapa.get(oferta.id)
      if (!ean) continue
      const wiersz = poEanProduktu.get(ean)
      if (!wiersz || wiersz.ofertaId) continue

      wiersz.ofertaId = oferta.id
      wiersz.eanAllegro = ean
      wiersz.nazwaAllegro = oferta.name
      wiersz.cenaAllegro = oferta.price
      wiersz.stanAllegro = oferta.stock
      wiersz.poCzym = "ean-allegro"
      uzyte.add(oferta.id)
    }
  }

  // Do podpowiedzi biorą się tylko produkty **jeszcze niesparowane** — dwie
  // oferty wskazujące na ten sam produkt dostałyby cenę z jednego wiersza.
  const wolne = wiersze.filter((wiersz) => !wiersz.ofertaId)

  const ofertyBezProduktu: OfertaBezProduktu[] = oferty
    .filter((oferta) => !uzyte.has(oferta.id))
    .map((oferta) => ({
      id: oferta.id,
      nazwa: oferta.name,
      sygnatura: oferta.signature,
      cena: oferta.price,
      stan: oferta.stock,
      podpowiedz: najblizszyProdukt(oferta.name, wolne),
    }))

  zapamietane = {
    kiedy: Date.now(),
    dane: { wiersze, allegroDziala, ofertyBezProduktu, eanyAllegro },
  }
  return zapamietane.dane
}

/**
 * Najbliższy produkt po nazwie — do podpowiedzi przy ręcznym parowaniu ofert.
 *
 * Liczymy **wspólne słowa**, nie podobieństwo znak po znaku: „Anoda aluminiowa
 * Suzuki 2.5-350KM" i „Anoda aluminiowa do Suzuki 2,5–350 KM" mają wspólne
 * wszystko, co się liczy, a odległość edycyjna widzi w nich kilkanaście różnic.
 * Liczby traktujemy **osobno i twardo**: gdy obie nazwy je mają, a się nie
 * zgadzają, podpowiedzi nie ma. „60-350 KM" i „50-140 KM" to różne anody
 * i pomyłka tutaj wpisałaby cenę nie na ten produkt — a to jest gorsze niż
 * brak podpowiedzi.
 */
function najblizszyProdukt(
  nazwaOferty: string,
  kandydaci: WierszCeny[]
): { wariantId: string; tytul: string; sku: string; pewnosc: number } | null {
  const slowa = (tekst: string) =>
    new Set(
      tekst
        .toLowerCase()
        .replace(/[^a-ząćęłńóśźż0-9]+/g, " ")
        .split(" ")
        .filter((slowo) => slowo.length > 2)
    )

  const liczby = (tekst: string) => new Set((tekst.match(/\d+/g) || []).map(String))

  const slowaOferty = slowa(nazwaOferty)
  const liczbyOferty = liczby(nazwaOferty)
  if (!slowaOferty.size) return null

  let najlepszy: { wariantId: string; tytul: string; sku: string; pewnosc: number } | null = null

  for (const kandydat of kandydaci) {
    const liczbyProduktu = liczby(kandydat.tytul)
    // Blokada na liczbach — i to **twarda**: zbiory muszą się zgadzać co do
    // jednej, nie wystarczy jedna wspólna. „Anoda aluminiowa Suzuki 60-350 KM"
    // i „Anoda aluminiowa Suzuki 2.5-350KM" mają wspólne 350 i sześćdziesiąt
    // procent wspólnych słów, a to dwie różne anody. Odrzucenie kosztuje jedno
    // ręczne sparowanie; pomyłka kosztuje cenę wpisaną nie na ten produkt.
    if (liczbyOferty.size && liczbyProduktu.size) {
      const takieSame =
        liczbyOferty.size === liczbyProduktu.size &&
        [...liczbyOferty].every((l) => liczbyProduktu.has(l))
      if (!takieSame) continue
    }

    const slowaProduktu = slowa(kandydat.tytul)
    if (!slowaProduktu.size) continue

    const trafione = [...slowaOferty].filter((slowo) => slowaProduktu.has(slowo)).length
    // Miara Jaccarda: wspólne słowa do sumy obu zbiorów. Sama liczba trafień
    // premiowałaby długie nazwy, w których wszystko pasuje do wszystkiego.
    const pewnosc = trafione / (slowaOferty.size + slowaProduktu.size - trafione)

    if (pewnosc > (najlepszy?.pewnosc ?? 0)) {
      najlepszy = {
        wariantId: kandydat.wariantId,
        tytul: kandydat.tytul,
        sku: kandydat.sku,
        pewnosc,
      }
    }
  }

  // Poniżej połowy wspólnych słów podpowiedź jest zgadywaniem, a zgadywanie
  // przy cenach kosztuje więcej, niż daje.
  return najlepszy && najlepszy.pewnosc >= 0.5 ? najlepszy : null
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
  "Dostępność",
  "Stan Allegro",
  "Oferta Allegro",
  "Waga (kg)",
  "Bez Allegro",
  "Notatka",
]

/** Szerokości kolumn dobrane do treści — SKU i nazwy są długie. */
export const SZEROKOSCI_ARKUSZA = [20, 16, 52, 22, 12, 13, 14, 15, 13, 13, 13, 16, 13, 16, 11, 12, 46]

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
    // Kod, nie opis: kody są krótkie i pisze się je bez pomyłki („od-reki",
    // „2-3-dni"), a po powrocie arkusza wchodzą wprost do metadanych.
    w.dostepnosc,
    w.stanAllegro,
    // Identyfikator oferty zapisujemy jako **tekst** (`inlineStr`), nie liczbę:
    // Excel zrobiłby z dwunastocyfrowego numeru notację wykładniczą i po
    // powrocie nie dałoby się go z niczym dopasować.
    w.ofertaId,
    // Waga w kilogramach — pusto, gdy nie znamy jej z żadnego źródła.
    // Zero byłoby tu kłamstwem, a nie „nie wiem".
    w.waga,
    w.bezAllegro ? "tak" : "nie",
    w.notatka,
  ]
}
