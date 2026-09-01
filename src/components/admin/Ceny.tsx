"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { canReadInBrowser, readSpreadsheetInBrowser } from "@/lib/xlsx-browser"
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
  poCzym: "sku" | "ean" | ""
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
  nazwaAllegro: string
  cenaAllegro: number | null
  stanAllegro: number | null
  notatka: string
  bezAllegro: boolean
}

type OfertaBezProduktu = {
  id: string
  nazwa: string
  sygnatura: string
  cena: number
  stan: number
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
  bezAllegro?: boolean
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
  const [allegroDziala, setAllegroDziala] = useState(false)
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [szukaj, setSzukaj] = useState("")
  const [filtr, setFiltr] = useState<
    "wszystkie" | "allegro" | "bez-allegro" | "rozne" | "zakaz" | "z-notatka"
  >("wszystkie")
  const [kategoriaFiltr, setKategoriaFiltr] = useState("")
  // Sortowanie trzymamy jako parę: po czym i w którą stronę. Kliknięcie
  // w ten sam nagłówek odwraca kierunek, w inny — zaczyna od malejąco przy
  // liczbach i rosnąco przy tekście, bo tego się człowiek spodziewa.
  const [sortuj, setSortuj] = useState<{ pole: PoleSortowania; malejaco: boolean }>({
    pole: "tytul",
    malejaco: false,
  })
  const [wpisy, setWpisy] = useState<Record<string, Wpis>>({})
  const [zapisuje, setZapisuje] = useState(false)
  const [wynik, setWynik] = useState<{
    sklep: number
    allegro: number
    sztuki: number
    stany: number
    detaliczne: number
    bledy: { co: string; tytul: string; blad: string }[]
  } | null>(null)
  const [zImportu, setZImportu] = useState(0)
  const [postep, setPostep] = useState<{ procent: number; opis: string }>({
    procent: 0,
    opis: "",
  })
  const [laczy, setLaczy] = useState("")
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
      setAllegroDziala(Boolean(dane.allegroDziala))
      setPostep({ procent: 100, opis: "" })
      setStan("gotowe")
    }

    try {
      // Zestawienie to kilkanaście sekund pracy serwera, więc odpowiedź leci
      // strumieniem: kolejne linijki niosą postęp, ostatnia komplet danych.
      const odpowiedz = await fetch(
        `/api/admin/ceny?strumien=1${odswiez ? "&odswiez=1" : ""}`,
        { signal: przerwij.signal }
      )

      if (!odpowiedz.body) {
        // Przeglądarka bez strumieni albo pośrednik, który go zwinął —
        // pytamy po staremu, bez paska. Lepiej bez paska niż wcale.
        const zapasowo = await fetch(`/api/admin/ceny${odswiez ? "?odswiez=1" : ""}`, {
          signal: przerwij.signal,
        })
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
    setWpisy((teraz) => ({ ...teraz, [wariantId]: { ...teraz[wariantId], [gdzie]: wartosc } }))
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
      bezAllegro?: boolean
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
      const zmianaAllegro =
        allegro !== null && wiersz.ofertaId && allegro !== wiersz.cenaAllegro ? allegro : undefined
      const zmianaSztuk = sztuki !== null && sztuki !== wiersz.sztuki ? sztuki : undefined
      const zmianaStanu =
        stan !== null && wiersz.ofertaId && stan !== wiersz.stanAllegro ? stan : undefined
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

      if (
        zmianaSklep !== undefined ||
        zmianaAllegro !== undefined ||
        zmianaSztuk !== undefined ||
        zmianaStanu !== undefined ||
        zmianaDetalicznej !== undefined ||
        zmianaPrzekreslenia !== undefined ||
        zmianaNotatki !== undefined ||
        zmianaZakazu !== undefined
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
          bezAllegro: zmianaZakazu,
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
        if (kBezAllegro >= 0) {
          const slowo = String(rzad[kBezAllegro] ?? "").trim().toLowerCase()
          if (slowo === "tak") wpis.bezAllegro = true
          else if (slowo === "nie") wpis.bezAllegro = false
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

  async function zapisz() {
    setZapisuje(true)
    setWynik(null)

    try {
      const odpowiedz = await fetch("/api/admin/ceny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zmiany: doZapisu.map(({
            wiersz,
            sklep,
            allegro,
            sztuki,
            stanAllegro,
            detaliczna,
            przekreslona,
            notatka,
            bezAllegro,
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
            ...(bezAllegro !== undefined ? { bezAllegro } : {}),
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
        bledy: dane.bledy || [],
      })
      setWpisy({})
      setZImportu(0)
      await pobierz(true)
    } catch {
      setWynik({
        sklep: 0,
        allegro: 0,
        sztuki: 0,
        stany: 0,
        detaliczne: 0,
        bledy: [{ co: "", tytul: "", blad: "Brak połączenia." }],
      })
    } finally {
      setZapisuje(false)
    }
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

  const naAllegro = wiersze.filter((w) => w.ofertaId).length
  const rozne = wiersze.filter(
    (w) => w.ofertaId && w.cenaSklep !== null && w.cenaAllegro !== w.cenaSklep
  ).length
  // „Do wystawienia" to braki, które da się nadrobić — bez tych, których
  // wystawiać nie wolno. Wcześniej jedno i drugie leżało w jednym worku.
  const doWystawienia = wiersze.filter((w) => !w.ofertaId && !w.bezAllegro).length
  const zZakazem = wiersze.filter((w) => w.bezAllegro).length
  const zNotatka = wiersze.filter((w) => w.notatka.trim()).length

  const nazwyKategorii = useMemo(
    () =>
      [...new Set(wiersze.map((w) => w.kategoria).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pl")
      ),
    [wiersze]
  )

  const pole =
    "w-24 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"
  const poleReguly =
    "w-24 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"

  /**
   * Łączy ofertę z produktem: wpisuje jego SKU w sygnaturę oferty na Allegro.
   *
   * Tylko produkty **jeszcze niesparowane** — jedna oferta na produkt, inaczej
   * dwie oferty dostałyby tę samą cenę z tego samego wiersza.
   */
  async function polacz(ofertaId: string, sygnatura: string) {
    if (!sygnatura) return
    setLaczy(ofertaId)
    setBlad("")

    const wynikLaczenia = await fetch("/api/admin/ceny", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ co: "polacz", ofertaId, sygnatura }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false, blad: "Brak połączenia z serwerem." }))

    setLaczy("")

    if (!wynikLaczenia.ok) {
      setBlad(wynikLaczenia.blad || "Nie udało się połączyć.")
      return
    }

    // Zestawienie budujemy od nowa: sparowana oferta ma zniknąć z tej listy
    // i pojawić się w kolumnach przy produkcie.
    await pobierz(true)
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

      {stan === "gotowe" && reguly ? (
        <div className="mb-5 rounded-lg border border-[#111827]/10 bg-white">
          <button
            type="button"
            onClick={() => setRegulyOtwarte((teraz) => !teraz)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span>
              <span className="text-sm font-semibold">Reguły cen na Allegro</span>
              <span className="ml-3 text-sm text-[#111827]/45">
                domyślnie {opisRegulyText(reguly.domyslna)}
                {Object.keys(reguly.kategorie).length
                  ? ` · wyjątki: ${Object.keys(reguly.kategorie).length}`
                  : ""}
              </span>
            </span>
            <span className="text-sm text-[#2E64A8]">
              {regulyOtwarte ? "Zwiń" : "Rozwiń"}
            </span>
          </button>

          {regulyOtwarte ? (
            <div className="border-t border-[#111827]/8 px-5 py-5">
              <p className="mb-4 max-w-prose text-sm leading-6 text-[#111827]/55">
                Cena na Allegro liczona z ceny sklepu: procent (prowizja portalu), kwota
                albo obie naraz. Reguła kategorii wygrywa z domyślną — silniki mają inną
                prowizję niż drobne części. Reguły są zapisane w bazie, więc zmiana
                narzutu nie wymaga wdrożenia, i działają też przy eksporcie kanałów
                i synchronizacji.
              </p>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                    <th className="py-2 font-semibold">Dotyczy</th>
                    <th className="w-28 py-2 font-semibold">Procent</th>
                    <th className="w-28 py-2 font-semibold">Kwota (zł)</th>
                    <th className="w-48 py-2 font-semibold">Zaokrąglenie</th>
                    <th className="w-24 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {[
                    { gdzie: "", nazwa: "Wszystkie produkty", regula: reguly.domyslna },
                    ...Object.entries(reguly.kategorie).map(([uchwyt, regula]) => ({
                      gdzie: uchwyt,
                      nazwa: kategorie.find(([u]) => u === uchwyt)?.[1] || uchwyt,
                      regula,
                    })),
                  ].map(({ gdzie, nazwa, regula }) => (
                    <tr key={gdzie || "domyslna"} className="border-b border-[#111827]/6 last:border-0">
                      <td className="py-2.5 pr-4">{nazwa}</td>
                      <td className="py-2.5">
                        <input
                          inputMode="decimal"
                          value={regula.percent ?? ""}
                          onChange={(z) => zmienRegule(gdzie, "percent", z.target.value)}
                          className={poleReguly}
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          inputMode="decimal"
                          value={regula.amount ?? ""}
                          onChange={(z) => zmienRegule(gdzie, "amount", z.target.value)}
                          className={poleReguly}
                        />
                      </td>
                      <td className="py-2.5">
                        <select
                          value={regula.round || ""}
                          onChange={(z) => zmienRegule(gdzie, "round", z.target.value)}
                          className="rounded-md border border-[#111827]/15 px-2 py-1.5 text-sm outline-none focus:border-[#2E64A8]"
                        >
                          {ZAOKRAGLENIA.map((z) => (
                            <option key={z.wartosc} value={z.wartosc}>
                              {z.nazwa}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 text-right">
                        {gdzie ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReguly((teraz) => {
                                if (!teraz) return teraz
                                const kopia = { ...teraz.kategorie }
                                delete kopia[gdzie]
                                setRegulyStan("")
                                return { ...teraz, kategorie: kopia }
                              })
                            }
                            className="text-xs text-[#111827]/45 hover:text-red-600"
                          >
                            usuń
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <select
                  value=""
                  onChange={(z) => {
                    const uchwyt = z.target.value
                    if (!uchwyt) return
                    // Nowy wyjątek startuje od reguły domyślnej — inaczej
                    // dodanie kategorii wyzerowałoby jej narzut do zera.
                    setReguly((teraz) =>
                      teraz
                        ? {
                            ...teraz,
                            kategorie: { ...teraz.kategorie, [uchwyt]: { ...teraz.domyslna } },
                          }
                        : teraz
                    )
                    setRegulyStan("")
                  }}
                  className="rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
                >
                  <option value="">+ wyjątek na kategorię…</option>
                  {kategorie
                    .filter(([uchwyt]) => !reguly.kategorie[uchwyt])
                    .map(([uchwyt, nazwa]) => (
                      <option key={uchwyt} value={uchwyt}>
                        {nazwa}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={zapiszReguly}
                  className="rounded-md bg-[#2E64A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F]"
                >
                  Zapisz reguły
                </button>

                <button
                  type="button"
                  onClick={wypelnijZRegul}
                  className="rounded-md border border-[#111827]/15 px-4 py-2 text-sm font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
                >
                  Wypełnij widoczne ceny Allegro z reguł
                </button>

                {regulyStan ? (
                  <p className="text-sm text-[#111827]/60">{regulyStan}</p>
                ) : null}
              </div>
            </div>
          ) : null}
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
          <table className="w-full min-w-[1560px] text-sm">
            <thead>
              <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                <Naglowek pole="tytul" sortuj={sortuj} ustaw={setSortuj} className="px-4 py-3">
                  Produkt
                </Naglowek>
                <Naglowek pole="cenaSklep" sortuj={sortuj} ustaw={setSortuj} className="w-40 px-3 py-3">
                  Cena sklep
                </Naglowek>
                <Naglowek pole="cenaAllegro" sortuj={sortuj} ustaw={setSortuj} className="w-40 px-3 py-3">
                  Cena Allegro
                </Naglowek>
                <Naglowek pole="roznica" sortuj={sortuj} ustaw={setSortuj} className="w-28 px-3 py-3">
                  Różnica
                </Naglowek>
                <Naglowek pole="cenaDetaliczna" sortuj={sortuj} ustaw={setSortuj} className="w-56 px-3 py-3">
                  Cena detaliczna
                </Naglowek>
                <Naglowek pole="sztuki" sortuj={sortuj} ustaw={setSortuj} className="w-24 px-3 py-3">
                  Stan sklep
                </Naglowek>
                <Naglowek pole="stanAllegro" sortuj={sortuj} ustaw={setSortuj} className="w-24 px-3 py-3">
                  Stan Allegro
                </Naglowek>
                <th className="w-64 px-3 py-3 font-semibold">Notatka</th>
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

                return (
                  <tr
                    key={w.wariantId}
                    className={`border-b border-[#111827]/6 last:border-0 ${zmiana ? "bg-[#2E64A8]/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`/narzedzia-8f3a/produkty/${w.produktId}`}
                        className="block truncate font-medium hover:text-[#2E64A8] hover:underline"
                      >
                        {w.tytul}
                      </a>
                      <p className="truncate text-xs text-[#111827]/40">
                        {w.sku || "bez SKU"}
                        {w.poCzym === "ean" ? " · sparowane po EAN" : ""}
                        {w.kategoria ? ` · ${w.kategoria}` : ""}
                        {w.status !== "published" ? " · szkic" : ""}
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
                      {w.ofertaId ? (
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

                    <td className="px-3 py-3 text-right tabular-nums text-[#111827]/55">
                      {roznica === null
                        ? "—"
                        : roznica === 0
                          ? "równe"
                          : `${roznica > 0 ? "+" : ""}${zloty(roznica)}`}
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

                    {/* Sztuki w sklepie to metadana produktu — sklep nie prowadzi
                        magazynu, sprzedawca podaje, ile ma na półce. */}
                    <td className="px-3 py-3">
                      <input
                        inputMode="numeric"
                        value={wpis.sztuki ?? (w.sztuki === null ? "" : String(w.sztuki))}
                        onChange={(z) => ustaw(w.wariantId, "sztuki", z.target.value)}
                        className={`${pole} w-16`}
                      />
                      {zmiana?.sztuki !== undefined ? (
                        <p className="mt-1 text-right text-xs text-[#111827]/45">
                          było {w.sztuki === null ? "—" : w.sztuki}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-3 py-3">
                      {w.ofertaId ? (
                        <>
                          <input
                            inputMode="numeric"
                            value={
                              wpis.stanAllegro ??
                              (w.stanAllegro === null ? "" : String(w.stanAllegro))
                            }
                            onChange={(z) => ustaw(w.wariantId, "stanAllegro", z.target.value)}
                            className={`${pole} w-16`}
                          />
                          {zmiana?.stanAllegro !== undefined ? (
                            <p className="mt-1 text-right text-xs text-[#111827]/45">
                              było {w.stanAllegro === null ? "—" : w.stanAllegro}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-[#111827]/35">—</span>
                      )}
                    </td>

                    {/* Notatka sprzedawcy i zakaz sprzedaży na Allegro — obie
                        siedzą w metadanych produktu i nigdzie nie wychodzą
                        do sklepu. */}
                    <td className="px-3 py-3 align-top">
                      <textarea
                        rows={2}
                        value={wpis.notatka ?? w.notatka}
                        onChange={(z) => ustaw(w.wariantId, "notatka", z.target.value)}
                        placeholder="np. czekamy na dostawę, cena od dostawcy do potwierdzenia…"
                        className={`${pole} h-auto resize-y text-left`}
                      />

                      <label className="mt-2 flex items-start gap-2 text-xs text-[#111827]/55">
                        <input
                          type="checkbox"
                          checked={wpis.bezAllegro ?? w.bezAllegro}
                          onChange={(z) => ustawZnacznik(w.wariantId, "bezAllegro", z.target.checked)}
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
                    </td>
                  </tr>
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
              i od tej chwili będą chodzić razem.
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
                    <select
                      value=""
                      disabled={laczy === oferta.id}
                      onChange={(z) => polacz(oferta.id, z.target.value)}
                      className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 text-sm outline-none focus:border-[#2E64A8] disabled:opacity-50"
                    >
                      <option value="">
                        {laczy === oferta.id ? "łączę…" : "— wybierz produkt —"}
                      </option>
                      {bezOferty.map((w) => (
                        <option key={w.wariantId} value={w.sku}>
                          {w.tytul} · {w.sku}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              onClick={zapisz}
              disabled={zapisuje}
              className="rounded-md bg-[#2E64A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-60"
            >
              {zapisuje ? "Zapisuję…" : "Zapisz zmiany"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
