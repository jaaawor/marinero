"use client"

import { useCallback, useEffect, useState } from "react"
import { WIDOKI_ZAMOWIEN, nazwaRynku } from "@/lib/allegro-widoki"

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
  rynek: string
  formularz: string
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

function zloty(kwota: number) {
  return `${kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`
}

function kiedy(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })
}

export default function AllegroOrders() {
  const [widok, setWidok] = useState<string>("do-obsluzenia")
  const [rynek, setRynek] = useState("")
  const [dane, setDane] = useState<{
    dostepne: boolean
    powod?: string
    zamowienia?: Zamowienie[]
    rynki?: string[]
    wiecej?: boolean
    przewoznicy?: Przewoznik[]
    automat?: { kiedy: string; nowe: string[] } | null
  } | null>(null)
  const [pracuje, setPracuje] = useState("")
  const [komunikat, setKomunikat] = useState("")
  const [przesylka, setPrzesylka] = useState<Record<string, { przewoznik: string; numer: string }>>({})

  const wczytaj = useCallback(() => {
    setDane(null)
    const parametry = new URLSearchParams({ widok })
    if (rynek) parametry.set("rynek", rynek)

    fetch(`/api/kanaly/zamowienia?${parametry}`)
      .then((odpowiedz) => odpowiedz.json())
      .then(setDane)
      .catch(() => setDane({ dostepne: false, powod: "polaczenie" }))
  }, [widok, rynek])

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
  const rynki = dane.rynki || []

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {WIDOKI_ZAMOWIEN.map((pozycja) => (
          <button
            key={pozycja.klucz}
            type="button"
            onClick={() => setWidok(pozycja.klucz)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              widok === pozycja.klucz
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

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="rynek" className="text-[#111827]/50">
          Rynek
        </label>
        <select
          id="rynek"
          value={rynek}
          onChange={(zdarzenie) => setRynek(zdarzenie.target.value)}
          className="rounded-full border border-[#111827]/15 px-3 py-1.5 text-sm"
        >
          <option value="">wszystkie kraje</option>
          {rynki.map((id) => (
            <option key={id} value={id}>
              {nazwaRynku(id)}
            </option>
          ))}
        </select>

        <span className="text-[#111827]/40">
          {zamowienia.length} {zamowienia.length === 1 ? "zamówienie" : "zamówień"}
          {/* Zamówienia przychodzą ze wszystkich rynków Allegro naraz — nie da
              się tego wyłączyć po stronie API i nie ma po co: oferta wystawiona
              w Polsce jest widoczna także u sąsiadów. */}
          {dane.wiecej ? " · pokazuję ostatnie 300" : ""}
        </span>

        {/* Kiedy automat ostatnio zajrzał do Allegro. To nie jest ozdobnik:
            gdy cron przestanie chodzić, ta data zostaje w miejscu i widać to
            od razu, zamiast dowiadywać się o tym z braku zamówień. */}
        {dane.automat?.kiedy ? (
          <span className="text-[#111827]/35" title="automatyczne pobranie w tle">
            automat: {new Date(dane.automat.kiedy).toLocaleString("pl-PL", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            {dane.automat.nowe.length ? ` · ${dane.automat.nowe.length} nowych` : ""}
          </span>
        ) : null}
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
                    </span>{" "}
                    {/* Przyszło od ostatniego przebiegu automatu — po to jest
                        migawka: sama lista wygląda tak samo dziś i jutro. */}
                    {dane.automat?.nowe.includes(zamowienie.id) ? (
                      <span className="rounded-full bg-[#2E64A8] px-2.5 py-1 text-xs font-semibold text-white">
                        nowe
                      </span>
                    ) : null}

                    {/* Formularz zakupu jeszcze niedokończony przez kupującego.
                        To prawdziwe zamówienie i ma być widoczne, ale nie wolno
                        go wysłać — dopóki Allegro nie da mu
                        `READY_FOR_PROCESSING`, adres i płatność mogą się jeszcze
                        zmienić. */}
                    {zamowienie.formularz && zamowienie.formularz !== "READY_FOR_PROCESSING" ? (
                      <span
                        className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-800"
                        title={
                          zamowienie.formularz === "BOUGHT"
                            ? "Kupujący jeszcze nie wypełnił formularza zakupu"
                            : "Formularz wypełniony, czekamy na płatność"
                        }
                      >
                        {zamowienie.formularz === "BOUGHT"
                          ? "formularz niewypełniony"
                          : "czeka na płatność"}
                      </span>
                    ) : null}

                    {zamowienie.rynek && zamowienie.rynek !== "allegro-pl" ? (
                      // Rynek podpisujemy tylko przy zagranicznych: przy polskich
                      // byłaby to plakietka powtórzona przy każdym zamówieniu.
                      <span className="rounded-full bg-[#2E64A8]/10 px-2 py-1 text-[#2E64A8]">
                        {nazwaRynku(zamowienie.rynek)}
                      </span>
                    ) : null}
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
