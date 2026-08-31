"use client"

import { useCallback, useEffect, useState } from "react"

type Wariant = { id: string; tytul: string; sku: string; cena: number }

type Produkt = {
  id: string
  tytul: string
  handle: string
  kategoria: string
  zdjecie: string
  dostepnosc: string
  sztuki: number | null
  ean: string
  warianty: Wariant[]
}

type Kategoria = { id: string; name: string }

const DOSTEPNOSCI = [
  { klucz: "", nazwa: "— zgaduje po marce —" },
  { klucz: "od-reki", nazwa: "Od ręki" },
  { klucz: "2-3-dni", nazwa: "2–3 dni" },
  { klucz: "7-10-dni", nazwa: "7–10 dni" },
  { klucz: "14-dni", nazwa: "Do 14 dni" },
  { klucz: "na-zamowienie", nazwa: "Na zamówienie" },
  { klucz: "niedostepny", nazwa: "Niedostępny" },
]

/** Zmiany trzymamy osobno od danych, żeby dało się pokazać „było → ma być”. */
type Zmiana = { cena?: string; dostepnosc?: string; sztuki?: string; ean?: string }

function zloty(kwota: number) {
  return kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Produkty() {
  const [produkty, setProdukty] = useState<Produkt[]>([])
  const [kategorie, setKategorie] = useState<Kategoria[]>([])
  const [ile, setIle] = useState(0)
  const [strona, setStrona] = useState(0)
  const [szukaj, setSzukaj] = useState("")
  const [kategoria, setKategoria] = useState("")
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [zmiany, setZmiany] = useState<Record<string, Zmiana>>({})
  const [zapisuje, setZapisuje] = useState(false)
  const [wynik, setWynik] = useState<{ zapisane: number; bledy: { tytul: string; blad: string }[] } | null>(null)

  const pobierz = useCallback(async (nowaStrona: number, fraza: string, dzial: string) => {
    setStan("laduje")
    setBlad("")

    try {
      const parametry = new URLSearchParams({ strona: String(nowaStrona) })
      if (fraza) parametry.set("szukaj", fraza)
      if (dzial) parametry.set("kategoria", dzial)

      const odpowiedz = await fetch(`/api/admin/produkty?${parametry}`)
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

      setProdukty(dane.produkty || [])
      setKategorie(dane.kategorie || [])
      setIle(dane.ile || 0)
      setStan("gotowe")
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

  useEffect(() => {
    pobierz(strona, szukaj, kategoria)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strona, kategoria])

  function ustaw(id: string, pole: keyof Zmiana, wartosc: string) {
    setZmiany((teraz) => ({ ...teraz, [id]: { ...teraz[id], [pole]: wartosc } }))
    setWynik(null)
  }

  /** Zmiana liczy się tylko wtedy, gdy różni się od tego, co jest w bazie. */
  function zmienione(produkt: Produkt): Zmiana | null {
    const z = zmiany[produkt.id]
    if (!z) return null

    const wynik: Zmiana = {}
    const cenaTeraz = produkt.warianty[0]?.cena ?? 0

    if (z.cena !== undefined && z.cena !== "" && Number(z.cena) !== cenaTeraz) wynik.cena = z.cena
    if (z.dostepnosc !== undefined && z.dostepnosc !== produkt.dostepnosc) wynik.dostepnosc = z.dostepnosc
    if (z.sztuki !== undefined && z.sztuki !== (produkt.sztuki === null ? "" : String(produkt.sztuki))) {
      wynik.sztuki = z.sztuki
    }
    if (z.ean !== undefined && z.ean !== produkt.ean) wynik.ean = z.ean

    return Object.keys(wynik).length ? wynik : null
  }

  const doZapisu = produkty
    .map((produkt) => ({ produkt, zmiana: zmienione(produkt) }))
    .filter((pozycja): pozycja is { produkt: Produkt; zmiana: Zmiana } => Boolean(pozycja.zmiana))

  async function zapisz() {
    setZapisuje(true)
    setWynik(null)

    try {
      const odpowiedz = await fetch("/api/admin/produkty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zmiany: doZapisu.map(({ produkt, zmiana }) => ({
            id: produkt.id,
            tytul: produkt.tytul,
            wariantId: produkt.warianty[0]?.id,
            ...(zmiana.cena !== undefined ? { cena: Number(zmiana.cena) } : {}),
            ...(zmiana.dostepnosc !== undefined ? { dostepnosc: zmiana.dostepnosc } : {}),
            ...(zmiana.sztuki !== undefined ? { sztuki: zmiana.sztuki } : {}),
            ...(zmiana.ean !== undefined ? { ean: zmiana.ean } : {}),
          })),
        }),
      })

      const dane = await odpowiedz.json()

      if (!dane.ok) {
        setWynik({ zapisane: 0, bledy: [{ tytul: "", blad: dane.blad || "Nie udało się." }] })
        return
      }

      setWynik({ zapisane: (dane.zapisane || []).length, bledy: dane.bledy || [] })
      setZmiany({})
      await pobierz(strona, szukaj, kategoria)
    } catch {
      setWynik({ zapisane: 0, bledy: [{ tytul: "", blad: "Brak połączenia z serwerem." }] })
    } finally {
      setZapisuje(false)
    }
  }

  const stron = Math.ceil(ile / 50)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(zdarzenie) => {
            zdarzenie.preventDefault()
            setStrona(0)
            pobierz(0, szukaj, kategoria)
          }}
          className="flex gap-2"
        >
          <input
            value={szukaj}
            onChange={(zdarzenie) => setSzukaj(zdarzenie.target.value)}
            placeholder="Nazwa albo SKU…"
            className="w-64 rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
          />
          <button
            type="submit"
            className="rounded-md bg-[#2E64A8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F]"
          >
            Szukaj
          </button>
        </form>

        <select
          value={kategoria}
          onChange={(zdarzenie) => {
            setStrona(0)
            setKategoria(zdarzenie.target.value)
          }}
          className="rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
        >
          <option value="">Wszystkie kategorie</option>
          {kategorie.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm text-[#111827]/45">{ile} produktów</span>
      </div>

      {stan === "blad" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{blad}</p>
      ) : null}

      {stan === "laduje" ? <p className="text-sm text-[#111827]/50">Wczytuję…</p> : null}

      {wynik ? (
        <div
          className={`mb-5 rounded-md border p-4 text-sm ${
            wynik.bledy.length ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"
          }`}
        >
          <p className="font-semibold">
            {wynik.zapisane ? `Zapisane: ${wynik.zapisane}.` : "Nic nie zapisano."}
            {wynik.bledy.length ? ` Nie udało się: ${wynik.bledy.length}.` : ""}
          </p>
          {wynik.bledy.map((b, numer) => (
            <p key={numer} className="mt-1 text-[#111827]/70">
              {b.tytul ? `${b.tytul}: ` : ""}
              {b.blad}
            </p>
          ))}
        </div>
      ) : null}

      {stan === "gotowe" ? (
        <div className="overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                <th className="px-4 py-3 font-semibold">Produkt</th>
                <th className="w-36 px-3 py-3 font-semibold">Cena brutto</th>
                <th className="w-44 px-3 py-3 font-semibold">Dostępność</th>
                <th className="w-24 px-3 py-3 font-semibold">Sztuk</th>
                <th className="w-44 px-3 py-3 font-semibold">EAN</th>
              </tr>
            </thead>
            <tbody>
              {produkty.map((produkt) => {
                const wariant = produkt.warianty[0]
                const zmiana = zmienione(produkt)
                const z = zmiany[produkt.id] || {}

                return (
                  <tr
                    key={produkt.id}
                    className={`border-b border-[#111827]/6 last:border-0 ${
                      zmiana ? "bg-[#2E64A8]/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {produkt.zdjecie ? (
                          <img
                            src={produkt.zdjecie}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded object-contain"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded bg-[#111827]/5" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{produkt.tytul}</p>
                          <p className="truncate text-xs text-[#111827]/40">
                            {produkt.kategoria}
                            {wariant?.sku ? ` · ${wariant.sku}` : ""}
                            {produkt.warianty.length > 1
                              ? ` · ${produkt.warianty.length} wersje`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {wariant ? (
                        <>
                          <input
                            inputMode="decimal"
                            value={z.cena ?? String(wariant.cena)}
                            onChange={(zdarzenie) => ustaw(produkt.id, "cena", zdarzenie.target.value)}
                            className="w-28 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"
                          />
                          {zmiana?.cena ? (
                            <p className="mt-1 text-right text-xs text-[#111827]/45">
                              było {zloty(wariant.cena)}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-[#111827]/35">bez wariantu</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <select
                        value={z.dostepnosc ?? produkt.dostepnosc}
                        onChange={(zdarzenie) => ustaw(produkt.id, "dostepnosc", zdarzenie.target.value)}
                        className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 outline-none focus:border-[#2E64A8]"
                      >
                        {DOSTEPNOSCI.map((pozycja) => (
                          <option key={pozycja.klucz} value={pozycja.klucz}>
                            {pozycja.nazwa}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-3">
                      <input
                        inputMode="numeric"
                        value={z.sztuki ?? (produkt.sztuki === null ? "" : String(produkt.sztuki))}
                        onChange={(zdarzenie) => ustaw(produkt.id, "sztuki", zdarzenie.target.value)}
                        className="w-16 rounded-md border border-[#111827]/15 px-2 py-1.5 text-right tabular-nums outline-none focus:border-[#2E64A8]"
                      />
                    </td>

                    <td className="px-3 py-3">
                      <input
                        value={z.ean ?? produkt.ean}
                        onChange={(zdarzenie) => ustaw(produkt.id, "ean", zdarzenie.target.value)}
                        className="w-full rounded-md border border-[#111827]/15 px-2 py-1.5 tabular-nums outline-none focus:border-[#2E64A8]"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {stron > 1 ? (
        <div className="mt-6 flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={strona === 0}
            onClick={() => setStrona((teraz) => teraz - 1)}
            className="rounded-md border border-[#111827]/15 px-3 py-2 disabled:opacity-40"
          >
            ← Poprzednie
          </button>
          <span className="text-[#111827]/50">
            {strona + 1} z {stron}
          </span>
          <button
            type="button"
            disabled={strona + 1 >= stron}
            onClick={() => setStrona((teraz) => teraz + 1)}
            className="rounded-md border border-[#111827]/15 px-3 py-2 disabled:opacity-40"
          >
            Następne →
          </button>
        </div>
      ) : null}

      {/* Pasek zapisu siedzi na dole ekranu, bo przy pięćdziesięciu wierszach
          przycisk pod tabelą jest poza zasięgiem wzroku dokładnie wtedy,
          kiedy się go potrzebuje. */}
      {doZapisu.length ? (
        <div className="sticky bottom-0 z-30 -mx-5 mt-6 border-t border-[#111827]/10 bg-white px-5 py-4 md:-mx-8 md:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm">
              <strong>{doZapisu.length}</strong>{" "}
              {doZapisu.length === 1 ? "produkt do zapisania" : "produktów do zapisania"}
            </p>

            <p className="min-w-0 flex-1 truncate text-sm text-[#111827]/45">
              {doZapisu.map(({ produkt }) => produkt.tytul).join(", ")}
            </p>

            <button
              type="button"
              onClick={() => setZmiany({})}
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
