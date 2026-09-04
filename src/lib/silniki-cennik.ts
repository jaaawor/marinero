// Cennik silników do konfiguratorów — sam rachunek, bez sieci i bez sekretów.
//
// Ten sam plik czyta przeglądarka (tabela w panelu) i serwer (zapis cen do
// Directusa), więc nie może tu wejść ani `fetch`, ani token.
//
// PO CO TO JEST
//
// Ten sam silnik stoi dziś przy kilku łodziach i przy każdej ma inną cenę.
// Przy XO Suzuki 300 KM BTX kosztuje 26 740 EUR przy trzech łodziach, 27 180
// przy trzech innych i 33 296 przy DFNDR 8 — a to jest jeden i ten sam silnik.
// Rozjazdy biorą się z tego, że cennik producenta wchodził do każdej łodzi
// osobno, w różnych miesiącach.
//
// Dlatego cenę silnika podajemy **raz**, w złotych (bo w takich handlowiec
// myśli i takie dostaje od dostawcy), a wariant silnikowy przy łodzi liczy się
// z niej sam.
//
// JAK SIĘ TO LICZY
//
// Sprzedawca podaje **brutto w złotych**: osobno silnik i osobno zestaw
// instalacyjny (manetka, wiązka, stacyjka). Konfigurator liczy **netto
// w euro**, więc:
//
//     (silnik + zestaw) ÷ (1 + VAT) ÷ kurs = cena silnika w EUR netto
//
// A przy konkretnej łodzi:
//
//     cena wariantu = cena „bez silnika" + cena silnika w EUR
//
// Przy XO cena bazowa konfiguratora wynosi 0, a cenę kadłuba niesie pozycja
// „Bez silnika" — stąd to dodawanie. Przy markach z normalną ceną bazową
// wariant silnikowy nie zawiera kadłuba i wtedy dodajemy do zera.

export type PozycjaCennika = {
  /** Klucz, po którym wiążemy cennik z opcjami w Directusie. */
  klucz: string
  /** Nazwa, którą zobaczy klient — jedna dla wszystkich łodzi. */
  nazwa: string
  /** Ile silników niesie ta pozycja (1 albo 2). */
  sztuk: number
  /** Cena samego silnika, brutto w złotych. */
  silnikPln: number | null
  /** Zestaw instalacyjny, brutto w złotych. Pusty = wliczony w cenę silnika. */
  zestawPln: number | null
}

export type CennikSilnikow = {
  kurs: number
  vat: number
  /** Data ostatniej zmiany — żeby dało się powiedzieć, z kiedy są te ceny. */
  zaktualizowano: string
  pozycje: PozycjaCennika[]
}

export const DOMYSLNY_KURS = 4.3
export const DOMYSLNY_VAT = 0.23

export function pustyCennik(): CennikSilnikow {
  return { kurs: DOMYSLNY_KURS, vat: DOMYSLNY_VAT, zaktualizowano: "", pozycje: [] }
}

/** Suma brutto w złotych. `null` = ceny jeszcze nie podano. */
export function razemPln(pozycja: PozycjaCennika): number | null {
  if (pozycja.silnikPln === null) return null
  return pozycja.silnikPln + (pozycja.zestawPln || 0)
}

/**
 * Cena silnika w EUR netto — to ona wchodzi do konfiguratora.
 *
 * Zaokrąglamy do pełnego euro. Grosze w cenniku łodzi za sto tysięcy euro nic
 * nie wnoszą, a w ofercie wyglądają jak pomyłka.
 */
export function euroNetto(pozycja: PozycjaCennika, cennik: CennikSilnikow): number | null {
  const brutto = razemPln(pozycja)
  if (brutto === null) return null
  const kurs = Number(cennik.kurs) || DOMYSLNY_KURS
  const vat = Number.isFinite(cennik.vat) ? cennik.vat : DOMYSLNY_VAT
  if (kurs <= 0) return null
  return Math.round(brutto / (1 + vat) / kurs)
}

/**
 * Klucz pozycji z nazwy opcji. Ta sama nazwa bywa zapisana na kilka sposobów
 * (`Suzuki DF 250 APX`, `Suzuki DF250APX`, `Suzuki 250 KM APX`), więc do
 * wiązania służy postać bez spacji, bez nawiasów i bez oznaczeń `DF` i `KM`.
 * Liczba silników zostaje w kluczu, bo `2× DF 250` to inna pozycja cennika
 * niż `DF 250`.
 */
export function kluczSilnika(nazwa: string): string {
  const bezNawiasow = nazwa.replace(/\(.*?\)/g, " ").toLowerCase().replace(/×/g, "x")
  const ile = bezNawiasow.match(/^\s*(\d)\s*x\s*/)
  const sztuk = ile ? Number(ile[1]) : 1
  const reszta = ile ? bezNawiasow.slice(ile[0].length) : bezNawiasow
  const zbite = reszta.replace(/[^a-z0-9]/g, "").replace(/km/g, "").replace(/df/g, "")
  return `${sztuk}|${zbite}`
}

/** Ile silników niesie pozycja o takiej nazwie. */
export function ileSilnikow(nazwa: string): number {
  const ile = nazwa.replace(/×/g, "x").match(/^\s*(\d)\s*x\s*/i)
  return ile ? Number(ile[1]) : 1
}

export type OpcjaDoPrzeliczenia = {
  id: number
  nazwa: string
  cena: number
  slug: string
  /** Cena pozycji „Bez silnika" przy tej łodzi; 0, gdy łódź ma cenę bazową. */
  bezSilnika: number
}

export type Zmiana = {
  id: number
  slug: string
  staraNazwa: string
  nowaNazwa: string
  staraCena: number
  nowaCena: number
  bezSilnika: number
}

/**
 * Co się zmieni po zastosowaniu cennika. Zwracamy **wszystkie** dopasowane
 * pozycje, także te bez zmiany — po to, żeby podgląd odpowiadał na pytanie
 * „czego dotknę", a nie tylko „co się różni".
 */
export function policzZmiany(
  opcje: OpcjaDoPrzeliczenia[],
  cennik: CennikSilnikow
): { zmiany: Zmiana[]; bezCeny: string[] } {
  const poKluczu = new Map(cennik.pozycje.map((p) => [p.klucz, p]))
  const zmiany: Zmiana[] = []
  const bezCeny = new Set<string>()

  for (const opcja of opcje) {
    const pozycja = poKluczu.get(kluczSilnika(opcja.nazwa))
    if (!pozycja) continue

    const eur = euroNetto(pozycja, cennik)
    if (eur === null) {
      bezCeny.add(pozycja.nazwa || opcja.nazwa)
      continue
    }

    zmiany.push({
      id: opcja.id,
      slug: opcja.slug,
      staraNazwa: opcja.nazwa,
      nowaNazwa: pozycja.nazwa || opcja.nazwa,
      staraCena: opcja.cena,
      nowaCena: opcja.bezSilnika + eur,
      bezSilnika: opcja.bezSilnika,
    })
  }

  return { zmiany, bezCeny: [...bezCeny] }
}
