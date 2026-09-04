"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { canReadInBrowser, readSpreadsheetInBrowser } from "@/lib/xlsx-browser"
import { pobierzZPonowieniem } from "@/lib/admin-fetch"
import { CODES } from "@/lib/availability"
import { dzien, kiedyZmieniona } from "@/lib/cena-detaliczna"
import {
  ZAOKRAGLENIA,
  cenaZRegul,
  type PriceRule,
  type ReguleKanalu,
} from "@/lib/reguly-cen"

type Wiersz = {
  sku: string
  ean: string
  poCzym: "reczne" | "sku" | "ean" | "ean-allegro" | "sku-luzno" | "ean-luzno" | ""
  produktId: string
  wariantId: string
  tytul: string
  handle: string
  status: string
  kategoria: string
  kategorieUchwyty: string[]
  cenaSklep: number | null
  sztuki: number | null
  cenaDetaliczna: number | null
  przekreslona: boolean
  cenaZmieniona: string
  detalicznaZmieniona: string
  najnizsza30: number | null
  ofertaId: string
  /** EAN wpisany przy ofercie na Allegro — podpowiedź, gdy u nas go brakuje. */
  eanAllegro: string
  nazwaAllegro: string
  cenaAllegro: number | null
  stanAllegro: number | null
  notatka: string
  /** Waga w kilogramach; `null` = nie znamy jej z żadnego źródła. */
  waga: number | null
  bezAllegro: boolean
  /** Szkic przygotowany do wystawienia — w odróżnieniu od wycofanego ze sprzedaży. */
  przygotowany: boolean
  dostepnosc: string
  /** Para przypięta ręcznie, ale oferty nie ma już wśród pobranych z Allegro. */
  paraZnikla: boolean
}

type OfertaBezProduktu = {
  id: string
  nazwa: string
  sygnatura: string
  cena: number
  stan: number
  /** Najbliższy niesparowany produkt po nazwie — do jednego kliknięcia. */
  podpowiedz: { wariantId: string; tytul: string; sku: string; pewnosc: number } | null
}

/**
 * Nagłówek kolumny, po którym da się posortować.
 *
 * Strzałka pokazuje kierunek tylko przy aktywnej kolumnie — trzy strzałki
 * naraz nie mówiłyby, która rządzi. Kliknięcie w aktywną odwraca kierunek,
 * w inną — zaczyna od jej naturalnego: nazwy od A, liczby od największych,
 * bo o to zwykle chodzi przy pytaniu „co jest najdroższe".
 */
function Naglowek({
  pole,
  sortuj,
  ustaw,
  className,
  children,
}: {
  pole: PoleSortowania
  sortuj: { pole: PoleSortowania; malejaco: boolean }
  ustaw: (stan: { pole: PoleSortowania; malejaco: boolean }) => void
  className?: string
  children: React.ReactNode
}) {
  const aktywna = sortuj.pole === pole
  const tekstowa = pole === "tytul" || pole === "kategoria"

  return (
    <th className={`${className || ""} font-semibold`}>
      <button
        type="button"
        onClick={() =>
          ustaw(
            aktywna
              ? { pole, malejaco: !sortuj.malejaco }
              : { pole, malejaco: !tekstowa }
          )
        }
        className={`flex items-center gap-1 uppercase tracking-[0.12em] transition hover:text-[#2E64A8] ${
          aktywna ? "text-[#111827]" : ""
        }`}
        title="Kliknij, żeby posortować"
      >
        {children}
        <span className={aktywna ? "" : "opacity-25"}>
          {aktywna ? (sortuj.malejaco ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  )
}

/** Ta sama lista co w zakładce Produkty — dostępność jest metadaną produktu. */
const DOSTEPNOSCI = [
  { klucz: "", nazwa: "— zgaduje po marce —" },
  { klucz: "od-reki", nazwa: "Od ręki" },
  { klucz: "2-3-dni", nazwa: "2–3 dni" },
  { klucz: "7-10-dni", nazwa: "7–10 dni" },
  { klucz: "14-dni", nazwa: "Do 14 dni" },
  { klucz: "na-zamowienie", nazwa: "Na zamówienie" },
  { klucz: "niedostepny", nazwa: "Chwilowo niedostępny — bez sprzedaży" },
]

/**
 * Skąd wiadomo, że oferta i produkt to jedno.
 *
 * „Luźno" znaczy, że sygnatura zgadza się dopiero po odsianiu spacji,
 * myślników i wielkości liter — sprzedawca wpisał `DF-350ATX` tam, gdzie
 * u nas stoi `DF350ATX`. Piszemy to wprost, bo takie parowanie jest
 * pewne, ale warto je kiedyś wyprostować u źródła.
 */
const PO_CZYM: Record<string, string> = {
  reczne: " · para przypięta",
  ean: " · sparowane po EAN",
  "ean-allegro": " · sparowane po EAN z Allegro",
  "sku-luzno": " · sparowane po SKU (do potwierdzenia)",
  "ean-luzno": " · sparowane po EAN (do potwierdzenia)",
}

/**
 * Pary pewne i pary do potwierdzenia.
 *
 * Dokładne SKU i dokładny EAN to ten sam numer po obu stronach — nie ma tam
 * czego potwierdzać i nie ma po co zawracać tym głowy. Do obejrzenia zostają
 * **tylko luźne**: te, które zgadzają się dopiero po odsianiu spacji
 * i myślników. Przypięcie zamienia jedno w drugie.
 */
function pewnaPara(poCzym: string): boolean {
  return poCzym === "reczne" || poCzym === "sku" || poCzym === "ean" || poCzym === "ean-allegro"
}

function luznaPara(poCzym: string): boolean {
  return poCzym === "sku-luzno" || poCzym === "ean-luzno"
}

/** Po czym wolno sortować listę. */
type PoleSortowania =
  | "tytul"
  | "kategoria"
  | "cenaSklep"
  | "cenaAllegro"
  | "roznica"
  | "cenaDetaliczna"
  | "sztuki"
  | "stanAllegro"
  | "zmieniona"

/** Wpisane wartości trzymamy osobno od danych, żeby pokazać „było → ma być". */
type Wpis = {
  sklep?: string
  allegro?: string
  sztuki?: string
  stanAllegro?: string
  detaliczna?: string
  przekreslona?: boolean
  notatka?: string
  waga?: string
  bezAllegro?: boolean
  sku2?: string
  ean?: string
  dostepnosc?: string
  /** `published` albo `draft` — wycofanie produktu ze sklepu. */
  status?: string
}

/**
 * Uproszczenie tekstu do szukania: bez wielkości liter i bez ogonków, żeby
 * „śruba" znalazła się po wpisaniu „sruba".
 */
function uprosc(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
}

/** Krótki opis reguły do zwiniętego nagłówka: „+9% do pełnych złotych". */
function opisRegulyText(regula: PriceRule): string {
  const czesci = [
    regula.percent ? `${regula.percent > 0 ? "+" : ""}${regula.percent}%` : "",
    regula.amount ? `${regula.amount > 0 ? "+" : ""}${regula.amount} zł` : "",
  ].filter(Boolean)

  const zaokraglenie =
    regula.round === "pelne"
      ? "do pełnych złotych"
      : regula.round === "0.99"
        ? "z końcówką 0,99"
        : ""

  if (!czesci.length) return "cena taka jak w sklepie"
  return [czesci.join(" i "), zaokraglenie].filter(Boolean).join(", ")
}

function zloty(kwota: number | null) {
  if (kwota === null) return "—"
  return kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Liczba z arkusza albo z pola. Excel oddaje „1 790,50" z twardą spacją
 * i przecinkiem — bez tego każda cena z arkusza byłaby nieprawidłowa.
 */
/** Sztuki: liczba całkowita. „3,5 sztuki" nic nie znaczy. */
function calkowita(tekst: string): number | null {
  const n = liczba(tekst)
  return n === null ? null : Math.round(n)
}

function liczba(tekst: string): number | null {
  const czysty = String(tekst)
    .replace(/ |\s/g, "")
    .replace(",", ".")
  if (!czysty) return null
  const n = Number(czysty)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function Ceny() {
  const [wiersze, setWiersze] = useState<Wiersz[]>([])
  const [bezProduktu, setBezProduktu] = useState<OfertaBezProduktu[]>([])
  // Ile ofert zapytaliśmy o EAN i przy ilu go znaleźliśmy — po to, żeby pusta
  // kolumna EAN nie wyglądała tak samo jak nieudane pobieranie.
  const [eanyAllegro, setEanyAllegro] = useState<{
    zapytane: number
    zEanem: number
    wszystkie: number
  } | null>(null)
  const [allegroDziala, setAllegroDziala] = useState(false)
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [szukaj, setSzukaj] = useState("")
  const [filtr, setFiltr] = useState<
    | "wszystkie"
    | "allegro"
    | "bez-allegro"
    | "rozne"
    | "zakaz"
    | "z-notatka"
    | "przygotowane"
    | "szkice"
    | "przypiete"
    | "do-potwierdzenia"
  >("wszystkie")
  const [kategoriaFiltr, setKategoriaFiltr] = useState("")
  // Które wiersze mają rozwinięty drugi rząd. Przy 389 pozycjach cała reszta
  // danych w jednym rzędzie robiła tabelę na 1560 px — na telefonie nie do
  // czytania. Pierwszy rząd to cztery rzeczy, po które sprzedawca tu wchodzi.
  const [rozwiniete, setRozwiniete] = useState<Record<string, boolean>>({})
  /** Komunikat po zmianie hurtem — ile pozycji czeka na zapis. */
  const [hurtStan, setHurtStan] = useState("")
  /**
   * Zaznaczone wiersze. Zmiana hurtem dotyczy **wyłącznie zaznaczonych** —
   * „wszystkie widoczne" brzmi niewinnie, dopóki ktoś nie zapomni, że filtr
   * stoi na „Wszystkie", i nie przestawi dostępności czterystu pozycji.
   * Zaznaczenie jest widoczne, policzalne i trzeba je zrobić ręcznie.
   */
  const [zaznaczone, setZaznaczone] = useState<Record<string, boolean>>({})
  // Sortowanie trzymamy jako parę: po czym i w którą stronę. Kliknięcie
  // w ten sam nagłówek odwraca kierunek, w inny — zaczyna od malejąco przy
  // liczbach i rosnąco przy tekście, bo tego się człowiek spodziewa.
  const [sortuj, setSortuj] = useState<{ pole: PoleSortowania; malejaco: boolean }>({
    pole: "tytul",
    malejaco: false,
  })
  const [wpisy, setWpisy] = useState<Record<string, Wpis>>({})
  // Co się właśnie zapisuje: "" nic, "*" cała paczka, inaczej id wariantu —
  // przy zapisie jednego wiersza kręci się tylko ten wiersz.
  const [zapisuje, setZapisuje] = useState("")
  const [wynik, setWynik] = useState<{
    sklep: number
    allegro: number
    sztuki: number
    stany: number
    detaliczne: number
    publikacje: number
    bledy: { co: string; tytul: string; blad: string }[]
  } | null>(null)
  const [zImportu, setZImportu] = useState(0)
  const [postep, setPostep] = useState<{ procent: number; opis: string }>({
    procent: 0,
    opis: "",
  })
  const [laczy, setLaczy] = useState("")
  /**
   * Czego sprzedawca szuka przy danej ofercie z listy „Na Allegro, ale nie
   * u nas". Klucz to identyfikator oferty — każdy wiersz szuka po swojemu.
   *
   * Rozwijana lista miała pod sobą wszystkie niesparowane produkty (przy
   * czterystu pozycjach to kilkaset wierszy), a przewijanie jej w poszukiwaniu
   * jednej anody to nie jest praca dla człowieka.
   */
  const [szukanyProdukt, setSzukanyProdukt] = useState<Record<string, string>>({})
  // Wiersze odpięte w tej sesji: parowanie policzy się dopiero przy
  // najbliższym pobraniu, więc zamiast zgadywać wynik piszemy to wprost.
  const [odpiete, setOdpiete] = useState<Set<string>>(new Set())
  const [reguly, setReguly] = useState<ReguleKanalu | null>(null)
  const [regulyOtwarte, setRegulyOtwarte] = useState(false)
  const [regulyStan, setRegulyStan] = useState("")
  const plik = useRef<HTMLInputElement>(null)
  // Poprzednie pobranie przerywamy przy każdym następnym: bez tego odświeżenie
  // zostawiało wiszący strumień, a przeglądarka pisała po dwóch stanach naraz.
  const trwajace = useRef<AbortController | null>(null)

  const pobierz = useCallback(async (odswiez = false) => {
    trwajace.current?.abort()
    const przerwij = new AbortController()
    trwajace.current = przerwij

    setStan("laduje")
    setBlad("")
    setPostep({ procent: 0, opis: "Łączę się z serwerem…" })

    const skonczone = (dane: any) => {
      if (!dane?.dostepne) {
        setStan("blad")
        setBlad(
          dane?.powod === "brak_klucza_medusy"
            ? "Brak klucza do Medusy. Dopisz MEDUSA_ADMIN_TOKEN do .env.local na serwerze."
            : dane?.blad || "Medusa nie odpowiada."
        )
        return
      }

      setWiersze(dane.wiersze || [])
      setBezProduktu(dane.ofertyBezProduktu || [])
      setEanyAllegro(dane.eanyAllegro || null)
      setAllegroDziala(Boolean(dane.allegroDziala))
      setPostep({ procent: 100, opis: "" })
      setStan("gotowe")
    }

    try {
      // Zestawienie to kilkanaście sekund pracy serwera, więc odpowiedź leci
      // strumieniem: kolejne linijki niosą postęp, ostatnia komplet danych.
      // Wdrożenie zatrzymuje usługę na kilkanaście sekund i nginx oddaje wtedy
      // surowe „502 Bad Gateway". To nie awaria, tylko okno przerwy — zamiast
      // pokazywać błąd, przeczekujemy je i próbujemy jeszcze raz. Wolno tak
      // robić, bo to jest odczyt: nic nie zapisuje.
      const odpowiedz = await pobierzZPonowieniem(
        `/api/admin/ceny?strumien=1${odswiez ? "&odswiez=1" : ""}`,
        { signal: przerwij.signal }
      )

      if (odpowiedz.status === 502 || odpowiedz.status === 503 || odpowiedz.status === 504) {
        setStan("blad")
        setBlad(
          "Serwer wciąż się restartuje — zwykle wchodzi nowa wersja strony. " +
            "Spróbuj za chwilę."
        )
        return
      }

      if (!odpowiedz.body) {
        // Przeglądarka bez strumieni albo pośrednik, który go zwinął —
        // pytamy po staremu, bez paska. Lepiej bez paska niż wcale.
        const zapasowo = await pobierzZPonowieniem(
          `/api/admin/ceny${odswiez ? "?odswiez=1" : ""}`,
          { signal: przerwij.signal }
        )
        skonczone(await zapasowo.json())
        return
      }

      const czytnik = odpowiedz.body.getReader()
      const dekoder = new TextDecoder()
      let reszta = ""
      let ostatnia: any = null

      for (;;) {
        const { value, done } = await czytnik.read()
        if (done) break

        reszta += dekoder.decode(value, { stream: true })

        // Linijka bywa przecięta między porcjami — ostatni, niedokończony
        // kawałek zostawiamy na następny obrót.
        const linie = reszta.split("\n")
        reszta = linie.pop() || ""

        for (const linia of linie) {
          if (!linia.trim()) continue
          try {
            const wiadomosc = JSON.parse(linia)
            if (wiadomosc.co === "postep") {
              setPostep({ procent: wiadomosc.procent, opis: wiadomosc.opis })
            } else if (wiadomosc.co === "koniec") {
              ostatnia = wiadomosc
            }
          } catch {
            // Uszkodzona linijka nie może przewrócić całego wczytywania.
          }
        }
      }

      if (!ostatnia) {
        setStan("blad")
        setBlad("Połączenie urwało się w trakcie pobierania. Spróbuj jeszcze raz.")
        return
      }

      skonczone(ostatnia)
    } catch (problem: any) {
      // Przerwane własną ręką (odświeżenie, wyjście ze strony) to nie awaria —
      // nowe pobranie już leci i to ono ustawi stan.
      if (problem?.name === "AbortError") return

      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

  // Wyjście ze strony w trakcie pobierania przerywa strumień, zamiast zostawiać
  // go otwartym aż do końca pracy serwera.
  useEffect(() => () => trwajace.current?.abort(), [])

  useEffect(() => {
    pobierz()
  }, [pobierz])

  // Komunikat o zmianie hurtem mówi o konkretnym zestawie wierszy, więc przy
  // zmianie filtra albo wyszukiwania przestaje być prawdziwy — a zdanie
  // „Ustawiłem 19 pozycji" nad inną listą czyta się jak informacja o niej.
  useEffect(() => {
    setHurtStan("")
  }, [filtr, szukaj, kategoriaFiltr])

  // Reguły idą osobnym, krótkim zapytaniem — nie ma powodu, żeby czekały
  // na zestawienie cen, które trwa kilkanaście sekund.
  useEffect(() => {
    fetch("/api/admin/reguly")
      .then((odpowiedz) => odpowiedz.json())
      .then((dane) => setReguly(dane?.reguly?.allegro || null))
      .catch(() => setReguly(null))
  }, [])

  function ustaw(wariantId: string, gdzie: keyof Wpis, wartosc: string) {
    setWpisy((teraz) => ({ ...teraz, [wariantId]: { ...teraz[wariantId], [gdzie]: wartosc } }))
    setWynik(null)
  }

  /** Znaczniki (tak/nie) — osobno od pól tekstowych, bo `Wpis` je rozróżnia. */
  function ustawZnacznik(wariantId: string, gdzie: "przekreslona" | "bezAllegro", wartosc: boolean) {
    setWpisy((teraz) => {
      const wpis = { ...teraz[wariantId], [gdzie]: wartosc }

      // Zakaz zamyka pola Allegro, więc czekająca w nich zmiana nie miałaby
      // gdzie się pokazać — a pasek na dole dalej by o niej mówił i przy
      // zapisie poszłaby na aukcję, której świadomie nie prowadzimy.
      if (gdzie === "bezAllegro" && wartosc) {
        delete wpis.allegro
        delete wpis.stanAllegro
      }

      return { ...teraz, [wariantId]: wpis }
    })
    setWynik(null)
  }

  function przelacz(wariantId: string, wartosc: boolean) {
    setWpisy((teraz) => ({
      ...teraz,
      [wariantId]: { ...teraz[wariantId], przekreslona: wartosc },
    }))
    setWynik(null)
  }

  /** Zmiana liczy się tylko wtedy, gdy różni się od tego, co jest w bazie. */
  const doZapisu = useMemo(() => {
    const lista: {
      wiersz: Wiersz
      sklep?: number
      allegro?: number
      sztuki?: number
      stanAllegro?: number
      detaliczna?: number
      przekreslona?: boolean
      notatka?: string
      waga?: number | ""
      bezAllegro?: boolean
      sku2?: string
      ean?: string
      dostepnosc?: string
      status?: string
    }[] = []

    for (const wiersz of wiersze) {
      const wpis = wpisy[wiersz.wariantId]
      if (!wpis) continue

      const sklep = wpis.sklep !== undefined ? liczba(wpis.sklep) : null
      const allegro = wpis.allegro !== undefined ? liczba(wpis.allegro) : null
      const sztuki = wpis.sztuki !== undefined ? calkowita(wpis.sztuki) : null
      const stan = wpis.stanAllegro !== undefined ? calkowita(wpis.stanAllegro) : null
      const detaliczna = wpis.detaliczna !== undefined ? liczba(wpis.detaliczna) : null

      const zmianaSklep = sklep !== null && sklep !== wiersz.cenaSklep ? sklep : undefined
      // Zakaz jest ostatnią zaporą także tutaj: pola są zamknięte, ale wartość
      // mogła zostać z arkusza albo z „wypełnij z reguł" sprzed zaznaczenia.
      const zakaz = wpis.bezAllegro ?? wiersz.bezAllegro

      const zmianaAllegro =
        allegro !== null && wiersz.ofertaId && !zakaz && allegro !== wiersz.cenaAllegro
          ? allegro
          : undefined
      const zmianaSztuk = sztuki !== null && sztuki !== wiersz.sztuki ? sztuki : undefined
      const zmianaStanu =
        stan !== null && wiersz.ofertaId && !zakaz && stan !== wiersz.stanAllegro
          ? stan
          : undefined
      const zmianaDetalicznej =
        detaliczna !== null && detaliczna !== wiersz.cenaDetaliczna ? detaliczna : undefined
      const zmianaPrzekreslenia =
        wpis.przekreslona !== undefined && wpis.przekreslona !== wiersz.przekreslona
          ? wpis.przekreslona
          : undefined
      // Pusta notatka jest znaczącą wartością (skasowanie), więc porównujemy
      // z tym, co jest, a nie sprawdzamy prawdziwości.
      const zmianaNotatki =
        wpis.notatka !== undefined && wpis.notatka !== (wiersz.notatka || "")
          ? wpis.notatka
          : undefined
      const zmianaZakazu =
        wpis.bezAllegro !== undefined && wpis.bezAllegro !== wiersz.bezAllegro
          ? wpis.bezAllegro
          : undefined
      // Waga: puste pole znaczy „nie wiemy" i jest znaczącą wartością — feed
      // wtedy o niej milczy. Dlatego porównujemy z tym, co jest.
      const wagaTeraz = wiersz.waga === null ? "" : String(wiersz.waga)
      const zmianaWagi =
        wpis.waga !== undefined && wpis.waga.trim() !== wagaTeraz
          ? wpis.waga.trim() === ""
            ? ("" as const)
            : liczba(wpis.waga) ?? undefined
          : undefined
      // SKU, EAN i dostępność: puste pole jest znaczącą wartością (skasowanie),
      // więc porównujemy z tym, co jest, zamiast sprawdzać prawdziwość.
      const zmianaSku =
        wpis.sku2 !== undefined && wpis.sku2.trim() !== wiersz.sku ? wpis.sku2.trim() : undefined
      const zmianaEan =
        wpis.ean !== undefined && wpis.ean.trim() !== wiersz.ean ? wpis.ean.trim() : undefined
      const zmianaDostepnosci =
        wpis.dostepnosc !== undefined && wpis.dostepnosc !== wiersz.dostepnosc
          ? wpis.dostepnosc
          : undefined
      const zmianaStatusu =
        wpis.status !== undefined && wpis.status !== wiersz.status ? wpis.status : undefined

      if (
        zmianaSklep !== undefined ||
        zmianaAllegro !== undefined ||
        zmianaSztuk !== undefined ||
        zmianaStanu !== undefined ||
        zmianaDetalicznej !== undefined ||
        zmianaPrzekreslenia !== undefined ||
        zmianaNotatki !== undefined ||
        zmianaWagi !== undefined ||
        zmianaZakazu !== undefined ||
        zmianaSku !== undefined ||
        zmianaEan !== undefined ||
        zmianaDostepnosci !== undefined ||
        zmianaStatusu !== undefined
      ) {
        lista.push({
          wiersz,
          sklep: zmianaSklep,
          allegro: zmianaAllegro,
          sztuki: zmianaSztuk,
          stanAllegro: zmianaStanu,
          detaliczna: zmianaDetalicznej,
          przekreslona: zmianaPrzekreslenia,
          notatka: zmianaNotatki,
          waga: zmianaWagi,
          bezAllegro: zmianaZakazu,
          sku2: zmianaSku,
          ean: zmianaEan,
          dostepnosc: zmianaDostepnosci,
          status: zmianaStatusu,
        })
      }
    }

    return lista
  }, [wiersze, wpisy])

  async function wgrajArkusz(pliki: FileList | null) {
    const wybrany = pliki?.[0]
    if (!wybrany) return

    setWynik(null)

    if (!canReadInBrowser()) {
      setBlad("Ta przeglądarka nie umie rozpakować arkusza. Użyj Chrome albo Edge.")
      return
    }

    try {
      const arkusze = await readSpreadsheetInBrowser(wybrany)
      const rzedy = arkusze[0]?.rows || []
      if (rzedy.length < 2) {
        setBlad("Arkusz jest pusty.")
        return
      }

      // Kolumny szukamy po nagłówku, nie po pozycji: sprzedawca może dostawić
      // własną kolumnę z notatką albo poprzestawiać istniejące.
      const naglowki = rzedy[0].map((n) => n.toLowerCase().trim())
      const kolumna = (fragment: string) => naglowki.findIndex((n) => n.includes(fragment))

      const kSku = kolumna("sku")
      const kEan = kolumna("ean")
      const kSklep = naglowki.findIndex((n) => n.includes("cena sklep"))
      const kAllegro = naglowki.findIndex((n) => n.includes("cena allegro"))
      // „Stan sklep" od listopada, „Sztuki sklep" w arkuszach pobranych wcześniej —
      // sprzedawca może mieć u siebie jedne i drugie.
      const kSztuki = naglowki.findIndex((n) => n.includes("stan sklep") || n.includes("sztuki"))
      const kStanAllegro = naglowki.findIndex((n) => n.includes("stan allegro"))
      const kDetaliczna = naglowki.findIndex((n) => n.includes("detaliczna"))
      const kPrzekreslona = naglowki.findIndex((n) => n.includes("przekre"))
      const kNotatka = naglowki.findIndex((n) => n.includes("notatka"))
      const kBezAllegro = naglowki.findIndex((n) => n.includes("bez allegro"))
      const kWaga = naglowki.findIndex((n) => n.includes("waga"))
      const kDostepnosc = naglowki.findIndex((n) => n.includes("dost"))
      const kPublikacja = naglowki.findIndex((n) => n.includes("publikacja"))

      if (kSku < 0 && kEan < 0) {
        setBlad('W arkuszu nie ma kolumny „SKU" ani „EAN" — po nich dopasowuję wiersze do produktów.')
        return
      }

      const poSku = new Map(wiersze.filter((w) => w.sku).map((w) => [w.sku, w]))
      const poEan = new Map(wiersze.filter((w) => w.ean).map((w) => [w.ean, w]))
      const nowe: Record<string, Wpis> = {}
      let dopasowane = 0
      const nieznane: string[] = []

      for (const rzad of rzedy.slice(1)) {
        const sku = String(rzad[kSku] || "").trim()
        const ean = kEan >= 0 ? String(rzad[kEan] || "").trim() : ""
        if (!sku && !ean) continue

        // Najpierw SKU, potem EAN — tak samo jak przy parowaniu z Allegro.
        const wiersz = (sku && poSku.get(sku)) || (ean && poEan.get(ean)) || undefined
        if (!wiersz) {
          nieznane.push(sku || ean)
          continue
        }

        const wpis: Wpis = {}
        if (kSklep >= 0 && String(rzad[kSklep] || "").trim()) wpis.sklep = String(rzad[kSklep])
        if (kAllegro >= 0 && String(rzad[kAllegro] || "").trim()) wpis.allegro = String(rzad[kAllegro])
        // Zero jest tu poprawną wartością („wyprzedane"), więc sprawdzamy pustkę,
        // a nie prawdziwość — `String(0)` to „0", które `trim()` zostawia.
        if (kSztuki >= 0 && String(rzad[kSztuki] ?? "").trim()) wpis.sztuki = String(rzad[kSztuki])
        if (kStanAllegro >= 0 && String(rzad[kStanAllegro] ?? "").trim()) {
          wpis.stanAllegro = String(rzad[kStanAllegro])
        }
        if (kDetaliczna >= 0 && String(rzad[kDetaliczna] ?? "").trim()) {
          wpis.detaliczna = String(rzad[kDetaliczna])
        }
        if (kPrzekreslona >= 0) {
          // „tak" / „nie" — bo tak to wyeksportowaliśmy. Puste pole zostawia
          // przełącznik w spokoju, zamiast go po cichu wyłączać.
          const slowo = String(rzad[kPrzekreslona] ?? "").trim().toLowerCase()
          if (slowo === "tak") wpis.przekreslona = true
          else if (slowo === "nie") wpis.przekreslona = false
        }
        // Notatkę wolno **wyczyścić** arkuszem, więc puste pole jest tu
        // znaczącą wartością — inaczej raz wpisanej notatki nie dałoby się
        // usunąć inaczej niż w panelu, po jednej sztuce.
        if (kNotatka >= 0 && String(rzad[kNotatka] ?? "") !== String(wiersz.notatka || "")) {
          wpis.notatka = String(rzad[kNotatka] ?? "")
        }
        // Wagę wolno **wyczyścić** arkuszem, tak samo jak notatkę: puste pole
        // znaczy „nie wiemy" i wtedy feed nic o niej nie mówi. Porównujemy
        // z tym, co już mamy, żeby nie zaznaczać do zapisu wierszy bez zmiany.
        if (kWaga >= 0) {
          const wpisana = String(rzad[kWaga] ?? "").trim().replace(",", ".")
          const obecna = wiersz.waga === null ? "" : String(wiersz.waga)
          if (wpisana !== obecna) wpis.waga = wpisana
        }
        if (kBezAllegro >= 0) {
          const slowo = String(rzad[kBezAllegro] ?? "").trim().toLowerCase()
          if (slowo === "tak") wpis.bezAllegro = true
          else if (slowo === "nie") wpis.bezAllegro = false
        }
        // Dostępność wchodzi kodem. Puste pole jest znaczącą wartością
        // („zgaduje po marce"), ale literówki nie przepuszczamy dalej —
        // wpisana w metadane i tak skończyłaby jako zgadywanie po marce,
        // tyle że po cichu i bez śladu, skąd się wzięła.
        if (kDostepnosc >= 0) {
          const kod = String(rzad[kDostepnosc] ?? "").trim().toLowerCase()
          if (
            (!kod || (CODES as string[]).includes(kod)) &&
            kod !== String(wiersz.dostepnosc || "")
          ) {
            wpis.dostepnosc = kod
          }
        }

        // Publikacja wchodzi tylko z rozpoznanego słowa („opublikowany" albo
        // „szkic" — tak to eksportujemy). Puste pole i wszystko inne zostawia
        // stan w spokoju: wycofanie całego katalogu przez literówkę albo
        // przez kolumnę, której ktoś nie wypełnił, byłoby najdroższą pomyłką
        // w tym arkuszu.
        if (kPublikacja >= 0) {
          const slowo = String(rzad[kPublikacja] ?? "").trim().toLowerCase()
          const stan = slowo === "opublikowany" ? "published" : slowo === "szkic" ? "draft" : ""
          if (stan && stan !== wiersz.status) wpis.status = stan
        }

        if (Object.keys(wpis).length) {
          nowe[wiersz.wariantId] = wpis
          dopasowane += 1
        }
      }

      // Wgrany arkusz **wypełnia pola do zatwierdzenia**, nie zapisuje. Ten sam
      // pasek na dole pokazuje, co się zmieni — jedna droga zapisu, nie dwie.
      setWpisy(nowe)
      setZImportu(dopasowane)
      setBlad(
        nieznane.length
          ? `Nie znalazłem ${nieznane.length} SKU ze skoroszytu: ${nieznane.slice(0, 5).join(", ")}${
              nieznane.length > 5 ? "…" : ""
            }`
          : ""
      )
    } catch (problem: any) {
      setBlad(`Nie udało się odczytać arkusza: ${problem?.message || "nieznany błąd"}`)
    } finally {
      if (plik.current) plik.current.value = ""
    }
  }

  /**
   * Zapis zmian. Bez argumentu idzie cała paczka, z `tylkoWariant` — jeden
   * wiersz. Zapis pojedynczego wiersza jest po to, żeby poprawka jednej ceny
   * na górze listy nie kazała zjeżdżać przez czterysta pozycji do paska na
   * dole; nie odświeżamy po nim całego zestawienia (to siedem żądań po sieci),
   * tylko podmieniamy ten jeden wiersz zapisanymi wartościami.
   */
  async function zapisz(tylkoWariant?: string) {
    const paczka = tylkoWariant
      ? doZapisu.filter((z) => z.wiersz.wariantId === tylkoWariant)
      : doZapisu
    if (!paczka.length) return

    setZapisuje(tylkoWariant || "*")
    setWynik(null)

    try {
      const odpowiedz = await fetch("/api/admin/ceny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zmiany: paczka.map(({
            wiersz,
            sklep,
            allegro,
            sztuki,
            stanAllegro,
            detaliczna,
            przekreslona,
            notatka,
            waga,
            bezAllegro,
            sku2,
            ean,
            dostepnosc,
            status,
          }) => ({
            sku: wiersz.sku,
            tytul: wiersz.tytul,
            handle: wiersz.handle,
            produktId: wiersz.produktId,
            wariantId: wiersz.wariantId,
            ofertaId: wiersz.ofertaId,
            ...(sklep !== undefined ? { cenaSklep: sklep } : {}),
            ...(allegro !== undefined ? { cenaAllegro: allegro } : {}),
            ...(sztuki !== undefined ? { sztuki } : {}),
            ...(stanAllegro !== undefined ? { stanAllegro } : {}),
            ...(detaliczna !== undefined ? { cenaDetaliczna: detaliczna } : {}),
            ...(przekreslona !== undefined ? { przekreslona } : {}),
            ...(notatka !== undefined ? { notatka } : {}),
            ...(waga !== undefined ? { waga } : {}),
            ...(bezAllegro !== undefined ? { bezAllegro } : {}),
            ...(sku2 !== undefined ? { sku2 } : {}),
            ...(ean !== undefined ? { ean } : {}),
            ...(dostepnosc !== undefined ? { dostepnosc } : {}),
            ...(status !== undefined ? { status } : {}),
          })),
        }),
      })

      const dane = await odpowiedz.json()

      if (!dane.ok) {
        setWynik({
          sklep: 0,
          allegro: 0,
          sztuki: 0,
          stany: 0,
          detaliczne: 0,
          publikacje: 0,
          bledy: [{ co: "", tytul: "", blad: dane.blad || "Nie udało się." }],
        })
        return
      }

      setWynik({
        sklep: dane.zapisane.sklep,
        allegro: dane.zapisane.allegro,
        sztuki: dane.zapisane.sztuki || 0,
        stany: dane.zapisane.stany || 0,
        detaliczne: dane.zapisane.detaliczne || 0,
        publikacje: dane.zapisane.publikacje || 0,
        bledy: dane.bledy || [],
      })
      // Zapis jednego wiersza nie odświeża całego zestawienia — podmieniamy
      // ten jeden wiersz zapisanymi wartościami. Gdy coś w nim nie przeszło,
      // zostawiamy wpisy do poprawy, żeby nie zniknęły razem z błędem.
      if (tylkoWariant) {
        const zle = new Set(
          ((dane.bledy || []) as { tytul: string }[]).map((b) => b.tytul)
        )
        if (!zle.has(paczka[0].wiersz.tytul)) {
          setWiersze((teraz) =>
            teraz.map((w) => (w.wariantId === tylkoWariant ? zastosuj(w, paczka[0]) : w))
          )
          setWpisy((teraz) => {
            const reszta = { ...teraz }
            delete reszta[tylkoWariant]
            return reszta
          })
        }
        return
      }

      setWpisy({})
      setZImportu(0)
      // Po zapisie hurtem zaznaczenie przestaje mieć sens: te pozycje właśnie
      // przestały być tym, czym były (opublikowane wychodzą z „Przygotowanych"),
      // a niewidoczne zaznaczenie to pułapka przy następnej zmianie.
      setZaznaczone({})
      setHurtStan("")
      await pobierz(true)
    } catch {
      setWynik({
        sklep: 0,
        allegro: 0,
        sztuki: 0,
        stany: 0,
        detaliczne: 0,
        publikacje: 0,
        bledy: [{ co: "", tytul: "", blad: "Brak połączenia." }],
      })
    } finally {
      setZapisuje("")
    }
  }

  /**
   * Wiersz po udanym zapisie jednej pozycji. `najnizsza30` zostaje stara —
   * liczy ją serwer z historii cen i dojdzie do siebie przy najbliższym
   * pełnym pobraniu; zmyślanie jej tutaj mówiłoby klientowi nieprawdę.
   */
  function zastosuj(w: Wiersz, z: (typeof doZapisu)[number]): Wiersz {
    const teraz = new Date().toISOString()
    return {
      ...w,
      cenaSklep: z.sklep !== undefined ? z.sklep : w.cenaSklep,
      cenaZmieniona: z.sklep !== undefined ? teraz : w.cenaZmieniona,
      cenaAllegro: z.allegro !== undefined ? z.allegro : w.cenaAllegro,
      sztuki: z.sztuki !== undefined ? z.sztuki : w.sztuki,
      stanAllegro: z.stanAllegro !== undefined ? z.stanAllegro : w.stanAllegro,
      cenaDetaliczna: z.detaliczna !== undefined ? z.detaliczna : w.cenaDetaliczna,
      detalicznaZmieniona: z.detaliczna !== undefined ? teraz : w.detalicznaZmieniona,
      przekreslona: z.przekreslona !== undefined ? z.przekreslona : w.przekreslona,
      notatka: z.notatka !== undefined ? z.notatka : w.notatka,
      waga: z.waga !== undefined ? (z.waga === "" ? null : z.waga) : w.waga,
      bezAllegro: z.bezAllegro !== undefined ? z.bezAllegro : w.bezAllegro,
      sku: z.sku2 !== undefined ? z.sku2 : w.sku,
      ean: z.ean !== undefined ? z.ean : w.ean,
      dostepnosc: z.dostepnosc !== undefined ? z.dostepnosc : w.dostepnosc,
      status: z.status !== undefined ? z.status : w.status,
    }
  }

  /** Odrzucenie zmian w jednym wierszu — bez ruszania pozostałych. */
  function odrzuc(wariantId: string) {
    setWpisy((teraz) => {
      const reszta = { ...teraz }
      delete reszta[wariantId]
      return reszta
    })
    setWynik(null)
  }

  const widoczne = useMemo(() => {
    const fraza = szukaj.toLowerCase().trim()

    const przefiltrowane = wiersze.filter((w) => {
      // Notatka wchodzi do wyszukiwania: jak ktoś zapisał „czekamy na dostawę",
      // to chce potem po tym znaleźć wszystkie takie pozycje.
      if (fraza && !`${w.tytul} ${w.sku} ${w.notatka}`.toLowerCase().includes(fraza)) return false
      if (kategoriaFiltr && w.kategoria !== kategoriaFiltr) return false

      if (filtr === "allegro") return Boolean(w.ofertaId)
      // „Poza Allegro" pokazuje to, czego jeszcze nie wystawiliśmy — bez pozycji
      // oznaczonych jako te, których wystawić **nie wolno**. Inaczej lista
      // braków do zrobienia mieszałaby się z listą świadomych decyzji.
      if (filtr === "bez-allegro") return !w.ofertaId && !w.bezAllegro
      if (filtr === "zakaz") return w.bezAllegro
      if (filtr === "z-notatka") return Boolean(w.notatka.trim())
      // Szkice są dwojakie i to są dwie różne sprawy: **przygotowane** czekają
      // na publikację (założone importem albo w edytorze i nigdy niewystawione),
      // **wycofane** już jej nie chcą. Jeden filtr na oba nie odpowiadał na
      // żadne z dwóch pytań. Bez tych filtrów poznawało się je tylko po dopisku
      // przy nazwie, czyli
      // przewijając czterysta wierszy.
      if (filtr === "przygotowane") return w.status !== "published" && w.przygotowany
      if (filtr === "szkice") return w.status !== "published" && !w.przygotowany
      // Przypięte i te, przy których przypięta aukcja zniknęła — jedno i drugie
      // jest decyzją człowieka, więc przeglądać się je powinno razem.
      if (filtr === "przypiete") return w.poCzym === "reczne" || w.paraZnikla
      // Tylko pary luźne: przy dokładnym SKU i EAN-ie nie ma czego potwierdzać.
      if (filtr === "do-potwierdzenia") return luznaPara(w.poCzym)
      if (filtr === "rozne") {
        return Boolean(w.ofertaId) && w.cenaSklep !== null && w.cenaAllegro !== w.cenaSklep
      }
      return true
    })

    const znak = sortuj.malejaco ? -1 : 1
    // Puste wartości zawsze na koniec, niezależnie od kierunku: produkt bez
    // ceny na górze listy posortowanej po cenie to nie jest odpowiedź na
    // pytanie „co jest najdroższe".
    const liczbowo = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return (a - b) * znak
    }

    return [...przefiltrowane].sort((a, b) => {
      switch (sortuj.pole) {
        case "cenaSklep":
          return liczbowo(a.cenaSklep, b.cenaSklep)
        case "cenaAllegro":
          return liczbowo(a.cenaAllegro, b.cenaAllegro)
        case "roznica": {
          const rA = a.cenaSklep !== null && a.cenaAllegro !== null ? a.cenaAllegro - a.cenaSklep : null
          const rB = b.cenaSklep !== null && b.cenaAllegro !== null ? b.cenaAllegro - b.cenaSklep : null
          return liczbowo(rA, rB)
        }
        case "cenaDetaliczna":
          return liczbowo(a.cenaDetaliczna, b.cenaDetaliczna)
        case "sztuki":
          return liczbowo(a.sztuki, b.sztuki)
        case "stanAllegro":
          return liczbowo(a.stanAllegro, b.stanAllegro)
        case "kategoria":
          return a.kategoria.localeCompare(b.kategoria, "pl") * znak
        case "zmieniona":
          // Brak daty to „nigdy nie ruszana" — na koniec, jak puste liczby.
          if (!a.cenaZmieniona && !b.cenaZmieniona) return 0
          if (!a.cenaZmieniona) return 1
          if (!b.cenaZmieniona) return -1
          return a.cenaZmieniona.localeCompare(b.cenaZmieniona) * znak
        default:
          return a.tytul.localeCompare(b.tytul, "pl") * znak
      }
    })
  }, [wiersze, szukaj, filtr, kategoriaFiltr, sortuj])

  /**
   * Zaznaczone spośród **widocznych**. Zawężenie filtra nie kasuje zaznaczenia
   * (można je robić w kilku podejściach), ale zmiana hurtem nie ruszy wiersza,
   * którego w tej chwili nie widać — inaczej dałoby się przestawić coś, czego
   * się nie ogląda.
   */
  const wybrane = useMemo(
    () => widoczne.filter((w) => zaznaczone[w.wariantId]),
    [widoczne, zaznaczone]
  )

  const wszystkieZaznaczone = widoczne.length > 0 && wybrane.length === widoczne.length

  function przelaczZaznaczenie(wariantId: string) {
    setZaznaczone((teraz) => {
      const nowe = { ...teraz }
      if (nowe[wariantId]) delete nowe[wariantId]
      else nowe[wariantId] = true
      return nowe
    })
    setHurtStan("")
  }

  /** Nagłówkowy kwadracik: zaznacza albo odznacza wszystko, co widać. */
  function przelaczWszystkie() {
    setZaznaczone((teraz) => {
      const nowe = { ...teraz }
      for (const w of widoczne) {
        if (wszystkieZaznaczone) delete nowe[w.wariantId]
        else nowe[w.wariantId] = true
      }
      return nowe
    })
    setHurtStan("")
  }

  const naAllegro = wiersze.filter((w) => w.ofertaId).length
  const rozne = wiersze.filter(
    (w) => w.ofertaId && w.cenaSklep !== null && w.cenaAllegro !== w.cenaSklep
  ).length
  // „Do wystawienia" to braki, które da się nadrobić — bez tych, których
  // wystawiać nie wolno. Wcześniej jedno i drugie leżało w jednym worku.
  const doWystawienia = wiersze.filter((w) => !w.ofertaId && !w.bezAllegro).length
  const zZakazem = wiersze.filter((w) => w.bezAllegro).length
  const zNotatka = wiersze.filter((w) => w.notatka.trim()).length
  const przygotowane = wiersze.filter((w) => w.status !== "published" && w.przygotowany).length
  const wycofane = wiersze.filter((w) => w.status !== "published" && !w.przygotowany).length
  const przypiete = wiersze.filter((w) => w.poCzym === "reczne" || w.paraZnikla).length
  const doPotwierdzenia = wiersze.filter((w) => luznaPara(w.poCzym)).length

  const nazwyKategorii = useMemo(
    () =>
      [...new Set(wiersze.map((w) => w.kategoria).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pl")
      ),
    [wiersze]
  )

  // Szerokość i wyrównanie trzymamy **osobno od reszty klas**: doklejenie
  // `w-full` do gotowego `w-24` nic nie daje, bo o tym, która klasa wygrywa,
  // decyduje kolejność w arkuszu Tailwinda, a nie w atrybucie. Pola SKU i EAN
  // zostawały wtedy szerokie na 24 jednostki, a nie na całą komórkę.
  const poleBazowe =
    "rounded-md border border-[#111827]/15 px-2 py-1.5 outline-none focus:border-[#2E64A8]"
  const pole = `w-24 text-right tabular-nums ${poleBazowe}`
  const etykieta = "mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111827]/40"
  const poleReguly =
    "w-24 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"

  /**
   * Łączy ofertę z produktem: wpisuje jego SKU w sygnaturę oferty na Allegro.
   *
   * Tylko produkty **jeszcze niesparowane** — jedna oferta na produkt, inaczej
   * dwie oferty dostałyby tę samą cenę z tego samego wiersza.
   */
  /** Wybór z listy podaje wariant — SKU dobieramy z wiersza. */
  function polaczZWariantem(ofertaId: string, wariantId: string) {
    const wiersz = wiersze.find((w) => w.wariantId === wariantId)
    if (wiersz) polacz(ofertaId, wiersz.sku, wiersz.wariantId)
  }

  async function polacz(ofertaId: string, sygnatura: string, wariantId = "") {
    if (!sygnatura) return
    setLaczy(ofertaId)
    setBlad("")

    const wynikLaczenia = await fetch("/api/admin/ceny", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `wariantId` przypina parę na stałe: wybór z listy to decyzja
      // człowieka, a nie zgadywanie po sygnaturze, więc nie ma powodu
      // liczyć jej jeszcze raz przy następnym wejściu.
      body: JSON.stringify({ co: "polacz", ofertaId, sygnatura, wariantId }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false, blad: "Brak połączenia z serwerem." }))

    setLaczy("")

    if (!wynikLaczenia.ok) {
      setBlad(wynikLaczenia.blad || "Nie udało się połączyć.")
      return
    }

    // Sparowana oferta ma zniknąć z listy „Na Allegro, ale nie u nas"
    // i pojawić się przy produkcie — ale to jest zmiana **jednego wiersza
    // i jednej pozycji listy**, a nie powód do budowania zestawienia od nowa.
    // Pełne pobranie to siedem żądań do Medusy i Allegro plus dopytywanie
    // o EAN-y, czyli kilkanaście sekund czekania po każdym kliknięciu.
    const oferta = bezProduktu.find((pozycja) => pozycja.id === ofertaId)

    setBezProduktu((teraz) =>
      teraz
        .filter((pozycja) => pozycja.id !== ofertaId)
        // Produkt właśnie się sparował, więc nie może dalej stać jako
        // podpowiedź przy innej ofercie — dwie oferty przy jednym produkcie
        // dostałyby cenę z tego samego wiersza.
        .map((pozycja) =>
          wariantId && pozycja.podpowiedz?.wariantId === wariantId
            ? { ...pozycja, podpowiedz: null }
            : pozycja
        )
    )

    if (wariantId) {
      setWiersze((teraz) =>
        teraz.map((w) =>
          w.wariantId === wariantId
            ? {
                ...w,
                ofertaId,
                nazwaAllegro: oferta?.nazwa || w.nazwaAllegro,
                cenaAllegro: oferta ? oferta.cena : w.cenaAllegro,
                stanAllegro: oferta ? oferta.stan : w.stanAllegro,
                // Wybór z listy jest decyzją człowieka, a serwer właśnie
                // przypiął tę parę na stałe.
                poCzym: "reczne",
                paraZnikla: false,
              }
            : w
        )
      )
    }
  }

  /**
   * Przypięcie i odpięcie pary przy wierszu. Przypięta stoi ponad parowaniem
   * po sygnaturze, więc raz sprawdzonego wiersza nie trzeba oglądać po każdym
   * odświeżeniu; odpięcie oddaje go z powrotem automatowi.
   */
  async function ustawPare(wariantId: string, ofertaId: string, przypnij: boolean) {
    setLaczy(wariantId)
    setBlad("")

    const wynikPary = await fetch("/api/admin/ceny", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        co: przypnij ? "przypnij" : "odepnij",
        wariantId,
        ofertaId,
      }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false, blad: "Brak połączenia z serwerem." }))

    setLaczy("")

    if (!wynikPary.ok) {
      setBlad(wynikPary.blad || "Nie udało się zapisać pary.")
      return
    }

    // Przypięcie zmienia **jeden wiersz**, więc pobieranie całego zestawienia
    // od nowa (siedem żądań po sieci i kilkanaście sekund czekania) byłoby
    // pracą dla samej pracy. Podmieniamy ten wiersz u siebie.
    if (przypnij) {
      setWiersze((teraz) =>
        teraz.map((w) => (w.wariantId === wariantId ? { ...w, poCzym: "reczne" } : w))
      )
      setOdpiete((teraz) => {
        const reszta = new Set(teraz)
        reszta.delete(wariantId)
        return reszta
      })
      return
    }

    // Po odpięciu parowanie policzy się od nowa — ale dopiero po stronie
    // serwera, przy najbliższym pobraniu. Zamiast zgadywać wynik, mówimy
    // wprost, że wiersz czeka na przeliczenie.
    setOdpiete((teraz) => new Set(teraz).add(wariantId))
  }

  /** Produkty bez oferty — tylko te da się z czymś sparować. */
  const bezOferty = useMemo(
    () => wiersze.filter((w) => !w.ofertaId && w.sku).sort((a, b) => a.tytul.localeCompare(b.tytul, "pl")),
    [wiersze]
  )

  /** Cena wyliczona z reguł — podpowiedź, nigdy zapis bez kliknięcia. */
  function wgReguly(w: Wiersz): number | null {
    return cenaZRegul(w.cenaSklep, reguly || undefined, w.kategorieUchwyty)
  }

  /** Kategorie, które faktycznie są w katalogu — tylko na nie da się ustawić wyjątek. */
  const kategorie = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const w of wiersze) {
      w.kategorieUchwyty.forEach((uchwyt, numer) => {
        if (!mapa.has(uchwyt)) mapa.set(uchwyt, numer === 0 && w.kategoria ? w.kategoria : uchwyt)
      })
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "pl"))
  }, [wiersze])

  function zmienRegule(gdzie: string, czego: keyof PriceRule, wartosc: string) {
    setReguly((teraz) => {
      const baza: ReguleKanalu = teraz || { domyslna: {}, kategorie: {} }
      const stara = gdzie === "" ? baza.domyslna : baza.kategorie[gdzie] || {}

      const nowa: PriceRule = { ...stara }
      if (czego === "round") {
        if (wartosc) nowa.round = wartosc as PriceRule["round"]
        else delete nowa.round
      } else {
        const liczba = Number(String(wartosc).replace(",", "."))
        if (wartosc.trim() && Number.isFinite(liczba)) nowa[czego] = liczba
        else delete nowa[czego]
      }

      setRegulyStan("")
      return gdzie === ""
        ? { ...baza, domyslna: nowa }
        : { ...baza, kategorie: { ...baza.kategorie, [gdzie]: nowa } }
    })
  }

  async function zapiszReguly() {
    if (!reguly) return
    setRegulyStan("zapisuję…")

    const wynik = await fetch("/api/admin/reguly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reguly: { allegro: reguly } }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false }))

    if (!wynik.ok) {
      setRegulyStan(wynik.blad || "Nie udało się zapisać.")
      return
    }

    setReguly(wynik.reguly?.allegro || reguly)
    setRegulyStan("Zapisane. Reguły działają też przy eksporcie i synchronizacji.")
  }

  /**
   * Wpisuje ceny z reguł do **widocznych** wierszy.
   *
   * Tylko wypełnia pola — zapis idzie tą samą drogą co ręczna edycja, przez
   * pasek na dole. Dwie osobne drogi zapisu to dwa miejsca, w których można
   * się pomylić, a przy dwustu pozycjach naraz nie ma jak tego cofnąć.
   */
  function wypelnijZRegul() {
    setWynik(null)

    const doWpisania: Record<string, string> = {}
    for (const w of widoczne) {
      if (!w.ofertaId) continue
      // Zakaz sprzedaży na Allegro pomijamy tak samo jak przy eksporcie
      // i synchronizacji — oznaczenie ma znaczyć to samo wszędzie.
      if (wpisy[w.wariantId]?.bezAllegro ?? w.bezAllegro) continue
      const cena = wgReguly(w)
      if (cena === null || cena === w.cenaAllegro) continue
      doWpisania[w.wariantId] = cena.toFixed(2)
    }

    const ile = Object.keys(doWpisania).length
    setWpisy((teraz) => {
      const nowe = { ...teraz }
      for (const [wariantId, cena] of Object.entries(doWpisania)) {
        nowe[wariantId] = { ...nowe[wariantId], allegro: cena }
      }
      return nowe
    })

    setRegulyStan(
      ile
        ? `Wypełniłem ${ile} cen — sprawdź i zapisz.`
        : "Wszystkie widoczne ceny już zgadzają się z regułami."
    )
  }

  /**
   * Zmiana hurtem — dostępność albo publikacja **na zaznaczonych wierszach**.
   *
   * Nic tu nie idzie do sklepu od razu. Tak samo jak przy wgranym arkuszu:
   * wypełniamy pola do zatwierdzenia, a zapisuje **ten sam pasek na dole** co
   * przy ręcznej edycji. Dwie osobne drogi zapisu to dwa miejsca, w których
   * można się pomylić — i dwa razy tyle sposobów, żeby przestawić czterysta
   * pozycji jednym nieuważnym kliknięciem.
   */
  function hurtem(gdzie: "dostepnosc" | "status", wartosc: string) {
    setWynik(null)

    const doWpisania: string[] = []
    for (const w of wybrane) {
      const teraz = gdzie === "status" ? w.status : w.dostepnosc
      if ((teraz || "") === wartosc) continue
      doWpisania.push(w.wariantId)
    }

    setWpisy((teraz) => {
      const nowe = { ...teraz }
      for (const wariantId of doWpisania) {
        nowe[wariantId] = { ...nowe[wariantId], [gdzie]: wartosc }
      }
      return nowe
    })

    // Zmiana w schowanej części wiersza musi być widoczna — inaczej pasek na
    // dole mówiłby o zmianie, której nigdzie nie widać.
    setRozwiniete((teraz) => {
      const nowe = { ...teraz }
      for (const wariantId of doWpisania) nowe[wariantId] = true
      return nowe
    })

    setHurtStan(
      doWpisania.length
        ? `Ustawiłem ${doWpisania.length} ${doWpisania.length === 1 ? "pozycję" : "pozycji"} — sprawdź i zapisz na dole.`
        : "Zaznaczone pozycje już to mają."
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={szukaj}
          onChange={(z) => setSzukaj(z.target.value)}
          placeholder="Nazwa albo SKU…"
          className="w-64 rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
        />

        <div className="flex flex-wrap gap-2">
          {[
            { klucz: "wszystkie" as const, nazwa: `Wszystkie (${wiersze.length})` },
            { klucz: "allegro" as const, nazwa: `Na Allegro (${naAllegro})` },
            { klucz: "rozne" as const, nazwa: `Różne ceny (${rozne})` },
            { klucz: "bez-allegro" as const, nazwa: `Do wystawienia (${doWystawienia})` },
            { klucz: "zakaz" as const, nazwa: `Nie na Allegro (${zZakazem})` },
            { klucz: "z-notatka" as const, nazwa: `Z notatką (${zNotatka})` },
            { klucz: "przygotowane" as const, nazwa: `Przygotowane (${przygotowane})` },
            { klucz: "szkice" as const, nazwa: `Wycofane (${wycofane})` },
            { klucz: "przypiete" as const, nazwa: `Przypięte pary (${przypiete})` },
            {
              klucz: "do-potwierdzenia" as const,
              nazwa: `Pary do potwierdzenia (${doPotwierdzenia})`,
            },
          ].map((p) => (
            <button
              key={p.klucz}
              type="button"
              onClick={() => setFiltr(p.klucz)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                filtr === p.klucz ? "bg-[#111827] text-white" : "bg-white text-[#111827]/60 hover:text-[#111827]"
              }`}
            >
              {p.nazwa}
            </button>
          ))}
        </div>

        {/* Kategorie z danych, nie z listy w kodzie: sprzedawca zakłada nowe
            w Medusie i nie ma powodu, żeby czekał na wdrożenie. */}
        {nazwyKategorii.length ? (
          <select
            value={kategoriaFiltr}
            onChange={(z) => setKategoriaFiltr(z.target.value)}
            className="rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
          >
            <option value="">Wszystkie kategorie</option>
            {nazwyKategorii.map((nazwa) => (
              <option key={nazwa} value={nazwa}>
                {nazwa}
              </option>
            ))}
          </select>
        ) : null}

        <div className="ml-auto flex gap-2">
          <a
            href="/api/admin/ceny?format=xlsx"
            className="rounded-md border border-[#111827]/15 px-4 py-2 text-sm font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            Pobierz arkusz
          </a>

          <button
            type="button"
            onClick={() => plik.current?.click()}
            className="rounded-md border border-[#111827]/15 px-4 py-2 text-sm font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            Wgraj arkusz
          </button>
          <input
            ref={plik}
            type="file"
            accept=".xlsx,.csv"
            onChange={(z) => wgrajArkusz(z.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {/*
        Zmiana hurtem — dotyczy **zaznaczonych** wierszy, więc pasek pokazuje się
        dopiero wtedy, gdy coś jest zaznaczone. Zakres z samego filtra brzmiał
        niewinnie, dopóki ktoś nie zapomniał, że stoi na „Wszystkie".

        Nic nie idzie do sklepu od razu: wypełniamy pola, a zapisuje ten sam
        pasek na dole co przy ręcznej edycji. Dwie osobne drogi zapisu to dwa
        miejsca, w których można się pomylić.
      */}
      {stan === "gotowe" && wybrane.length ? (
        <div className="sticky top-2 z-10 mb-5 flex flex-wrap items-center gap-3 rounded-md border border-[#2E64A8]/30 bg-[#2E64A8]/5 p-4">
          <span className="text-sm font-semibold">
            Zaznaczono {wybrane.length}{" "}
            {wybrane.length === 1 ? "pozycję" : "pozycji"}
          </span>

          <label className="flex items-center gap-2 text-sm text-[#111827]/60">
            Dostępność
            <select
              value=""
              onChange={(z) => {
                if (z.target.value) hurtem("dostepnosc", z.target.value)
                z.target.value = ""
              }}
              className="rounded-md border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
            >
              <option value="">— wybierz —</option>
              {DOSTEPNOSCI.filter((d) => d.klucz).map((d) => (
                <option key={d.klucz} value={d.klucz}>
                  {d.nazwa}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-[#111827]/60">
            Publikacja
            <select
              value=""
              onChange={(z) => {
                if (z.target.value) hurtem("status", z.target.value)
                z.target.value = ""
              }}
              className="rounded-md border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
            >
              <option value="">— wybierz —</option>
              <option value="published">Wystaw w sklepie</option>
              <option value="draft">Wycofaj ze sprzedaży</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setZaznaczone({})
              setHurtStan("")
            }}
            className="text-sm text-[#111827]/50 underline transition hover:text-[#111827]"
          >
            Odznacz wszystkie
          </button>

          {hurtStan ? <p className="text-sm font-medium text-[#2E64A8]">{hurtStan}</p> : null}
        </div>
      ) : null}

      {!allegroDziala && stan === "gotowe" ? (
        <p className="mb-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Allegro nie odpowiedziało — kolumna „Cena Allegro" jest pusta, a ceny sklepu
          działają normalnie. Sprawdź: <code>node scripts/allegro/sprawdz.mjs</code>
        </p>
      ) : null}

      {blad ? (
        <p className="mb-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {blad}
        </p>
      ) : null}

      {zImportu ? (
        <p className="mb-5 rounded-md border border-[#2E64A8]/30 bg-[#2E64A8]/5 p-4 text-sm">
          Z arkusza wczytałem <strong>{zImportu}</strong>{" "}
          {zImportu === 1 ? "wiersz" : "wierszy"}. Sprawdź podświetlone pozycje i zapisz —
          nic jeszcze nie poszło do sklepu ani na Allegro.
        </p>
      ) : null}

      {wynik ? (
        <div
          className={`mb-5 rounded-md border p-4 text-sm ${
            wynik.bledy.length ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"
          }`}
        >
          <p className="font-semibold">
            Zapisane — ceny w sklepie: {wynik.sklep}, ceny na Allegro: {wynik.allegro}, ceny
            detaliczne: {wynik.detaliczne}, stany w sklepie: {wynik.sztuki}, stany na Allegro:{" "}
            {wynik.stany}.
            {wynik.publikacje ? ` Zmieniona publikacja: ${wynik.publikacje}.` : ""}
            {wynik.bledy.length ? ` Nie udało się: ${wynik.bledy.length}.` : ""}
          </p>
          {wynik.bledy.map((b, numer) => (
            <p key={numer} className="mt-1 text-[#111827]/70">
              {b.co ? `${b.co} · ` : ""}
              {b.tytul ? `${b.tytul}: ` : ""}
              {b.blad}
            </p>
          ))}
        </div>
      ) : null}

      {stan === "laduje" ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-semibold text-[#111827]">
              Wczytuję ceny ze sklepu i z Allegro…
            </p>
            <p className="text-sm font-semibold tabular-nums text-[#2E64A8]">
              {postep.procent}%
            </p>
          </div>

          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#111827]/8"
            role="progressbar"
            aria-valuenow={postep.procent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Postęp pobierania cen"
          >
            <div
              className="h-full rounded-full bg-[#2E64A8] transition-[width] duration-300"
              style={{ width: `${Math.max(postep.procent, 3)}%` }}
            />
          </div>

          <p className="mt-2 text-sm text-[#111827]/50">
            {postep.opis || "Łączę się z serwerem…"}
          </p>
        </div>
      ) : null}

      {stan === "blad" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{blad}</p>
          <button
            type="button"
            onClick={() => pobierz(true)}
            className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold transition hover:bg-white"
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : null}

      {stan === "gotowe" ? (
        <div className="overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={wszystkieZaznaczone}
                    onChange={przelaczWszystkie}
                    aria-label="Zaznacz wszystkie widoczne"
                    title="Zaznacz wszystkie widoczne"
                    className="h-4 w-4 cursor-pointer accent-[#2E64A8]"
                  />
                </th>
                <Naglowek pole="tytul" sortuj={sortuj} ustaw={setSortuj} className="px-4 py-3">
                  Produkt
                </Naglowek>
                <Naglowek pole="cenaSklep" sortuj={sortuj} ustaw={setSortuj} className="w-40 px-3 py-3">
                  Cena sklep
                </Naglowek>
                <Naglowek pole="cenaAllegro" sortuj={sortuj} ustaw={setSortuj} className="w-40 px-3 py-3">
                  Cena Allegro
                </Naglowek>
                <Naglowek pole="cenaDetaliczna" sortuj={sortuj} ustaw={setSortuj} className="w-56 px-3 py-3">
                  Cena detaliczna
                </Naglowek>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {widoczne.map((w) => {
                const wpis = wpisy[w.wariantId] || {}
                const zmiana = doZapisu.find((z) => z.wiersz.wariantId === w.wariantId)
                const roznica =
                  w.cenaSklep !== null && w.cenaAllegro !== null ? w.cenaAllegro - w.cenaSklep : null
                const cenaData = dzien(kiedyZmieniona({ cena_zmieniona: w.cenaZmieniona }, "cena_zmieniona"))
                const detalicznaData = dzien(
                  kiedyZmieniona(
                    { cena_detaliczna_zmieniona: w.detalicznaZmieniona },
                    "cena_detaliczna_zmieniona"
                  )
                )
                const otwarty = Boolean(rozwiniete[w.wariantId])
                // Wiersz ze zmianą w schowanej części rozwijamy sam z siebie —
                // inaczej pasek na dole mówiłby o zmianie, której nie widać.
                const ukryteZmiany =
                  zmiana?.sztuki !== undefined ||
                  zmiana?.stanAllegro !== undefined ||
                  zmiana?.notatka !== undefined ||
                  zmiana?.waga !== undefined ||
                  zmiana?.bezAllegro !== undefined ||
                  zmiana?.sku2 !== undefined ||
                  zmiana?.ean !== undefined ||
                  zmiana?.dostepnosc !== undefined ||
                  zmiana?.status !== undefined
                const pokazSzczegoly = otwarty || ukryteZmiany
                // Zakaz liczymy z pola do edycji, nie z bazy: zaznaczenie ma
                // wyszarzyć cenę Allegro od razu, a nie dopiero po zapisie.
                const zakaz = wpis.bezAllegro ?? w.bezAllegro

                return (
                  <Fragment key={w.wariantId}>
                    <tr
                      className={`border-b border-[#111827]/6 ${
                        zmiana ? "bg-[#2E64A8]/5" : ""
                      } ${pokazSzczegoly ? "border-b-0" : ""}`}
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={Boolean(zaznaczone[w.wariantId])}
                          onChange={() => przelaczZaznaczenie(w.wariantId)}
                          aria-label={`Zaznacz ${w.tytul}`}
                          className="mt-1 h-4 w-4 cursor-pointer accent-[#2E64A8]"
                        />
                      </td>
                      {/*
                        `max-w-0 w-full` to jedyny sposób, żeby `truncate`
                        zadziałało w komórce tabeli: przy zwykłym układzie
                        automatycznym kolumna rozpycha się do najdłuższej
                        nazwy, więc jeden produkt z tytułem na sto znaków
                        (zestawy Garmina) rozjeżdżał całą tabelę i reszta
                        kolumn uciekała poza ekran. Z `max-w-0` kolumna bierze
                        to, co zostanie po kolumnach o stałej szerokości,
                        a nazwa jest przycinana.
                      */}
                      <td className="w-full max-w-0 px-4 py-3">
                        <a
                          href={`/narzedzia-8f3a/produkty/${w.produktId}`}
                          title={w.tytul}
                          className="block truncate font-medium hover:text-[#2E64A8] hover:underline"
                        >
                          {w.tytul}
                        </a>
                        <p className="truncate text-xs text-[#111827]/40">
                          {w.sku || "bez SKU"}
                          {PO_CZYM[w.poCzym] || ""}
                          {w.kategoria ? ` · ${w.kategoria}` : ""}
                          {(wpis.status ?? w.status) !== "published" ? " · szkic" : ""}
                          {w.notatka.trim() ? " · notatka" : ""}
                          {w.bezAllegro ? " · nie na Allegro" : ""}
                        </p>
                      </td>

<td className="px-3 py-3">
                      <input
                        inputMode="decimal"
                        value={wpis.sklep ?? (w.cenaSklep === null ? "" : String(w.cenaSklep))}
                        onChange={(z) => ustaw(w.wariantId, "sklep", z.target.value)}
                        className={pole}
                      />
                      {zmiana?.sklep !== undefined ? (
                        <p className="mt-1 whitespace-nowrap text-right text-xs text-[#111827]/45">
                          było {zloty(w.cenaSklep)}
                        </p>
                      ) : null}

                      {/* Data mówi, jak stara jest ta kwota. Wypełnia się od
                          pierwszej zmiany z panelu — przy cenach przeniesionych
                          z WooCommerce zostaje pusta, bo nie wiemy, kiedy je
                          ustawiono, a zmyślona data jest gorsza niż żadna. */}
                      {cenaData ? (
                        <p
                          className="mt-1 whitespace-nowrap text-right text-xs text-[#111827]/35"
                          title="ostatnia zmiana ceny z panelu"
                        >
                          zmieniona {cenaData}
                        </p>
                      ) : null}
                    </td>
<td className="px-3 py-3">
                      {/* Zakaz sprzedaży na Allegro zamyka pole ceny. Kwota
                          wpisana przy produkcie, którego tam nie sprzedajemy,
                          nie ma dokąd pójść — a samo pole podpowiadało, że
                          jednak ma. */}
                      {zakaz ? (
                        <span className="block text-right text-xs text-[#111827]/35">
                          nie sprzedajemy na Allegro
                        </span>
                      ) : w.ofertaId ? (
                        <>
                          <input
                            inputMode="decimal"
                            value={wpis.allegro ?? (w.cenaAllegro === null ? "" : String(w.cenaAllegro))}
                            onChange={(z) => ustaw(w.wariantId, "allegro", z.target.value)}
                            className={pole}
                          />
                          {zmiana?.allegro !== undefined ? (
                            <p className="mt-1 whitespace-nowrap text-right text-xs text-[#111827]/45">
                              było {zloty(w.cenaAllegro)}
                            </p>
                          ) : null}

                          {/* Podpowiedź z reguł pokazujemy tylko wtedy, gdy różni
                              się od ceny, która już tam stoi — przy zgodnej cenie
                              byłaby to linijka „to samo" przy każdym wierszu. */}
                          {(() => {
                            const zregul = wgReguly(w)
                            if (zregul === null || zregul === w.cenaAllegro) return null

                            return (
                              <button
                                type="button"
                                onClick={() => ustaw(w.wariantId, "allegro", zregul.toFixed(2))}
                                title="Wpisuje cenę z reguł — zapis dopiero paskiem na dole"
                                className="mt-1 block w-full text-right text-xs text-[#2E64A8] hover:underline"
                              >
                                z reguł {zloty(zregul)}
                              </button>
                            )
                          })()}
                        </>
                      ) : (
                        <span className="text-xs text-[#111827]/35">
                          {allegroDziala ? "nie ma na Allegro" : "—"}
                        </span>
                      )}
                    </td>
{/* Cena detaliczna: liczba do porównania, a przełącznik obok
                        decyduje, czy klient zobaczy ją przekreśloną. Osobno, bo
                        cena katalogowa jest prawie zawsze wyższa i bez tego cały
                        katalog wyglądałby na przeceniony. */}
                    <td className="px-3 py-3">
                      {/* Pole i przełącznik w jednym rzędzie — „przekreślona"
                          zawijana pod spód wyglądała jak podpis do liczby,
                          a jest osobną decyzją. */}
                      <div className="flex items-center gap-2">
                        <input
                          inputMode="decimal"
                          value={
                            wpis.detaliczna ??
                            (w.cenaDetaliczna === null ? "" : String(w.cenaDetaliczna))
                          }
                          onChange={(z) => ustaw(w.wariantId, "detaliczna", z.target.value)}
                          className={pole}
                        />

                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-[#111827]/55">
                          <input
                            type="checkbox"
                            checked={wpis.przekreslona ?? w.przekreslona}
                            onChange={(z) => przelacz(w.wariantId, z.target.checked)}
                            className="h-3.5 w-3.5 accent-[#2E64A8]"
                          />
                          przekreślona
                        </label>
                      </div>

                      {zmiana?.detaliczna !== undefined ? (
                        <p className="mt-1 whitespace-nowrap text-xs text-[#111827]/45">
                          było {zloty(w.cenaDetaliczna)}
                        </p>
                      ) : null}

                      {detalicznaData ? (
                        <p className="mt-1 whitespace-nowrap text-xs text-[#111827]/35">
                          wpisana {detalicznaData}
                        </p>
                      ) : null}

                      {/* Przy ogłoszonej obniżce klient musi zobaczyć najniższą
                          cenę z 30 dni (Omnibus). Pokazujemy tu, co dostanie —
                          albo że nie mamy jeszcze historii, z której da się ją
                          policzyć. */}
                      {(wpis.przekreslona ?? w.przekreslona) ? (
                        <p
                          className="mt-1 whitespace-nowrap text-xs text-[#111827]/35"
                          title="Najniższa cena z 30 dni przed obniżką — pokazywana klientowi obok przekreślonej ceny"
                        >
                          {w.najnizsza30 === null
                            ? "30 dni: brak historii"
                            : `30 dni: ${zloty(w.najnizsza30)}`}
                        </p>
                      ) : null}
                    </td>
                      <td className="px-3 py-3 text-right">
                        {/* Zapis i odrzucenie jednego wiersza. Pasek na dole
                            zostaje do zmian hurtem, ale poprawka jednej ceny
                            na górze listy nie ma po co kazać zjeżdżać przez
                            czterysta pozycji. */}
                        {zmiana ? (
                          <div className="mb-1.5 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Zapisz ten wiersz"
                              aria-label={`Zapisz zmiany: ${w.tytul}`}
                              disabled={Boolean(zapisuje)}
                              onClick={() => zapisz(w.wariantId)}
                              className="rounded-md bg-[#2E64A8] px-2 py-1 text-xs font-semibold leading-none text-white hover:bg-[#28588F] disabled:opacity-50"
                            >
                              {zapisuje === w.wariantId ? "…" : "✓"}
                            </button>
                            <button
                              type="button"
                              title="Odrzuć zmiany w tym wierszu"
                              aria-label={`Odrzuć zmiany: ${w.tytul}`}
                              disabled={Boolean(zapisuje)}
                              onClick={() => odrzuc(w.wariantId)}
                              className="rounded-md border border-[#111827]/15 px-2 py-1 text-xs font-semibold leading-none text-[#111827]/55 hover:border-[#111827]/30 hover:text-[#111827] disabled:opacity-50"
                            >
                              ✗
                            </button>
                          </div>
                        ) : null}

                        {/* Przycisk, nie odnośnik: „więcej" było napisem
                            wysokim na 16 px w wierszu pełnym pól i trafiało
                            się w nie co drugi raz. Całego wiersza nie robimy
                            klikalnego — jest w nim sześć pól do wpisywania
                            i przypadkowe zwinięcie w trakcie edycji byłoby
                            gorsze od małego celu. */}
                        <button
                          type="button"
                          aria-expanded={pokazSzczegoly}
                          aria-label={`${pokazSzczegoly ? "Zwiń" : "Rozwiń"} szczegóły: ${w.tytul}`}
                          onClick={() =>
                            setRozwiniete((teraz) => ({ ...teraz, [w.wariantId]: !otwarty }))
                          }
                          className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                            pokazSzczegoly
                              ? "border-[#2E64A8] bg-[#2E64A8]/8 text-[#2E64A8]"
                              : "border-[#111827]/15 text-[#111827]/60 hover:border-[#2E64A8] hover:text-[#2E64A8]"
                          }`}
                        >
                          {pokazSzczegoly ? "mniej" : "więcej"}
                          <span aria-hidden className={pokazSzczegoly ? "rotate-180" : ""}>
                            ⌄
                          </span>
                        </button>
                      </td>
                    </tr>

                    {pokazSzczegoly ? (
                      <tr className={`border-b border-[#111827]/6 ${zmiana ? "bg-[#2E64A8]/5" : ""}`}>
                        <td colSpan={6} className="px-4 pb-4">
                          <div className="grid gap-x-6 gap-y-4 rounded-md bg-[#111827]/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className={etykieta}>SKU</p>
                              {/* SKU łączy produkt z ofertą na Allegro. Zmiana
                                  jest tu możliwa, ale zapis poprawia **także**
                                  sygnaturę oferty — inaczej oferta zostałaby ze
                                  starym numerem i wypadła z zestawienia. */}
                              <input
                                value={wpis.sku2 ?? w.sku}
                                onChange={(z) => ustaw(w.wariantId, "sku2", z.target.value)}
                                placeholder="bez SKU"
                                className={`${poleBazowe} w-full text-left`}
                              />
                              {zmiana?.sku2 !== undefined ? (
                                <p className="mt-1 text-xs text-amber-700">
                                  było {w.sku || "—"}
                                  {w.ofertaId ? " · poprawimy też sygnaturę oferty" : ""}
                                </p>
                              ) : null}
                            </div>

                            <div>
                              <p className={etykieta}>EAN</p>
                              <input
                                value={wpis.ean ?? w.ean}
                                onChange={(z) => ustaw(w.wariantId, "ean", z.target.value)}
                                placeholder="13 cyfr"
                                className={`${poleBazowe} w-full text-left`}
                              />
                              {zmiana?.ean !== undefined ? (
                                <p className="mt-1 text-xs text-[#111827]/45">było {w.ean || "—"}</p>
                              ) : null}

                              {/* EAN wpisany przy aukcji. Prawie każda oferta go
                                  ma, a u nas bywa pusto — jedno kliknięcie
                                  przepisuje. Zapis idzie normalną drogą, więc
                                  nic nie wchodzi do sklepu bez potwierdzenia. */}
                              {w.eanAllegro && w.eanAllegro !== (wpis.ean ?? w.ean) ? (
                                <button
                                  type="button"
                                  onClick={() => ustaw(w.wariantId, "ean", w.eanAllegro)}
                                  className="mt-1 text-xs font-semibold text-[#2E64A8] hover:underline"
                                >
                                  z Allegro: {w.eanAllegro}
                                </button>
                              ) : null}
                            </div>

                            <div>
                              <p className={etykieta}>Dostępność</p>
                              <select
                                value={wpis.dostepnosc ?? w.dostepnosc}
                                onChange={(z) => ustaw(w.wariantId, "dostepnosc", z.target.value)}
                                className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 outline-none focus:border-[#2E64A8]"
                              >
                                {DOSTEPNOSCI.map((d) => (
                                  <option key={d.klucz} value={d.klucz}>
                                    {d.nazwa}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Wycofanie ze sprzedaży. Szkic znika ze sklepu
                                w całości — z list, z wyszukiwarki i z feedu do
                                Google — ale zostaje w Medusie ze zdjęciami
                                i ceną, więc powrót to jedno kliknięcie. To co
                                innego niż dostępność „niedostępny", która
                                zostawia stronę produktu na miejscu: tam towar
                                wróci, tu go już nie będzie. */}
                            <div>
                              <p className={etykieta}>Publikacja</p>
                              <select
                                value={wpis.status ?? w.status}
                                onChange={(z) => ustaw(w.wariantId, "status", z.target.value)}
                                className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 outline-none focus:border-[#2E64A8]"
                              >
                                <option value="published">W sklepie</option>
                                <option value="draft">Szkic — wycofany ze sklepu</option>
                              </select>
                              {zmiana?.status !== undefined ? (
                                <p className="mt-1 text-xs text-amber-700">
                                  {zmiana.status === "published"
                                    ? "wróci do sklepu"
                                    : "zniknie ze sklepu"}
                                </p>
                              ) : null}
                            </div>

                            {/* Waga idzie do feedu Google jako koszt dostawy.
                                Puste pole znaczy „nie wiemy" i wtedy feed o niej
                                milczy — zmyślona waga to źle policzona
                                przesyłka u klienta. */}
                            <div>
                              <p className={etykieta}>Waga (kg)</p>
                              <input
                                inputMode="decimal"
                                value={wpis.waga ?? (w.waga === null ? "" : String(w.waga))}
                                onChange={(z) => ustaw(w.wariantId, "waga", z.target.value)}
                                className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"
                              />
                            </div>

                            <div>
                              <p className={etykieta}>Różnica cen</p>
                              <p className="py-1.5 tabular-nums text-[#111827]/60">
                                {roznica === null
                                  ? "—"
                                  : roznica === 0
                                    ? "równe"
                                    : `${roznica > 0 ? "+" : ""}${zloty(roznica)}`}
                              </p>
                            </div>

                            <div>
                              <p className={etykieta}>Stan sklep</p>
                              <input
                                inputMode="numeric"
                                value={wpis.sztuki ?? (w.sztuki === null ? "" : String(w.sztuki))}
                                onChange={(z) => ustaw(w.wariantId, "sztuki", z.target.value)}
                                className={`${poleBazowe} w-20 text-right tabular-nums`}
                              />
                              {zmiana?.sztuki !== undefined ? (
                                <p className="mt-1 text-xs text-[#111827]/45">
                                  było {w.sztuki === null ? "—" : w.sztuki}
                                </p>
                              ) : null}
                            </div>

                            <div>
                              <p className={etykieta}>Stan Allegro</p>
                              {zakaz ? (
                                <p className="py-1.5 text-xs text-[#111827]/35">
                                  nie sprzedajemy na Allegro
                                </p>
                              ) : w.ofertaId ? (
                                <>
                                  <input
                                    inputMode="numeric"
                                    value={
                                      wpis.stanAllegro ??
                                      (w.stanAllegro === null ? "" : String(w.stanAllegro))
                                    }
                                    onChange={(z) => ustaw(w.wariantId, "stanAllegro", z.target.value)}
                                    className={`${poleBazowe} w-20 text-right tabular-nums`}
                                  />
                                  {zmiana?.stanAllegro !== undefined ? (
                                    <p className="mt-1 text-xs text-[#111827]/45">
                                      było {w.stanAllegro === null ? "—" : w.stanAllegro}
                                    </p>
                                  ) : null}
                                </>
                              ) : (
                                <p className="py-1.5 text-xs text-[#111827]/35">nie ma oferty</p>
                              )}
                            </div>

                            {/* Aukcja na Allegro: co dokładnie jest sparowane
                                z tym produktem. Sam znacznik „jest na Allegro"
                                nie mówił, KTÓRA to oferta — a przy dwóch
                                podobnych silnikach to jest cała różnica. */}
                            <div className="sm:col-span-2">
                              <p className={etykieta}>Aukcja na Allegro</p>

                              {w.ofertaId ? (
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <a
                                      href={`https://allegro.pl/oferta/${w.ofertaId}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block truncate font-medium text-[#2E64A8] hover:underline"
                                    >
                                      {w.nazwaAllegro || `Oferta ${w.ofertaId}`}
                                    </a>
                                    <p className="truncate text-xs text-[#111827]/45">
                                      nr {w.ofertaId}
                                      {odpiete.has(w.wariantId)
                                        ? " · odpięte, parowanie przeliczy się przy najbliższym odświeżeniu"
                                        : w.poCzym === "reczne"
                                          ? " · para przypięta ręcznie"
                                          : w.poCzym === "sku"
                                            ? " · sparowane po SKU — ten sam numer po obu stronach"
                                            : w.poCzym === "ean"
                                              ? " · sparowane po EAN — ten sam numer po obu stronach"
                                              : w.poCzym === "ean-allegro"
                                                ? " · sparowane po EAN pobranym z Allegro"
                                                : " · sygnatura zgadza się dopiero po odsianiu spacji i myślników"}
                                    </p>
                                  </div>

                                  {/* Pewnych par nie ma po co potwierdzać: dokładne SKU
                                      i dokładny EAN to ten sam numer po obu stronach.
                                      Przycisk zostaje tam, gdzie coś jest do decyzji —
                                      przy parach luźnych i przy odpinaniu ręcznej. */}
                                  {luznaPara(w.poCzym) && !odpiete.has(w.wariantId) ? (
                                    <button
                                      type="button"
                                      disabled={laczy === w.wariantId}
                                      onClick={() => ustawPare(w.wariantId, w.ofertaId, true)}
                                      className="shrink-0 rounded-md border border-[#2E64A8] bg-[#2E64A8] px-2 py-1 text-xs font-semibold text-white hover:bg-[#28588F] disabled:opacity-50"
                                    >
                                      {laczy === w.wariantId ? "…" : "Potwierdź parę"}
                                    </button>
                                  ) : w.poCzym === "reczne" && !odpiete.has(w.wariantId) ? (
                                    <button
                                      type="button"
                                      disabled={laczy === w.wariantId}
                                      onClick={() => ustawPare(w.wariantId, w.ofertaId, false)}
                                      className="shrink-0 rounded-md border border-[#111827]/15 px-2 py-1 text-xs font-semibold text-[#111827]/55 hover:border-[#111827]/30 hover:text-[#111827] disabled:opacity-50"
                                    >
                                      {laczy === w.wariantId ? "…" : "Odepnij"}
                                    </button>
                                  ) : null}
                                </div>
                              ) : w.paraZnikla ? (
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <p className="text-xs leading-5 text-amber-700">
                                    Przypięta aukcja nie wróciła z Allegro — mogła się zakończyć
                                    albo zostać skasowana. Dopóki para stoi, ten produkt nie
                                    sparuje się z żadną inną ofertą.
                                  </p>
                                  <button
                                    type="button"
                                    disabled={laczy === w.wariantId}
                                    onClick={() => ustawPare(w.wariantId, "", false)}
                                    className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:border-amber-500 disabled:opacity-50"
                                  >
                                    {laczy === w.wariantId ? "…" : "Odepnij"}
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs leading-5 text-[#111827]/45">
                                  {w.bezAllegro
                                    ? "Nie sprzedajemy tego na Allegro."
                                    : "Brak oferty. Wystaw ją w Allegro i wpisz nasze SKU w sygnaturę albo połącz ją z listy pod tabelą."}
                                </p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <p className={etykieta}>Notatka (tylko dla nas)</p>
                              <textarea
                                rows={2}
                                value={wpis.notatka ?? w.notatka}
                                onChange={(z) => ustaw(w.wariantId, "notatka", z.target.value)}
                                placeholder="np. czekamy na dostawę, cena od dostawcy do potwierdzenia…"
                                className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 outline-none focus:border-[#2E64A8]"
                              />

                              <label className="mt-2 flex items-start gap-2 text-xs text-[#111827]/55">
                                <input
                                  type="checkbox"
                                  checked={wpis.bezAllegro ?? w.bezAllegro}
                                  onChange={(z) =>
                                    ustawZnacznik(w.wariantId, "bezAllegro", z.target.checked)
                                  }
                                  className="mt-0.5"
                                />
                                <span>
                                  Nie sprzedajemy na Allegro
                                  {(wpis.bezAllegro ?? w.bezAllegro) && w.ofertaId ? (
                                    <strong className="ml-1 text-amber-700">
                                      — a oferta tam wisi, zdejmij ją
                                    </strong>
                                  ) : null}
                                </span>
                              </label>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {!widoczne.length ? (
            <p className="px-4 py-6 text-sm text-[#111827]/50">Nic nie pasuje do tych filtrów.</p>
          ) : null}
        </div>
      ) : null}

      {/* Oferty, których nie umiemy przypiąć do produktu. Bez tej listy „nie ma
          na Allegro" przy produkcie znaczyłoby raz brak oferty, a raz literówkę
          w sygnaturze — i nie dałoby się tego odróżnić. */}
      {stan === "gotowe" && bezProduktu.length ? (
        <div className="mt-8 rounded-lg border border-[#111827]/10 bg-white">
          <div className="border-b border-[#111827]/8 px-5 py-4">
            <p className="text-sm font-semibold">
              Na Allegro, ale nie u nas — {bezProduktu.length}{" "}
              {bezProduktu.length === 1 ? "oferta" : "ofert"}
            </p>
            <p className="mt-1 max-w-prose text-sm leading-6 text-[#111827]/55">
              Sygnatura sprzedawcy w tych ofertach jest pusta albo nie zgadza się z żadnym
              SKU ani EAN-em w sklepie, więc wypadają z zestawienia i z synchronizacji cen.
              Wybierz produkt z listy obok — wpiszę jego SKU w sygnaturę oferty na Allegro
              i <strong>przypnę parę na stałe</strong>, więc przy następnych odświeżeniach
              nie będzie już liczona od nowa. Gdzie nazwa oferty wyraźnie wskazuje
              jeden produkt, stoi przy niej podpowiedź do jednego kliknięcia; podpowiadamy
              tylko wtedy, gdy zgadzają się <strong>wszystkie liczby</strong> w nazwie, bo
              „60-350 KM" i „50-140 KM" to dwie różne anody.
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                <th className="px-5 py-3 font-semibold">Oferta</th>
                <th className="w-40 px-3 py-3 font-semibold">Sygnatura</th>
                <th className="w-28 px-3 py-3 text-right font-semibold">Cena</th>
                <th className="w-20 px-3 py-3 text-right font-semibold">Stan</th>
                <th className="w-72 px-3 py-3 font-semibold">Połącz z produktem</th>
              </tr>
            </thead>
            <tbody>
              {bezProduktu.map((oferta) => (
                <tr key={oferta.id} className="border-b border-[#111827]/6 last:border-0">
                  <td className="px-5 py-3">
                    <a
                      href={`https://allegro.pl/oferta/${oferta.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[#2E64A8] hover:underline"
                    >
                      {oferta.nazwa}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-[#111827]/50">
                    {oferta.sygnatura || <span className="text-amber-700">brak</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{zloty(oferta.cena)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#111827]/55">
                    {oferta.stan}
                  </td>
                  <td className="px-3 py-3">
                    {/* Podpowiedź po nazwie — nie zapisuje się sama, klik
                        wpisuje SKU produktu w sygnaturę oferty na Allegro. */}
                    {oferta.podpowiedz ? (
                      <button
                        type="button"
                        disabled={laczy === oferta.id}
                        onClick={() =>
                          oferta.podpowiedz &&
                          polacz(oferta.id, oferta.podpowiedz.sku, oferta.podpowiedz.wariantId)
                        }
                        className="mb-2 block w-full rounded-md border border-[#2E64A8]/40 bg-[#2E64A8]/5 px-2 py-1.5 text-left text-xs leading-5 text-[#2E64A8] hover:bg-[#2E64A8]/10 disabled:opacity-50"
                      >
                        <span className="font-semibold">Połącz z: {oferta.podpowiedz.tytul}</span>
                        <span className="block text-[#111827]/45">
                          {oferta.podpowiedz.sku} · zbieżność{" "}
                          {Math.round(oferta.podpowiedz.pewnosc * 100)}%
                        </span>
                      </button>
                    ) : null}

                    {/* Szukanie zamiast rozwijanej listy: niesparowanych
                        produktów bywa kilkaset, a przewijanie ich w poszukiwaniu
                        jednej anody to nie jest praca dla człowieka. Wpisane
                        słowa muszą trafić WSZYSTKIE — „anoda 350" zawęża od razu
                        do jednej pozycji, a szukamy i po nazwie, i po SKU, bo
                        sprzedawca ma pod ręką raz jedno, raz drugie. */}
                    {(() => {
                      const fraza = uprosc((szukanyProdukt[oferta.id] || "").trim())
                      const slowa = fraza.split(/\s+/).filter(Boolean)
                      const trafienia = slowa.length
                        ? bezOferty.filter((w) => {
                            const klucz = uprosc(`${w.tytul} ${w.sku}`)
                            return slowa.every((slowo) => klucz.includes(slowo))
                          })
                        : []

                      return (
                        <>
                          <input
                            value={szukanyProdukt[oferta.id] || ""}
                            disabled={laczy === oferta.id}
                            placeholder={
                              laczy === oferta.id ? "łączę…" : "szukaj po nazwie albo SKU…"
                            }
                            onChange={(z) =>
                              setSzukanyProdukt((stare) => ({
                                ...stare,
                                [oferta.id]: z.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 text-sm outline-none focus:border-[#2E64A8] disabled:opacity-50"
                          />

                          {slowa.length ? (
                            trafienia.length ? (
                              <div className="mt-1.5 max-h-56 overflow-y-auto rounded-md border border-[#111827]/10">
                                {/* Dziesięć wystarczy: dłuższa lista znaczy, że
                                    fraza jest za szeroka, i lepiej dopisać słowo
                                    niż przewijać. */}
                                {trafienia.slice(0, 10).map((w) => (
                                  <button
                                    key={w.wariantId}
                                    type="button"
                                    disabled={laczy === oferta.id}
                                    onClick={() => {
                                      polaczZWariantem(oferta.id, w.wariantId)
                                      setSzukanyProdukt((stare) => ({ ...stare, [oferta.id]: "" }))
                                    }}
                                    className="block w-full border-b border-[#111827]/6 px-2 py-1.5 text-left text-xs leading-5 last:border-0 hover:bg-[#2E64A8]/5 disabled:opacity-50"
                                  >
                                    <span className="block truncate font-medium">{w.tytul}</span>
                                    <span className="block text-[#111827]/45">
                                      {w.sku || "bez SKU"}
                                    </span>
                                  </button>
                                ))}
                                {trafienia.length > 10 ? (
                                  <p className="px-2 py-1.5 text-xs text-[#111827]/40">
                                    …i {trafienia.length - 10} dalszych — dopisz słowo, żeby
                                    zawęzić.
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-1.5 text-xs text-[#111827]/45">
                                Nic nie pasuje. Do wyboru idą tylko produkty jeszcze
                                niesparowane — jeśli szukanego już z czymś połączyliśmy, trzeba
                                go najpierw odpiąć w tabeli wyżej.
                              </p>
                            )
                          ) : null}

                          {/* Pełna lista zostaje obok szukania, nie zamiast niego.
                              Szukanie wygrywa, gdy zna się nazwę; lista wygrywa,
                              gdy się jej nie zna i chce się po prostu zobaczyć,
                              co w ogóle jest do wzięcia. */}
                          <select
                            value=""
                            disabled={laczy === oferta.id}
                            onChange={(z) => {
                              polaczZWariantem(oferta.id, z.target.value)
                              setSzukanyProdukt((stare) => ({ ...stare, [oferta.id]: "" }))
                            }}
                            className="mt-1.5 w-full rounded-md border border-[#111827]/15 px-2 py-1.5 text-xs outline-none focus:border-[#2E64A8] disabled:opacity-50"
                          >
                            <option value="">
                              {laczy === oferta.id
                                ? "łączę…"
                                : `— albo wybierz z listy (${bezOferty.length}) —`}
                            </option>
                            {bezOferty.map((w) => (
                              <option key={w.wariantId} value={w.wariantId}>
                                {w.tytul} · {w.sku}
                              </option>
                            ))}
                          </select>
                        </>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Skąd wiadomo, że EAN-y się dociągają. Bez tej linijki pusta kolumna
          EAN wyglądałaby tak samo przy „aukcje go nie mają" i przy „jeszcze
          nie zdążyliśmy zapytać". */}
      {stan === "gotowe" && allegroDziala && eanyAllegro?.wszystkie ? (
        <p className="mt-4 text-xs leading-6 text-[#111827]/45">
          EAN-y z Allegro: zapytaliśmy o {eanyAllegro.zapytane} z {eanyAllegro.wszystkie} ofert,
          numer ma {eanyAllegro.zEanem}.{" "}
          {eanyAllegro.zapytane < eanyAllegro.wszystkie
            ? "Resztę dopytuję po czterdzieści na wejście, żeby zakładka otwierała się w kilka sekund — po paru wejściach będzie komplet."
            : "To już wszystkie."}
        </p>
      ) : null}

      {stan === "gotowe" ? (
        <details className="mt-8 rounded-lg border border-[#111827]/10 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
            Jak dodać nowy produkt i wystawić go na Allegro
          </summary>

          <div className="border-t border-[#111827]/8 px-5 py-5 text-sm leading-7 text-[#111827]/70">
            <ol className="ml-5 list-decimal space-y-3">
              <li>
                <strong>W sklepie</strong> — zakładka <em>Produkty → Dodaj produkt</em>. SKU
                podaje się <strong>tylko przy zakładaniu</strong> i po nim idzie całe
                łączenie z Allegro, więc warto od razu wpisać takie, jakiego chcesz
                używać. Produkt powstaje jako szkic; opublikuj go, gdy ma już zdjęcia,
                opis i cenę.
              </li>
              <li>
                <strong>Na Allegro</strong> — ofertę wystawia się w Allegro, nie tutaj.
                Wystawienie wymaga kategorii, parametrów, zdjęć, sposobu dostawy
                i warunków zwrotu; najszybciej idzie przez <em>Wystaw podobnie</em> przy
                ofercie tego samego rodzaju.
              </li>
              <li>
                <strong>Połącz jedno z drugim</strong> — w formularzu oferty wpisz nasze
                SKU w pole <em>Sygnatura</em>. Albo zostaw je puste i wróć tutaj: nowa
                oferta pojawi się na liście „Na Allegro, ale nie u nas", a wybór produktu
                z listy obok wpisze sygnaturę za Ciebie.
              </li>
              <li>
                Od tej chwili produkt stoi w tabeli wyżej z obiema cenami i obydwoma
                stanami, a podpowiedź „z reguł" mówi, ile powinien kosztować na Allegro.
              </li>
            </ol>

            <p className="mt-4">
              Gdy oferta była wystawiona z EAN-em w sygnaturze, też ją sparujemy — pod
              warunkiem że ten sam EAN jest wpisany przy produkcie w sklepie. Wiersz
              w tabeli mówi wtedy „sparowane po EAN".
            </p>
          </div>
        </details>
      ) : null}

      {doZapisu.length ? (
        <div className="sticky bottom-0 z-30 -mx-5 mt-6 border-t border-[#111827]/10 bg-white px-5 py-4 md:-mx-8 md:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm">
              <strong>{doZapisu.length}</strong> do zapisania —{" "}
              {[
                [doZapisu.filter((z) => z.sklep !== undefined).length, "cen w sklepie"],
                [doZapisu.filter((z) => z.allegro !== undefined).length, "cen na Allegro"],
                [doZapisu.filter((z) => z.detaliczna !== undefined).length, "cen detalicznych"],
                [
                  doZapisu.filter((z) => z.przekreslona !== undefined).length,
                  "przekreśleń",
                ],
                [doZapisu.filter((z) => z.sztuki !== undefined).length, "stanów w sklepie"],
                [doZapisu.filter((z) => z.stanAllegro !== undefined).length, "stanów na Allegro"],
              ]
                .filter(([ile]) => ile)
                .map(([ile, co]) => `${ile} ${co}`)
                .join(", ")}
            </p>

            <p className="min-w-0 flex-1 truncate text-sm text-[#111827]/45">
              {doZapisu.map((z) => z.wiersz.tytul).join(", ")}
            </p>

            <button
              type="button"
              onClick={() => {
                setWpisy({})
                setZImportu(0)
              }}
              className="rounded-md border border-[#111827]/15 px-4 py-2 text-sm transition hover:border-[#111827]/30"
            >
              Cofnij zmiany
            </button>

            <button
              type="button"
              onClick={() => zapisz()}
              disabled={Boolean(zapisuje)}
              className="rounded-md bg-[#2E64A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-60"
            >
              {zapisuje === "*" ? "Zapisuję…" : "Zapisz zmiany"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
