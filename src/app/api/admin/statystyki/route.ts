import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

type Wpis = { fraza: string; gdzie: string; wynikow: number | null; date_created: string }

/**
 * Początek okresu. `dni = 0` znaczy **cała historia** — nic nie kasujemy
 * i nie ma powodu, żeby panel nie umiał tego pokazać.
 */
function odIlu(dni: number) {
  if (!dni) return "1970-01-01T00:00:00.000Z"
  return new Date(Date.now() - dni * 24 * 60 * 60 * 1000).toISOString()
}

async function szukania(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/search_queries` +
    `?limit=-1&fields=fraza,gdzie,wynikow,date_created` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const wpisy: Wpis[] = (await odpowiedz.json())?.data || []

  // Zliczamy po frazie **znormalizowanej** (małe litery, zbite spacje), ale
  // pokazujemy pierwszy oryginalny zapis — inaczej „Nordkapp" i „nordkapp"
  // byłyby dwoma osobnymi wierszami.
  function podsumuj(gdzie: string) {
    const kubelki = new Map<string, { fraza: string; ile: number; bezWynikow: number }>()
    for (const wpis of wpisy) {
      if (wpis.gdzie !== gdzie) continue
      const klucz = wpis.fraza.toLowerCase().replace(/\s+/g, " ").trim()
      const kubelek = kubelki.get(klucz) || { fraza: wpis.fraza, ile: 0, bezWynikow: 0 }
      kubelek.ile += 1
      if (wpis.wynikow === 0) kubelek.bezWynikow += 1
      kubelki.set(klucz, kubelek)
    }
    return [...kubelki.values()].sort((a, b) => b.ile - a.ile)
  }

  const lodzie = podsumuj("lodzie")
  const sklep = podsumuj("sklep")

  return {
    dostepne: true as const,
    dni,
    razem: wpisy.length,
    lodzie: lodzie.slice(0, 40),
    sklep: sklep.slice(0, 40),
    // Frazy bez ani jednego wyniku to najkonkretniejszy sygnał, jaki daje
    // wyszukiwarka: ludzie szukają czegoś, czego nie mamy albo co nazywa się
    // u nas inaczej.
    bezWynikow: [...lodzie.map((w) => ({ ...w, gdzie: "lodzie" })), ...sklep.map((w) => ({ ...w, gdzie: "sklep" }))]
      .filter((w) => w.bezWynikow > 0)
      .sort((a, b) => b.bezWynikow - a.bezWynikow)
      .slice(0, 30),
  }
}

type Odslona = {
  sciezka: string
  gdzie: string
  tytul: string
  skad: string
  gosc: string
  odcisk: string
  kraj: string
  powracajacy: boolean
  date_created: string
}

/**
 * Kto odwiedził — sklejanie identyfikatora z ciasteczka z odciskiem dnia.
 *
 * Same ciasteczka nie wystarczą, bo klient, który ich nie przechowuje, dostaje
 * **nowy identyfikator przy każdej odsłonie**. Sam odcisk też nie, bo skleja
 * w jedno wszystkich za jednym firmowym łączem i zmienia się co dobę.
 *
 * Dlatego łączymy jedno z drugim, ale **tylko przez wiersze, w których
 * przeglądarka odesłała nasze ciasteczko** (`powracajacy`). Taki wiersz jest
 * dowodem, że ten identyfikator i ten odcisk to ta sama osoba, więc wolno je
 * połączyć. Robot, który ciasteczka nigdy nie odsyła, żadnego takiego dowodu
 * nie zostawia — jego kilkadziesiąt identyfikatorów zostaje przy jednym
 * odcisku i liczy się jako jedno wejście, zamiast jako kilkadziesiąt osób.
 *
 * Pierwsza odsłona nowego człowieka nie ma jeszcze ciasteczka i idzie po
 * odcisku; druga już je ma i dokleja do niego identyfikator — obie lądują
 * w jednym worku.
 */
class Tozsamosci {
  private rodzic = new Map<string, string>()

  private korzen(klucz: string): string {
    let biezacy = klucz
    while (this.rodzic.get(biezacy) && this.rodzic.get(biezacy) !== biezacy) {
      biezacy = this.rodzic.get(biezacy) as string
    }
    // Skracamy ścieżkę, żeby kolejne pytania szły od razu do korzenia.
    let krok = klucz
    while (this.rodzic.get(krok) && this.rodzic.get(krok) !== biezacy) {
      const nastepny = this.rodzic.get(krok) as string
      this.rodzic.set(krok, biezacy)
      krok = nastepny
    }
    return biezacy
  }

  dodaj(klucz: string) {
    if (!this.rodzic.has(klucz)) this.rodzic.set(klucz, klucz)
  }

  polacz(a: string, b: string) {
    this.dodaj(a)
    this.dodaj(b)
    const korzenA = this.korzen(a)
    const korzenB = this.korzen(b)
    if (korzenA !== korzenB) this.rodzic.set(korzenB, korzenA)
  }

  ktory(klucz: string): string {
    this.dodaj(klucz)
    return this.korzen(klucz)
  }
}

type ZnacznikOsoby = { gosc?: string; odcisk?: string; powracajacy?: boolean }

/** Buduje mapę sklejeń z całego zestawu wpisów. */
function zbudujTozsamosci(wpisy: ZnacznikOsoby[]): Tozsamosci {
  const mapa = new Tozsamosci()
  for (const wpis of wpisy) {
    // Tylko wiersz z odesłanym ciasteczkiem jest dowodem, że identyfikator
    // i odcisk należą do tej samej osoby.
    if (wpis.powracajacy && wpis.gosc && wpis.odcisk) {
      mapa.polacz(`g:${wpis.gosc}`, `o:${wpis.odcisk}`)
    }
  }
  return mapa
}

/**
 * Klucz jednej osoby.
 *
 * Kolejność jest odwrotna niż podpowiada intuicja: **najpierw odcisk**, bo to
 * on jest wspólny dla wszystkich odsłon klienta bez ciasteczek. Identyfikator
 * z ciasteczka wchodzi dopiero wtedy, gdy odcisku nie ma (brak adresu IP przy
 * starszych wpisach). Sklejenia z `zbudujTozsamosci` i tak sprowadzają oba
 * do jednego worka wszędzie tam, gdzie wiadomo, że to jedna osoba.
 */
function ktoOdwiedzil(mapa: Tozsamosci, wpis: ZnacznikOsoby, numer: number): string {
  if (wpis.odcisk) return mapa.ktory(`o:${wpis.odcisk}`)
  if (wpis.gosc) return mapa.ktory(`g:${wpis.gosc}`)
  // Wpis bez obu (dane sprzed wprowadzenia znaczników) liczymy jako osobne
  // wejście — inaczej wszystkie zlałyby się w jedno.
  return `bez-znacznika-${numer}`
}

/**
 * Odsłony stron — ile razy która strona została otwarta, osobno dla łodzi
 * i dla sklepu.
 *
 * Liczymy odsłony, nie ludzi: nie zapisujemy adresu IP ani ciasteczka, więc
 * nie da się z tego odtworzyć, kto co oglądał. Sprzedawcy potrzebna jest
 * odpowiedź na jedno pytanie — które łodzie i produkty przyciągają uwagę.
 */
async function odslony(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/page_views` +
    `?limit=-1&fields=sciezka,gdzie,tytul,skad,gosc,odcisk,kraj,powracajacy,date_created` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const wpisy: Odslona[] = (await odpowiedz.json())?.data || []
  const tozsamosci = zbudujTozsamosci(wpisy)

  function podsumuj(gdzie: string) {
    const kubelki = new Map<
      string,
      { sciezka: string; tytul: string; ile: number; osoby: Set<string> }
    >()

    for (const [numer, wpis] of wpisy.entries()) {
      if (wpis.gdzie !== gdzie) continue
      const kubelek = kubelki.get(wpis.sciezka) || {
        sciezka: wpis.sciezka,
        // Tytuł bierzemy z pierwszej odsłony — po zmianie nazwy modelu starsze
        // wpisy miałyby inny, a to jedna i ta sama strona.
        tytul: wpis.tytul || "",
        ile: 0,
        osoby: new Set<string>(),
      }
      if (!kubelek.tytul && wpis.tytul) kubelek.tytul = wpis.tytul
      kubelek.ile += 1
      kubelek.osoby.add(ktoOdwiedzil(tozsamosci, wpis, numer))
      kubelki.set(wpis.sciezka, kubelek)
    }

    return [...kubelki.values()]
      .map(({ osoby, ...reszta }) => ({ ...reszta, unikalnych: osoby.size }))
      .sort((a, b) => b.ile - a.ile)
  }

  // Skąd przychodzą — pusty wpis to wejście bezpośrednie albo z zakładki.
  const zrodla = new Map<string, number>()
  for (const wpis of wpisy) {
    const klucz = wpis.skad || "wejście bezpośrednie"
    zrodla.set(klucz, (zrodla.get(klucz) || 0) + 1)
  }

  // Skąd geograficznie — kod kraju ustalony przy zapisie odsłony.
  const kraje = new Map<string, { ile: number; osoby: Set<string> }>()
  for (const [numer, wpis] of wpisy.entries()) {
    const kod = (wpis.kraj || "").toUpperCase()
    const kubelek = kraje.get(kod) || { ile: 0, osoby: new Set<string>() }
    kubelek.ile += 1
    kubelek.osoby.add(ktoOdwiedzil(tozsamosci, wpis, numer))
    kraje.set(kod, kubelek)
  }

  // Szereg dzienny: jeden wiersz na dobę, z odsłonami i osobami. Tygodnie
  // i miesiące panel składa z tego sam — dzień jest najmniejszą cegłą, z której
  // da się zbudować każdy z trzech widoków bez trzech osobnych zapytań.
  const doby = new Map<string, { ile: number; osoby: Set<string> }>()
  for (const [numer, wpis] of wpisy.entries()) {
    const dzien = String(wpis.date_created || "").slice(0, 10)
    if (!dzien) continue
    const kubelek = doby.get(dzien) || { ile: 0, osoby: new Set<string>() }
    kubelek.ile += 1
    kubelek.osoby.add(ktoOdwiedzil(tozsamosci, wpis, numer))
    doby.set(dzien, kubelek)
  }

  const lodzie = podsumuj("lodzie")
  const sklep = podsumuj("sklep")

  const wszyscy = new Set(wpisy.map((wpis, numer) => ktoOdwiedzil(tozsamosci, wpis, numer)))

  return {
    dostepne: true as const,
    dni,
    razem: wpisy.length,
    unikalnych: wszyscy.size,
    razemLodzie: lodzie.reduce((suma, wpis) => suma + wpis.ile, 0),
    razemSklep: sklep.reduce((suma, wpis) => suma + wpis.ile, 0),
    lodzie: lodzie.slice(0, 40),
    sklep: sklep.slice(0, 40),
    zrodla: [...zrodla.entries()]
      .map(([nazwa, ile]) => ({ nazwa, ile }))
      .sort((a, b) => b.ile - a.ile)
      .slice(0, 12),
    kraje: [...kraje.entries()]
      .map(([kod, wpis]) => ({ kod, ile: wpis.ile, osoby: wpis.osoby.size }))
      .sort((a, b) => b.ile - a.ile)
      .slice(0, 30),
    seria: [...doby.entries()]
      .map(([dzien, wpis]) => ({ dzien, ile: wpis.ile, osoby: wpis.osoby.size }))
      .sort((a, b) => a.dzien.localeCompare(b.dzien)),
  }
}

type Sesja = {
  model_slug: string
  model_name: string
  etap: string
  opcji: number
  wartosc: number
  waluta: string
  gosc: string
  odcisk: string
  klient_imie: string
  klient_email: string
  klient_telefon: string
  uwagi: string
  date_updated: string
  date_created: string
}

/**
 * Konfiguratory: kto doszedł do końca, a kto się rozmyślił.
 *
 * Sama liczba wysłanych ofert tego nie pokaże — konfiguracja, która nie doszła
 * do wysyłki, nie zostawia po sobie nic, a to właśnie ona jest ciekawa.
 * Ktoś poskładał łódź za pół miliona i zamknął kartę: to sygnał, że warto
 * spojrzeć na cenę, opis albo na to, czy formularz nie odstrasza.
 */
async function konfiguratory(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/configurator_sessions` +
    `?limit=-1&fields=model_slug,model_name,etap,opcji,wartosc,waluta,gosc,odcisk,` +
    `klient_imie,klient_email,klient_telefon,uwagi,date_updated,date_created` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const sesje: Sesja[] = (await odpowiedz.json())?.data || []
  const tozsamosci = zbudujTozsamosci(sesje)

  const modele = new Map<
    string,
    {
      model: string
      slug: string
      zaczete: number
      wyslane: number
      porzucone: number
      waluta: string
      wartoscPorzuconych: number
      osoby: Set<string>
    }
  >()

  for (const [numer, sesja] of sesje.entries()) {
    const klucz = sesja.model_slug || sesja.model_name
    const wpis = modele.get(klucz) || {
      model: sesja.model_name || klucz,
      slug: sesja.model_slug || "",
      zaczete: 0,
      wyslane: 0,
      porzucone: 0,
      waluta: sesja.waluta || "",
      wartoscPorzuconych: 0,
      osoby: new Set<string>(),
    }

    wpis.zaczete += 1
    wpis.osoby.add(ktoOdwiedzil(tozsamosci, sesja, numer))
    if (sesja.etap === "wyslana") {
      wpis.wyslane += 1
    } else {
      wpis.porzucone += 1
      wpis.wartoscPorzuconych += Number(sesja.wartosc) || 0
    }

    modele.set(klucz, wpis)
  }

  const lista = [...modele.values()]
    .map(({ osoby, ...wpis }) => ({
      ...wpis,
      unikalnych: osoby.size,
      // Średnia z porzuconych, nie suma: suma rośnie z ruchem i nic nie mówi
      // o tym, jak drogie łodzie ludzie składają.
      sredniaPorzuconych: wpis.porzucone ? Math.round(wpis.wartoscPorzuconych / wpis.porzucone) : 0,
    }))
    .sort((a, b) => b.porzucone - a.porzucone || b.zaczete - a.zaczete)

  const maDane = (sesja: Sesja) =>
    Boolean(sesja.klient_imie || sesja.klient_email || sesja.klient_telefon)

  // Do wglądu: ostatnie porzucone konfiguracje, od najświeższej.
  const ostatnie = sesje
    .filter((sesja) => sesja.etap !== "wyslana")
    .sort((a, b) => (b.date_updated || b.date_created).localeCompare(a.date_updated || a.date_created))
    .slice(0, 40)
    .map((sesja) => ({
      model: sesja.model_name || sesja.model_slug,
      slug: sesja.model_slug,
      etap: sesja.etap,
      opcji: Number(sesja.opcji) || 0,
      wartosc: Number(sesja.wartosc) || 0,
      waluta: sesja.waluta || "",
      kiedy: sesja.date_updated || sesja.date_created,
      imie: sesja.klient_imie || "",
      email: sesja.klient_email || "",
      telefon: sesja.klient_telefon || "",
      uwagi: (sesja.uwagi || "").slice(0, 300),
    }))

  return {
    dostepne: true as const,
    zaczete: sesje.length,
    unikalnych: new Set(sesje.map((sesja, numer) => ktoOdwiedzil(tozsamosci, sesja, numer))).size,
    // Porzucone konfiguracje, przy których ktoś zdążył wpisać swoje dane.
    // To najwęższa i najciekawsza grupa: człowiek doszedł do samego końca
    // i zawrócił.
    zDanymi: sesje.filter((sesja) => sesja.etap !== "wyslana" && maDane(sesja)).length,
    wyslane: sesje.filter((sesja) => sesja.etap === "wyslana").length,
    modele: lista.slice(0, 30),
    ostatnie,
  }
}

async function koszyki() {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  // Medusa 2 nie wystawia listy koszyków przez API (`/admin/carts` odpowiada 404),
  // więc czytamy własne migawki z kolekcji `active_carts` — zapisuje je sklep
  // przy każdej zmianie koszyka i przy wypełnianiu zamówienia.
  const adres =
    `${DIRECTUS}/items/active_carts` +
    `?limit=60&sort=-date_updated&fields=id,cart_id,pozycje,sztuk,wartosc,email,etap,date_updated,date_created` +
    `&filter[etap][_neq]=zlozone` +
    `&filter[date_updated][_gte]=${encodeURIComponent(odIlu(14))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const lista = ((await odpowiedz.json())?.data || [])
    .filter((wpis: any) => Number(wpis.sztuk) > 0)
    .map((wpis: any) => ({
      id: String(wpis.id),
      email: wpis.email || "",
      zmieniony: wpis.date_updated || wpis.date_created,
      suma: Number(wpis.wartosc) || 0,
      waluta: "PLN",
      sztuk: Number(wpis.sztuk) || 0,
      etap: wpis.etap || "koszyk",
      pozycje: String(wpis.pozycje || ""),
    }))

  return { dostepne: true as const, koszyki: lista }
}

export async function GET(request: Request) {
  const zalogowany = await getAdminToken()
  if (!zalogowany) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  // `dni=0` to cała historia — świadomy wybór w panelu, nie brak parametru.
  const zadane = new URL(request.url).searchParams.get("dni")
  const dni = zadane === null || zadane === "" ? 30 : Math.max(0, Number(zadane) || 0)

  const [wyszukiwania, aktywne, wejscia, konfigi] = await Promise.all([
    szukania(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    koszyki().catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    odslony(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    konfiguratory(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
  ])

  return NextResponse.json({
    szukania: wyszukiwania,
    koszyki: aktywne,
    odslony: wejscia,
    konfiguratory: konfigi,
  })
}
