"use client"

import { useCallback, useEffect, useState } from "react"

type Pozycja = { id: string; nazwa: string; sygnatura: string; ile: number; cena: number }

type Zamowienie = {
  id: string
  numer: string
  zlozone: string
  stan: string
  oplacone: boolean
  kwota: number
  kupujacy: { login: string; imie: string; email: string }
  dostawa: { nazwa: string; adres: string; punkt: string }
  pozycje: Pozycja[]
}

type Przewoznik = { id: string; nazwa: string }

// Nazwy stanów po polsku — w API Allegro są po angielsku, a sprzedawca ma
// czytać, nie tłumaczyć.
const STANY: Record<string, string> = {
  NEW: "Nowe",
  PROCESSING: "W realizacji",
  READY_FOR_SHIPMENT: "Gotowe do wysyłki",
  READY_FOR_PICKUP: "Gotowe do odbioru",
  SENT: "Wysłane",
  PICKED_UP: "Odebrane",
  CANCELLED: "Anulowane",
  SUSPENDED: "Wstrzymane",
}

const FILTRY = [
  { klucz: "READY_FOR_PROCESSING", nazwa: "Do obsłużenia" },
  { klucz: "wszystkie", nazwa: "Wszystkie" },
]

function zloty(kwota: number) {
  return `${kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`
}

function kiedy(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })
}

export default function AllegroOrders() {
  const [filtr, setFiltr] = useState("READY_FOR_PROCESSING")
  const [dane, setDane] = useState<{
    dostepne: boolean
    powod?: string
    zamowienia?: Zamowienie[]
    przewoznicy?: Przewoznik[]
  } | null>(null)
  const [pracuje, setPracuje] = useState("")
  const [komunikat, setKomunikat] = useState("")
  const [przesylka, setPrzesylka] = useState<Record<string, { przewoznik: string; numer: string }>>({})

  const wczytaj = useCallback(() => {
    setDane(null)
    fetch(`/api/kanaly/zamowienia?status=${encodeURIComponent(filtr)}`)
      .then((odpowiedz) => odpowiedz.json())
      .then(setDane)
      .catch(() => setDane({ dostepne: false, powod: "polaczenie" }))
  }, [filtr])

  useEffect(() => {
    wczytaj()
  }, [wczytaj])

  async function wyslijZmiane(id: string, tresc: Record<string, string>) {
    setPracuje(id)
    setKomunikat("")

    const wynik = await fetch("/api/kanaly/zamowienia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...tresc }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false, powod: "polaczenie" }))

    setPracuje("")

    if (!wynik.ok) {
      setKomunikat(`Nie udało się: ${wynik.powod || "błąd"}`)
      return
    }

    setKomunikat("Zapisane w Allegro.")
    wczytaj()
  }

  if (!dane) return <p className="text-sm text-[#111827]/50">Wczytuję zamówienia…</p>

  if (!dane.dostepne) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm leading-7">
        Nie mam dostępu do zamówień ({dane.powod}).{" "}
        {dane.powod === "brak_kluczy_allegro"
          ? "Brakuje ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET i ALLEGRO_REFRESH_TOKEN w .env.local na serwerze."
          : "Allegro odrzuciło zapytanie. Jeżeli mowa o tokenie, przejdź autoryzację od nowa na serwerze: node --env-file=.env.local scripts/allegro/autoryzuj.mjs"}
      </p>
    )
  }

  const zamowienia = dane.zamowienia || []
  const przewoznicy = dane.przewoznicy || []

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {FILTRY.map((pozycja) => (
          <button
            key={pozycja.klucz}
            type="button"
            onClick={() => setFiltr(pozycja.klucz)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filtr === pozycja.klucz
                ? "bg-[#111827] text-white"
                : "border border-[#111827]/15 text-[#111827]/70 hover:border-[#111827]/40"
            }`}
          >
            {pozycja.nazwa}
          </button>
        ))}

        <button
          type="button"
          onClick={wczytaj}
          className="ml-auto text-sm font-medium text-[#2E64A8] hover:underline"
        >
          Odśwież
        </button>
      </div>

      {komunikat ? <p className="mb-5 text-sm text-[#111827]/70">{komunikat}</p> : null}

      {!zamowienia.length ? (
        <p className="text-sm text-[#111827]/40">Brak zamówień w tym widoku.</p>
      ) : null}

      <div className="space-y-4">
        {zamowienia.map((zamowienie) => {
          const wpis = przesylka[zamowienie.id] || { przewoznik: przewoznicy[0]?.id || "", numer: "" }
          const zajete = pracuje === zamowienie.id

          return (
            <div key={zamowienie.id} className="rounded-lg border border-[#111827]/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">
                    {zamowienie.kupujacy.imie || zamowienie.kupujacy.login}{" "}
                    <span className="font-normal text-[#111827]/45">
                      · {kiedy(zamowienie.zlozone)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-[#111827]/60">
                    {zamowienie.dostawa.nazwa}
                    {zamowienie.dostawa.punkt ? ` · punkt ${zamowienie.dostawa.punkt}` : ""}
                    {zamowienie.dostawa.adres ? ` · ${zamowienie.dostawa.adres}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold tabular-nums">{zloty(zamowienie.kwota)}</p>
                  <p className="mt-1 text-xs">
                    <span className="rounded-full bg-[#111827]/5 px-2 py-1">
                      {STANY[zamowienie.stan] || zamowienie.stan}
                    </span>{" "}
                    {/* Nieopłacone zamówienie wygląda tak samo jak opłacone,
                        dopóki ktoś nie wejdzie w szczegóły — dlatego mówimy
                        o tym wprost, obok stanu realizacji. */}
                    <span
                      className={`rounded-full px-2 py-1 ${
                        zamowienie.oplacone
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-amber-500/15 text-amber-800"
                      }`}
                    >
                      {zamowienie.oplacone ? "opłacone" : "nieopłacone"}
                    </span>
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-1 text-sm text-[#111827]/70">
                {zamowienie.pozycje.map((pozycja) => (
                  <li key={pozycja.id}>
                    {pozycja.ile} × {pozycja.nazwa}
                    {pozycja.sygnatura ? (
                      <span className="text-[#111827]/40"> · {pozycja.sygnatura}</span>
                    ) : (
                      <span className="text-amber-700"> · bez sygnatury</span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#111827]/5 pt-4">
                <button
                  type="button"
                  disabled={zajete}
                  onClick={() => wyslijZmiane(zamowienie.id, { stan: "PROCESSING" })}
                  className="rounded-full border border-[#111827]/15 px-4 py-2 text-sm transition hover:border-[#111827]/40 disabled:opacity-40"
                >
                  Przyjmij do realizacji
                </button>

                <select
                  value={wpis.przewoznik}
                  onChange={(zdarzenie) =>
                    setPrzesylka((stan) => ({
                      ...stan,
                      [zamowienie.id]: { ...wpis, przewoznik: zdarzenie.target.value },
                    }))
                  }
                  className="rounded-full border border-[#111827]/15 px-3 py-2 text-sm"
                >
                  {przewoznicy.map((przewoznik) => (
                    <option key={przewoznik.id} value={przewoznik.id}>
                      {przewoznik.nazwa}
                    </option>
                  ))}
                </select>

                <input
                  value={wpis.numer}
                  onChange={(zdarzenie) =>
                    setPrzesylka((stan) => ({
                      ...stan,
                      [zamowienie.id]: { ...wpis, numer: zdarzenie.target.value },
                    }))
                  }
                  placeholder="Numer przesyłki"
                  className="rounded-full border border-[#111827]/15 px-4 py-2 text-sm"
                />

                <button
                  type="button"
                  disabled={zajete || !wpis.numer.trim() || !zamowienie.oplacone}
                  title={
                    zamowienie.oplacone
                      ? "Zapisuje numer przesyłki i oznacza zamówienie jako wysłane"
                      : "Zamówienie nie jest opłacone"
                  }
                  onClick={() =>
                    wyslijZmiane(zamowienie.id, {
                      przewoznik: wpis.przewoznik,
                      numer: wpis.numer.trim(),
                      stan: "SENT",
                    })
                  }
                  className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2E64A8] disabled:opacity-40"
                >
                  Nadaj i oznacz jako wysłane
                </button>

                <a
                  href={`https://allegro.pl/moje-allegro/sprzedaz/zamowienia/${zamowienie.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-sm text-[#2E64A8] hover:underline"
                >
                  Otwórz na Allegro →
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
