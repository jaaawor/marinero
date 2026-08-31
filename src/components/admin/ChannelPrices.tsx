"use client"

import { useEffect, useMemo, useState } from "react"

type Wiersz = {
  sku: string
  handle: string
  tytul: string
  cenaSklep: number | null
  cenaAllegro: number | null
  stanAllegro: number | null
  ofertaId: string | null
  cenaWgReguly: number | null
  roznica: number | null
}

type Dane = {
  polaczono: boolean
  blad: string
  produktow: number
  ofert: number
  wiersze: Wiersz[]
  bezProduktu: { id: string; nazwa: string; sku: string; cena: number }[]
}

function zl(wartosc: number | null) {
  if (typeof wartosc !== "number") return "—"
  return wartosc.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł"
}

export default function ChannelPrices() {
  const [dane, setDane] = useState<Dane | null>(null)
  const [blad, setBlad] = useState("")
  const [tylkoNaAllegro, setTylkoNaAllegro] = useState(true)
  const [szukaj, setSzukaj] = useState("")

  useEffect(() => {
    fetch("/api/admin/kanaly")
      .then(async (odpowiedz) => {
        const tresc = await odpowiedz.json()
        if (!odpowiedz.ok) throw new Error(tresc?.error || "Nie udało się pobrać danych")
        setDane(tresc)
      })
      .catch((error) => setBlad(error.message))
  }, [])

  const widoczne = useMemo(() => {
    if (!dane) return []
    const fraza = szukaj.trim().toLowerCase()
    return dane.wiersze.filter((wiersz) => {
      if (tylkoNaAllegro && !wiersz.ofertaId) return false
      if (!fraza) return true
      return (
        wiersz.tytul.toLowerCase().includes(fraza) || wiersz.sku.toLowerCase().includes(fraza)
      )
    })
  }, [dane, tylkoNaAllegro, szukaj])

  if (blad) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm">{blad}</p>
  }

  if (!dane) {
    return <p className="text-sm text-[#111827]/50">Pobieram oferty z Allegro…</p>
  }

  return (
    <>
      {!dane.polaczono ? (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm leading-7">
          <p className="font-semibold">Konto Allegro jeszcze niepodpięte.</p>
          <p className="mt-2 text-[#111827]/70">
            {dane.blad === "brak_danych_allegro"
              ? "Brakuje ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET na serwerze. Refresh token wydaje autoryzacja: node --env-file=.env.local scripts/allegro/autoryzuj.mjs"
              : dane.blad}
          </p>
          <p className="mt-2 text-[#111827]/70">
            Poniżej i tak widać ceny sklepowe i to, ile wyszłoby z reguł — kolumna
            „na Allegro" zapełni się po podpięciu konta.
          </p>
        </div>
      ) : (
        <p className="mb-6 text-sm text-[#111827]/60">
          Pobrano <strong>{dane.ofert}</strong> ofert z Allegro i{" "}
          <strong>{dane.produktow}</strong> produktów ze sklepu.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <input
          value={szukaj}
          onChange={(zdarzenie) => setSzukaj(zdarzenie.target.value)}
          placeholder="Szukaj po nazwie albo SKU"
          className="w-72 rounded-sm border border-[#111827]/15 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-[#111827]/70">
          <input
            type="checkbox"
            checked={tylkoNaAllegro}
            onChange={(zdarzenie) => setTylkoNaAllegro(zdarzenie.target.checked)}
          />
          tylko to, co stoi na Allegro
        </label>
        <span className="text-sm text-[#111827]/45">{widoczne.length} pozycji</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-wider text-[#111827]/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Produkt</th>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 text-right font-semibold">Sklep</th>
              <th className="px-4 py-3 text-right font-semibold">Na Allegro</th>
              <th className="px-4 py-3 text-right font-semibold">Wg reguły</th>
              <th className="px-4 py-3 text-right font-semibold">Różnica</th>
              <th className="px-4 py-3 text-right font-semibold">Stan</th>
            </tr>
          </thead>
          <tbody>
            {widoczne.map((wiersz) => (
              <tr key={wiersz.handle} className="border-b border-[#111827]/5 last:border-0">
                <td className="px-4 py-3">
                  <a
                    href={`/sklep/produkt/${wiersz.handle}`}
                    className="hover:text-[#2E64A8]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {wiersz.tytul}
                  </a>
                </td>
                <td className="px-4 py-3 text-[#111827]/50">{wiersz.sku || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{zl(wiersz.cenaSklep)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {zl(wiersz.cenaAllegro)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#111827]/55">
                  {zl(wiersz.cenaWgReguly)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    wiersz.roznica && Math.abs(wiersz.roznica) >= 1
                      ? "font-semibold text-[#b45309]"
                      : "text-[#111827]/40"
                  }`}
                >
                  {typeof wiersz.roznica === "number"
                    ? `${wiersz.roznica > 0 ? "+" : ""}${zl(wiersz.roznica)}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#111827]/55">
                  {wiersz.stanAllegro ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dane.bezProduktu.length ? (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">
            Oferty bez pary w sklepie ({dane.bezProduktu.length})
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/60">
            Oferta łączy się z produktem po <strong>sygnaturze sprzedawcy</strong> — w Allegro
            trzeba w niej wpisać SKU. Te oferty jej nie mają albo mają SKU, którego nie ma
            w sklepie, więc synchronizacja cen ich nie ruszy.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-[#111827]/70">
            {dane.bezProduktu.map((oferta) => (
              <li key={oferta.id}>
                {oferta.nazwa} — {zl(oferta.cena)}
                {oferta.sku ? ` (sygnatura: ${oferta.sku})` : " (bez sygnatury)"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}
