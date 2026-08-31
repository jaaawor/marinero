"use client"

import { useCallback, useEffect, useState } from "react"

type Pozycja = {
  id: string
  tytul: string
  wariant: string
  sku: string
  ile: number
  cena: number
  razem: number
}

type Zamowienie = {
  id: string
  numer: string
  kiedy: string
  email: string
  klient: string
  telefon: string
  adres: string
  nip: string
  waluta: string
  razem: number
  dostawa: string
  dostawaKoszt: number
  platnosc: string
  payu: string
  oplacone: boolean
  realizacja: string
  obsluga: string
  mailWyslany: boolean
  numerPrzesylki: string
  uwagi: string
  pozycje: Pozycja[]
}

const STANY = [
  { klucz: "nowe", nazwa: "Nowe" },
  { klucz: "w-realizacji", nazwa: "W realizacji" },
  { klucz: "wyslane", nazwa: "Wysłane" },
  { klucz: "anulowane", nazwa: "Anulowane" },
]

// Stany płatności Medusy są po angielsku, a sprzedawca ma czytać, nie tłumaczyć.
const PLATNOSCI: Record<string, string> = {
  not_paid: "nieopłacone",
  awaiting: "czeka na płatność",
  authorized: "zablokowana",
  captured: "opłacone",
  partially_captured: "opłacone częściowo",
  refunded: "zwrócone",
  partially_refunded: "zwrócone częściowo",
  canceled: "anulowane",
  requires_action: "wymaga działania",
}

function zloty(kwota: number, waluta = "PLN") {
  return `${kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${waluta === "PLN" ? "zł" : waluta}`
}

function data(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })
}

const KOLORY: Record<string, string> = {
  nowe: "bg-[#2E64A8]/10 text-[#2E64A8]",
  "w-realizacji": "bg-amber-500/15 text-amber-800",
  wyslane: "bg-emerald-500/10 text-emerald-700",
  anulowane: "bg-[#111827]/8 text-[#111827]/50",
}

export default function Zamowienia() {
  const [zamowienia, setZamowienia] = useState<Zamowienie[]>([])
  const [ile, setIle] = useState(0)
  const [strona, setStrona] = useState(0)
  const [szukaj, setSzukaj] = useState("")
  const [filtr, setFiltr] = useState("wszystkie")
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [otwarte, setOtwarte] = useState<string | null>(null)
  const [pracuje, setPracuje] = useState("")

  const pobierz = useCallback(async (nowaStrona: number, fraza: string) => {
    setStan("laduje")
    setBlad("")

    try {
      const parametry = new URLSearchParams({ strona: String(nowaStrona) })
      if (fraza) parametry.set("szukaj", fraza)

      const odpowiedz = await fetch(`/api/admin/zamowienia?${parametry}`)
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

      setZamowienia(dane.zamowienia || [])
      setIle(dane.ile || 0)
      setStan("gotowe")
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

  useEffect(() => {
    pobierz(strona, szukaj)
    // Szukanie ma własny przycisk — tu reagujemy tylko na zmianę strony.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strona])

  async function operacja(id: string, tresc: Record<string, unknown>) {
    setPracuje(id)
    try {
      const odpowiedz = await fetch("/api/admin/zamowienia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...tresc }),
      })
      const wynik = await odpowiedz.json()

      if (!wynik.ok) {
        alert(wynik.blad || "Nie udało się.")
        return
      }

      // Podmieniamy jedno zamówienie w miejscu — przeładowanie całej listy
      // przy każdym kliknięciu gubiło rozwinięty wiersz i pozycję przewijania.
      if (wynik.zamowienie) {
        setZamowienia((teraz) =>
          teraz.map((z) => (z.id === id ? { ...z, ...wynik.zamowienie } : z))
        )
      }
    } catch {
      alert("Brak połączenia z serwerem.")
    } finally {
      setPracuje("")
    }
  }

  const widoczne =
    filtr === "wszystkie" ? zamowienia : zamowienia.filter((z) => z.obsluga === filtr)

  const doObsluzenia = zamowienia.filter((z) => z.obsluga === "nowe").length
  const stron = Math.ceil(ile / 25)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(zdarzenie) => {
            zdarzenie.preventDefault()
            setStrona(0)
            pobierz(0, szukaj)
          }}
          className="flex gap-2"
        >
          <input
            value={szukaj}
            onChange={(zdarzenie) => setSzukaj(zdarzenie.target.value)}
            placeholder="Numer, e-mail, nazwisko…"
            className="w-64 rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
          />
          <button
            type="submit"
            className="rounded-md bg-[#2E64A8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F]"
          >
            Szukaj
          </button>
        </form>

        <div className="ml-auto flex flex-wrap gap-2">
          {[{ klucz: "wszystkie", nazwa: "Wszystkie" }, ...STANY].map((pozycja) => (
            <button
              key={pozycja.klucz}
              type="button"
              onClick={() => setFiltr(pozycja.klucz)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                filtr === pozycja.klucz
                  ? "bg-[#111827] text-white"
                  : "bg-white text-[#111827]/60 hover:text-[#111827]"
              }`}
            >
              {pozycja.nazwa}
              {pozycja.klucz === "nowe" && doObsluzenia ? ` (${doObsluzenia})` : ""}
            </button>
          ))}
        </div>
      </div>

      {stan === "blad" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{blad}</p>
      ) : null}

      {stan === "laduje" ? <p className="text-sm text-[#111827]/50">Wczytuję…</p> : null}

      {stan === "gotowe" && !widoczne.length ? (
        <p className="text-sm text-[#111827]/50">
          {zamowienia.length ? "Nic w tym stanie." : "Nie ma jeszcze zamówień."}
        </p>
      ) : null}

      <div className="space-y-3">
        {widoczne.map((zamowienie) => {
          const rozwiniete = otwarte === zamowienie.id

          return (
            <div key={zamowienie.id} className="rounded-lg border border-[#111827]/10 bg-white">
              <button
                type="button"
                onClick={() => setOtwarte(rozwiniete ? null : zamowienie.id)}
                className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-left"
              >
                <span className="font-semibold tabular-nums">#{zamowienie.numer}</span>
                <span className="text-sm text-[#111827]/45">{data(zamowienie.kiedy)}</span>

                <span className="min-w-0 flex-1 truncate text-sm">
                  {zamowienie.klient || zamowienie.email}
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    zamowienie.oplacone
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-amber-500/15 text-amber-800"
                  }`}
                >
                  {zamowienie.oplacone
                    ? "opłacone"
                    : PLATNOSCI[zamowienie.platnosc] || zamowienie.platnosc || "nieopłacone"}
                </span>

                <span className={`rounded-full px-2.5 py-1 text-xs ${KOLORY[zamowienie.obsluga] || ""}`}>
                  {STANY.find((s) => s.klucz === zamowienie.obsluga)?.nazwa || zamowienie.obsluga}
                </span>

                <span className="w-32 text-right font-semibold tabular-nums">
                  {zloty(zamowienie.razem, zamowienie.waluta)}
                </span>

                <span className="text-[#111827]/25">{rozwiniete ? "▴" : "▾"}</span>
              </button>

              {rozwiniete ? (
                <div className="border-t border-[#111827]/8 px-5 py-5">
                  <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                    <div>
                      <table className="w-full text-sm">
                        <tbody>
                          {zamowienie.pozycje.map((pozycja) => (
                            <tr key={pozycja.id} className="border-b border-[#111827]/6 last:border-0">
                              <td className="py-2 pr-3">
                                {pozycja.tytul}
                                {pozycja.wariant ? (
                                  <span className="text-[#111827]/45"> · {pozycja.wariant}</span>
                                ) : null}
                                {pozycja.sku ? (
                                  <span className="ml-2 text-xs text-[#111827]/35">{pozycja.sku}</span>
                                ) : null}
                              </td>
                              <td className="w-14 py-2 text-right tabular-nums text-[#111827]/60">
                                {pozycja.ile} szt.
                              </td>
                              <td className="w-32 py-2 text-right tabular-nums">
                                {zloty(pozycja.razem, zamowienie.waluta)}
                              </td>
                            </tr>
                          ))}
                          {zamowienie.dostawa ? (
                            <tr>
                              <td className="py-2 pr-3 text-[#111827]/60">{zamowienie.dostawa}</td>
                              <td />
                              <td className="py-2 text-right tabular-nums text-[#111827]/60">
                                {zloty(zamowienie.dostawaKoszt, zamowienie.waluta)}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>

                      <div className="mt-5 grid gap-1 text-sm text-[#111827]/70">
                        <p>{zamowienie.email}</p>
                        {zamowienie.telefon ? <p>{zamowienie.telefon}</p> : null}
                        {zamowienie.adres ? <p>{zamowienie.adres}</p> : null}
                        {zamowienie.nip ? <p>NIP / VAT UE: {zamowienie.nip}</p> : null}
                        {zamowienie.payu ? (
                          <p className="text-[#111827]/45">PayU: {zamowienie.payu}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 text-sm">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#111827]/40">
                          Stan obsługi
                        </label>
                        <select
                          value={zamowienie.obsluga}
                          disabled={pracuje === zamowienie.id}
                          onChange={(zdarzenie) =>
                            operacja(zamowienie.id, { co: "stan", stan: zdarzenie.target.value })
                          }
                          className="w-full rounded-md border border-[#111827]/15 px-3 py-2 outline-none focus:border-[#2E64A8]"
                        >
                          {STANY.map((pozycja) => (
                            <option key={pozycja.klucz} value={pozycja.klucz}>
                              {pozycja.nazwa}
                            </option>
                          ))}
                        </select>
                      </div>

                      <form
                        onSubmit={(zdarzenie) => {
                          zdarzenie.preventDefault()
                          const pole = zdarzenie.currentTarget.elements.namedItem(
                            "numer"
                          ) as HTMLInputElement
                          operacja(zamowienie.id, { co: "przesylka", numer: pole.value })
                        }}
                      >
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#111827]/40">
                          Numer przesyłki
                        </label>
                        <div className="flex gap-2">
                          <input
                            name="numer"
                            defaultValue={zamowienie.numerPrzesylki}
                            placeholder="np. 6200…"
                            className="min-w-0 flex-1 rounded-md border border-[#111827]/15 px-3 py-2 outline-none focus:border-[#2E64A8]"
                          />
                          <button
                            type="submit"
                            disabled={pracuje === zamowienie.id}
                            className="rounded-md border border-[#111827]/15 px-3 py-2 font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8] disabled:opacity-50"
                          >
                            Zapisz
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[#111827]/40">
                          Zapisanie numeru ustawia stan „Wysłane".
                        </p>
                      </form>

                      <form
                        onSubmit={(zdarzenie) => {
                          zdarzenie.preventDefault()
                          const pole = zdarzenie.currentTarget.elements.namedItem(
                            "uwagi"
                          ) as HTMLTextAreaElement
                          operacja(zamowienie.id, { co: "uwagi", uwagi: pole.value })
                        }}
                      >
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#111827]/40">
                          Uwagi wewnętrzne
                        </label>
                        <textarea
                          name="uwagi"
                          defaultValue={zamowienie.uwagi}
                          rows={3}
                          className="w-full rounded-md border border-[#111827]/15 px-3 py-2 outline-none focus:border-[#2E64A8]"
                        />
                        <button
                          type="submit"
                          disabled={pracuje === zamowienie.id}
                          className="mt-2 w-full rounded-md border border-[#111827]/15 px-3 py-2 font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8] disabled:opacity-50"
                        >
                          Zapisz uwagi
                        </button>
                      </form>

                      <div className="border-t border-[#111827]/8 pt-4">
                        <p className="mb-2 text-xs text-[#111827]/45">
                          Potwierdzenie dla klienta:{" "}
                          {zamowienie.mailWyslany ? "wysłane" : "jeszcze nie poszło"}
                        </p>
                        <button
                          type="button"
                          disabled={pracuje === zamowienie.id}
                          onClick={() => operacja(zamowienie.id, { co: "mail" })}
                          className="w-full rounded-md border border-[#111827]/15 px-3 py-2 font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8] disabled:opacity-50"
                        >
                          {zamowienie.mailWyslany ? "Wyślij ponownie" : "Wyślij potwierdzenie"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

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
            {strona + 1} z {stron} ({ile} zamówień)
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
    </div>
  )
}
