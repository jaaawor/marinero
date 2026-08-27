"use client"

import { useEffect, useState } from "react"

type Fraza = { fraza: string; ile: number; bezWynikow: number; gdzie?: string }
type Koszyk = {
  id: string
  email: string
  zmieniony: string
  suma: number
  waluta: string
  pozycje: { tytul: string; ile: number }[]
}
type Dane = {
  szukania:
    | { dostepne: true; dni: number; razem: number; lodzie: Fraza[]; sklep: Fraza[]; bezWynikow: Fraza[] }
    | { dostepne: false; powod: string }
  koszyki: { dostepne: true; koszyki: Koszyk[] } | { dostepne: false; powod: string }
}

function kiedy(iso: string) {
  const minut = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minut < 1) return "przed chwilą"
  if (minut < 60) return `${minut} min temu`
  const godzin = Math.round(minut / 60)
  if (godzin < 24) return `${godzin} godz. temu`
  return `${Math.round(godzin / 24)} dni temu`
}

function Tabela({ tytul, lead, frazy }: { tytul: string; lead: string; frazy: Fraza[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{tytul}</h2>
      <p className="mt-2 text-sm leading-7 text-[#111827]/55">{lead}</p>
      {frazy.length ? (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {frazy.map((wpis) => (
              <tr key={wpis.fraza} className="border-b border-[#111827]/5 last:border-0">
                <td className="py-2">{wpis.fraza}</td>
                <td className="w-24 py-2 text-right tabular-nums text-[#111827]/50">{wpis.ile}×</td>
                <td className="w-32 py-2 text-right text-xs text-[#b45309]">
                  {wpis.bezWynikow ? `${wpis.bezWynikow}× bez wyników` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-[#111827]/40">Jeszcze nic — statystyka zbiera się od dziś.</p>
      )}
    </div>
  )
}

export default function Statystyki() {
  const [dane, setDane] = useState<Dane | null>(null)
  const [dni, setDni] = useState(30)
  const [blad, setBlad] = useState("")

  useEffect(() => {
    setDane(null)
    fetch(`/api/admin/statystyki?dni=${dni}`)
      .then(async (odpowiedz) => {
        const tresc = await odpowiedz.json()
        if (!odpowiedz.ok) throw new Error(tresc?.error || "Nie udało się pobrać danych")
        setDane(tresc)
      })
      .catch((error) => setBlad(error.message))
  }, [dni])

  if (blad) return <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm">{blad}</p>
  if (!dane) return <p className="text-sm text-[#111827]/50">Liczę…</p>

  const s = dane.szukania
  const k = dane.koszyki

  return (
    <>
      <div className="mb-8 flex gap-2">
        {[7, 30, 90].map((ile) => (
          <button
            key={ile}
            onClick={() => setDni(ile)}
            className={`rounded-sm px-4 py-2 text-sm ${
              ile === dni ? "bg-[#2E64A8] text-white" : "border border-[#111827]/15"
            }`}
          >
            {ile} dni
          </button>
        ))}
      </div>

      {s.dostepne ? (
        <>
          <p className="mb-8 text-sm text-[#111827]/60">
            Zapisanych wyszukiwań w tym okresie: <strong>{s.razem}</strong>.
          </p>

          {s.bezWynikow.length ? (
            <div className="mb-10 rounded-lg border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold">Szukali i nic nie znaleźli</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/65">
                Najkonkretniejsza rzecz na tej stronie: ludzie wpisali to i dostali pustą listę.
                Albo nie mamy tego towaru, albo nazywa się u nas inaczej niż go szukają.
              </p>
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {s.bezWynikow.map((wpis) => (
                    <tr key={`${wpis.gdzie}-${wpis.fraza}`} className="border-b border-amber-200/60 last:border-0">
                      <td className="py-2">{wpis.fraza}</td>
                      <td className="w-20 py-2 text-xs text-[#111827]/45">
                        {wpis.gdzie === "sklep" ? "sklep" : "łodzie"}
                      </td>
                      <td className="w-32 py-2 text-right tabular-nums">{wpis.bezWynikow}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid gap-10 lg:grid-cols-2">
            <Tabela
              tytul="Czego szukają na stronie z łodziami"
              lead="Wyszukiwarka w nagłówku — nazwy modeli i marek."
              frazy={s.lodzie}
            />
            <Tabela
              tytul="Czego szukają w sklepie"
              lead="Wyszukiwarka sklepu — części, silniki, elektronika."
              frazy={s.sklep}
            />
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm">
          Statystyka wyszukiwań niedostępna ({s.powod}).
        </p>
      )}

      <div className="mt-14">
        <h2 className="text-lg font-semibold">Koszyki w tej chwili</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/55">
          Niedokończone koszyki z towarem w środku — ktoś jest w trakcie zakupów albo
          się rozmyślił. Koszyk z adresem e-mail to ktoś, kto zaczął wypełniać zamówienie.
        </p>

        {k.dostepne ? (
          k.koszyki.length ? (
            <div className="mt-5 overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-wider text-[#111827]/45">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ostatni ruch</th>
                    <th className="px-4 py-3 font-semibold">W koszyku</th>
                    <th className="px-4 py-3 font-semibold">Kontakt</th>
                    <th className="px-4 py-3 text-right font-semibold">Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {k.koszyki.map((koszyk) => (
                    <tr key={koszyk.id} className="border-b border-[#111827]/5 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-[#111827]/60">
                        {kiedy(koszyk.zmieniony)}
                      </td>
                      <td className="px-4 py-3">
                        {koszyk.pozycje.map((p) => `${p.ile} × ${p.tytul}`).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-[#111827]/60">{koszyk.email || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {koszyk.suma.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} {koszyk.waluta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 text-sm text-[#111827]/40">Żaden koszyk nie czeka niedokończony.</p>
          )
        ) : (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm leading-7">
            Nie mam dostępu do koszyków ({k.powod}).{" "}
            {k.powod === "brak_tokenu_medusy"
              ? "Brakuje MEDUSA_ADMIN_TOKEN w .env.local na serwerze."
              : "Medusa odrzuciła zapytanie — możliwe, że ta wersja nie wystawia listy koszyków przez API."}
          </p>
        )}
      </div>
    </>
  )
}
