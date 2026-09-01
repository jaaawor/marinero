"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { canReadInBrowser, readSpreadsheetInBrowser } from "@/lib/xlsx-browser"
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
  ofertaId: string
  nazwaAllegro: string
  cenaAllegro: number | null
  stanAllegro: number | null
}

/** Wpisane wartości trzymamy osobno od danych, żeby pokazać „było → ma być". */
type Wpis = { sklep?: string; allegro?: string }

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
  const [allegroDziala, setAllegroDziala] = useState(false)
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [szukaj, setSzukaj] = useState("")
  const [filtr, setFiltr] = useState<"wszystkie" | "allegro" | "bez-allegro" | "rozne">("wszystkie")
  const [wpisy, setWpisy] = useState<Record<string, Wpis>>({})
  const [zapisuje, setZapisuje] = useState(false)
  const [wynik, setWynik] = useState<{
    sklep: number
    allegro: number
    bledy: { co: string; tytul: string; blad: string }[]
  } | null>(null)
  const [zImportu, setZImportu] = useState(0)
  const [postep, setPostep] = useState<{ procent: number; opis: string }>({
    procent: 0,
    opis: "",
  })
  const [reguly, setReguly] = useState<ReguleKanalu | null>(null)
  const [regulyOtwarte, setRegulyOtwarte] = useState(false)
  const [regulyStan, setRegulyStan] = useState("")
  const plik = useRef<HTMLInputElement>(null)

  const pobierz = useCallback(async (odswiez = false) => {
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
      setAllegroDziala(Boolean(dane.allegroDziala))
      setPostep({ procent: 100, opis: "" })
      setStan("gotowe")
    }

    try {
      // Zestawienie to kilkanaście sekund pracy serwera, więc odpowiedź leci
      // strumieniem: kolejne linijki niosą postęp, ostatnia komplet danych.
      const odpowiedz = await fetch(
        `/api/admin/ceny?strumien=1${odswiez ? "&odswiez=1" : ""}`
      )

      if (!odpowiedz.body) {
        // Przeglądarka bez strumieni albo pośrednik, który go zwinął —
        // pytamy po staremu, bez paska. Lepiej bez paska niż wcale.
        const zapasowo = await fetch(`/api/admin/ceny${odswiez ? "?odswiez=1" : ""}`)
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
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

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

  /** Zmiana liczy się tylko wtedy, gdy różni się od tego, co jest w bazie. */
  const doZapisu = useMemo(() => {
    const lista: { wiersz: Wiersz; sklep?: number; allegro?: number }[] = []

    for (const wiersz of wiersze) {
      const wpis = wpisy[wiersz.wariantId]
      if (!wpis) continue

      const sklep = wpis.sklep !== undefined ? liczba(wpis.sklep) : null
      const allegro = wpis.allegro !== undefined ? liczba(wpis.allegro) : null

      const zmianaSklep = sklep !== null && sklep !== wiersz.cenaSklep ? sklep : undefined
      const zmianaAllegro =
        allegro !== null && wiersz.ofertaId && allegro !== wiersz.cenaAllegro ? allegro : undefined

      if (zmianaSklep !== undefined || zmianaAllegro !== undefined) {
        lista.push({ wiersz, sklep: zmianaSklep, allegro: zmianaAllegro })
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
      const kSklep = naglowki.findIndex((n) => n.includes("sklep"))
      const kAllegro = naglowki.findIndex((n) => n.includes("cena allegro"))

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
          zmiany: doZapisu.map(({ wiersz, sklep, allegro }) => ({
            sku: wiersz.sku,
            tytul: wiersz.tytul,
            handle: wiersz.handle,
            produktId: wiersz.produktId,
            wariantId: wiersz.wariantId,
            ofertaId: wiersz.ofertaId,
            ...(sklep !== undefined ? { cenaSklep: sklep } : {}),
            ...(allegro !== undefined ? { cenaAllegro: allegro } : {}),
          })),
        }),
      })

      const dane = await odpowiedz.json()

      if (!dane.ok) {
        setWynik({ sklep: 0, allegro: 0, bledy: [{ co: "", tytul: "", blad: dane.blad || "Nie udało się." }] })
        return
      }

      setWynik({ sklep: dane.zapisane.sklep, allegro: dane.zapisane.allegro, bledy: dane.bledy || [] })
      setWpisy({})
      setZImportu(0)
      await pobierz(true)
    } catch {
      setWynik({ sklep: 0, allegro: 0, bledy: [{ co: "", tytul: "", blad: "Brak połączenia." }] })
    } finally {
      setZapisuje(false)
    }
  }

  const widoczne = useMemo(() => {
    const fraza = szukaj.toLowerCase().trim()

    return wiersze.filter((w) => {
      if (fraza && !`${w.tytul} ${w.sku}`.toLowerCase().includes(fraza)) return false
      if (filtr === "allegro") return Boolean(w.ofertaId)
      if (filtr === "bez-allegro") return !w.ofertaId
      if (filtr === "rozne") {
        return Boolean(w.ofertaId) && w.cenaSklep !== null && w.cenaAllegro !== w.cenaSklep
      }
      return true
    })
  }, [wiersze, szukaj, filtr])

  const naAllegro = wiersze.filter((w) => w.ofertaId).length
  const rozne = wiersze.filter(
    (w) => w.ofertaId && w.cenaSklep !== null && w.cenaAllegro !== w.cenaSklep
  ).length

  const pole =
    "w-24 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"
  const poleReguly =
    "w-24 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"

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
            { klucz: "bez-allegro" as const, nazwa: "Poza Allegro" },
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
            Zapisane — sklep: {wynik.sklep}, Allegro: {wynik.allegro}.
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
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{blad}</p>
      ) : null}

      {stan === "gotowe" ? (
        <div className="overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                <th className="px-4 py-3 font-semibold">Produkt</th>
                <th className="w-36 px-3 py-3 font-semibold">Cena sklep</th>
                <th className="w-36 px-3 py-3 font-semibold">Cena Allegro</th>
                <th className="w-28 px-3 py-3 font-semibold">Różnica</th>
              </tr>
            </thead>
            <tbody>
              {widoczne.map((w) => {
                const wpis = wpisy[w.wariantId] || {}
                const zmiana = doZapisu.find((z) => z.wiersz.wariantId === w.wariantId)
                const roznica =
                  w.cenaSklep !== null && w.cenaAllegro !== null ? w.cenaAllegro - w.cenaSklep : null

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
                        <p className="mt-1 text-right text-xs text-[#111827]/45">
                          było {zloty(w.cenaSklep)}
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
                            <p className="mt-1 text-right text-xs text-[#111827]/45">
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

      {doZapisu.length ? (
        <div className="sticky bottom-0 z-30 -mx-5 mt-6 border-t border-[#111827]/10 bg-white px-5 py-4 md:-mx-8 md:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm">
              <strong>{doZapisu.length}</strong> do zapisania —{" "}
              {doZapisu.filter((z) => z.sklep !== undefined).length} w sklepie,{" "}
              {doZapisu.filter((z) => z.allegro !== undefined).length} na Allegro
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
              {zapisuje ? "Zapisuję…" : "Zapisz ceny"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
