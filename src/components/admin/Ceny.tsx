"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { canReadInBrowser, readSpreadsheetInBrowser } from "@/lib/xlsx-browser"

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
  cenaSklep: number | null
  ofertaId: string
  nazwaAllegro: string
  cenaAllegro: number | null
  stanAllegro: number | null
}

/** Wpisane wartości trzymamy osobno od danych, żeby pokazać „było → ma być". */
type Wpis = { sklep?: string; allegro?: string }

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
  const plik = useRef<HTMLInputElement>(null)

  const pobierz = useCallback(async (odswiez = false) => {
    setStan("laduje")
    setBlad("")
    try {
      const odpowiedz = await fetch(`/api/admin/ceny${odswiez ? "?odswiez=1" : ""}`)
      const dane = await odpowiedz.json()

      if (!dane.dostepne) {
        setStan("blad")
        setBlad(
          dane.powod === "brak_klucza_medusy"
            ? "Brak klucza do Medusy. Dopisz MEDUSA_ADMIN_TOKEN do .env.local na serwerze."
            : dane.blad || "Medusa nie odpowiada."
        )
        return
      }

      setWiersze(dane.wiersze || [])
      setAllegroDziala(Boolean(dane.allegroDziala))
      setStan("gotowe")
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

  useEffect(() => {
    pobierz()
  }, [pobierz])

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
        <p className="text-sm text-[#111827]/50">Wczytuję ceny ze sklepu i z Allegro…</p>
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
