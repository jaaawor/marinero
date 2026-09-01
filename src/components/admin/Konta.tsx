"use client"

import { useCallback, useEffect, useState } from "react"
import { MODULY } from "@/lib/panel-moduly"

type Osoba = {
  id: string
  email: string
  imie: string
  stan: string
  rola: string
  glowny: boolean
  moduly: string[]
}

const pole =
  "w-full rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const etykieta =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]/40"

/** Losowe hasło — krótsze i „wymyślone ręcznie" zwykle znaczy jedno i to samo. */
function losoweHaslo(): string {
  const znaki = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const losowe = new Uint32Array(16)
  crypto.getRandomValues(losowe)
  return Array.from(losowe, (liczba) => znaki[liczba % znaki.length]).join("")
}

export default function Konta() {
  const [osoby, setOsoby] = useState<Osoba[]>([])
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [komunikat, setKomunikat] = useState("")
  const [zapisuje, setZapisuje] = useState("")

  const [nowe, setNowe] = useState({ imie: "", nazwisko: "", email: "", haslo: "" })
  const [noweModuly, setNoweModuly] = useState<string[]>([])
  const [formularz, setFormularz] = useState(false)

  const pobierz = useCallback(async () => {
    setStan("laduje")
    try {
      const wynik = await fetch("/api/admin/osoby").then((odpowiedz) => odpowiedz.json())
      if (!wynik.ok) {
        setStan("blad")
        setBlad(wynik.blad || "Nie udało się wczytać kont.")
        return
      }
      setOsoby(wynik.osoby || [])
      setStan("gotowe")
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

  useEffect(() => {
    pobierz()
  }, [pobierz])

  async function wyslij(tresc: Record<string, unknown>) {
    return fetch("/api/admin/osoby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tresc),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false, blad: "Brak połączenia z serwerem." }))
  }

  async function przelacz(osoba: Osoba, klucz: string) {
    const moduly = osoba.moduly.includes(klucz)
      ? osoba.moduly.filter((m) => m !== klucz)
      : [...osoba.moduly, klucz]

    // Pokazujemy zmianę od razu, a przy odmowie wracamy do stanu z serwera —
    // czekanie na odpowiedź przy każdym kliknięciu w kratkę byłoby męczące.
    setOsoby((teraz) => teraz.map((o) => (o.id === osoba.id ? { ...o, moduly } : o)))
    setZapisuje(osoba.id)
    setKomunikat("")

    const wynik = await wyslij({ co: "moduly", id: osoba.id, moduly })
    setZapisuje("")

    if (!wynik.ok) {
      setKomunikat(wynik.blad || "Nie udało się zapisać.")
      pobierz()
      return
    }
    setKomunikat("Zapisane.")
  }

  async function zmienStan(osoba: Osoba) {
    setZapisuje(osoba.id)
    const wynik = await wyslij({ co: "stan", id: osoba.id, aktywne: osoba.stan !== "active" })
    setZapisuje("")

    if (!wynik.ok) {
      setKomunikat(wynik.blad || "Nie udało się zapisać.")
      return
    }
    pobierz()
  }

  async function zaloz() {
    setZapisuje("nowe")
    setKomunikat("")

    const wynik = await wyslij({ co: "nowe", ...nowe, moduly: noweModuly })
    setZapisuje("")

    if (!wynik.ok) {
      setKomunikat(wynik.blad || "Nie udało się założyć konta.")
      return
    }

    setKomunikat(
      `Konto założone. Przekaż dane do logowania: ${nowe.email} — hasło ${nowe.haslo}. ` +
        "Nigdzie ich już nie zobaczysz."
    )
    setNowe({ imie: "", nazwisko: "", email: "", haslo: "" })
    setNoweModuly([])
    setFormularz(false)
    pobierz()
  }

  if (stan === "laduje") return <p className="text-sm text-[#111827]/50">Wczytuję konta…</p>

  if (stan === "blad") {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{blad}</p>
    )
  }

  return (
    <div>
      {komunikat ? (
        <p className="mb-5 rounded-md border border-[#2E64A8]/30 bg-[#2E64A8]/5 p-4 text-sm">
          {komunikat}
        </p>
      ) : null}

      <div className="space-y-4">
        {osoby.map((osoba) => (
          <div key={osoba.id} className="rounded-lg border border-[#111827]/10 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">
                {osoba.imie || osoba.email}
                <span className="ml-3 font-normal text-[#111827]/45">{osoba.email}</span>
                {osoba.stan !== "active" ? (
                  <span className="ml-3 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800">
                    zawieszone
                  </span>
                ) : null}
              </p>

              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#111827]/40">{osoba.rola}</span>
                {!osoba.glowny ? (
                  <button
                    type="button"
                    disabled={zapisuje === osoba.id}
                    onClick={() => zmienStan(osoba)}
                    className="text-[#111827]/50 transition hover:text-[#2E64A8] disabled:opacity-40"
                  >
                    {osoba.stan === "active" ? "Zawieś" : "Przywróć"}
                  </button>
                ) : null}
              </div>
            </div>

            {osoba.glowny ? (
              <p className="mt-3 text-sm text-[#111827]/50">
                Główny administrator — widzi wszystkie narzędzia i zakłada konta. Tego
                nie da się odebrać z panelu: zostałby serwis bez nikogo, kto może to
                cofnąć.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {MODULY.map((modul) => (
                  <label
                    key={modul.klucz}
                    className="flex cursor-pointer items-center gap-2 text-sm text-[#111827]/70"
                  >
                    <input
                      type="checkbox"
                      checked={osoba.moduly.includes(modul.klucz)}
                      disabled={zapisuje === osoba.id}
                      onChange={() => przelacz(osoba, modul.klucz)}
                      className="h-4 w-4 accent-[#2E64A8]"
                    />
                    {modul.nazwa}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        {!formularz ? (
          <button
            type="button"
            onClick={() => {
              setNowe((teraz) => ({ ...teraz, haslo: losoweHaslo() }))
              setFormularz(true)
            }}
            className="rounded-md bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F]"
          >
            Załóż konto
          </button>
        ) : (
          <div className="rounded-lg border border-[#111827]/10 bg-white p-6">
            <h2 className="text-lg font-semibold">Nowe konto</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={etykieta} htmlFor="k-imie">
                  Imię
                </label>
                <input
                  id="k-imie"
                  value={nowe.imie}
                  onChange={(z) => setNowe((t) => ({ ...t, imie: z.target.value }))}
                  className={pole}
                />
              </div>
              <div>
                <label className={etykieta} htmlFor="k-nazwisko">
                  Nazwisko
                </label>
                <input
                  id="k-nazwisko"
                  value={nowe.nazwisko}
                  onChange={(z) => setNowe((t) => ({ ...t, nazwisko: z.target.value }))}
                  className={pole}
                />
              </div>
              <div>
                <label className={etykieta} htmlFor="k-email">
                  E-mail (login)
                </label>
                <input
                  id="k-email"
                  type="email"
                  value={nowe.email}
                  onChange={(z) => setNowe((t) => ({ ...t, email: z.target.value }))}
                  className={pole}
                />
              </div>
              <div>
                <label className={etykieta} htmlFor="k-haslo">
                  Hasło
                </label>
                <div className="flex gap-2">
                  <input
                    id="k-haslo"
                    value={nowe.haslo}
                    onChange={(z) => setNowe((t) => ({ ...t, haslo: z.target.value }))}
                    className={`${pole} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setNowe((t) => ({ ...t, haslo: losoweHaslo() }))}
                    className="shrink-0 rounded-md border border-[#111827]/15 px-3 text-sm transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
                  >
                    Losuj
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-[#111827]/40">
                  Zapisz je teraz i przekaż osobiście — po zapisaniu konta hasła nie da
                  się już odczytać.
                </p>
              </div>
            </div>

            <p className={`${etykieta} mt-6`}>Narzędzia</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {MODULY.map((modul) => (
                <label
                  key={modul.klucz}
                  className="flex cursor-pointer items-center gap-2 text-sm text-[#111827]/70"
                >
                  <input
                    type="checkbox"
                    checked={noweModuly.includes(modul.klucz)}
                    onChange={() =>
                      setNoweModuly((teraz) =>
                        teraz.includes(modul.klucz)
                          ? teraz.filter((k) => k !== modul.klucz)
                          : [...teraz, modul.klucz]
                      )
                    }
                    className="h-4 w-4 accent-[#2E64A8]"
                  />
                  {modul.nazwa}
                </label>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={zapisuje === "nowe" || !nowe.email || nowe.haslo.length < 10}
                onClick={zaloz}
                className="rounded-md bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-50"
              >
                {zapisuje === "nowe" ? "Zakładam…" : "Załóż konto"}
              </button>
              <button
                type="button"
                onClick={() => setFormularz(false)}
                className="rounded-md border border-[#111827]/15 px-4 py-2.5 text-sm transition hover:border-[#111827]/40"
              >
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
