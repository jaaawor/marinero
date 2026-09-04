"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DOMYSLNY_KURS,
  DOMYSLNY_VAT,
  euroNetto,
  kluczSilnika,
  razemPln,
  type CennikSilnikow,
  type PozycjaCennika,
  type Zmiana,
} from "@/lib/silniki-cennik"

const MARKI = [
  { klucz: "xo", nazwa: "XO Boats" },
  { klucz: "nordkapp", nazwa: "Nordkapp" },
  { klucz: "jeanneau", nazwa: "Jeanneau" },
  { klucz: "sting", nazwa: "Sting" },
  { klucz: "aquila", nazwa: "Aquila" },
  { klucz: "", nazwa: "Wszystkie marki" },
]

const pole =
  "rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"

function zl(wartosc: number | null): string {
  return wartosc === null ? "—" : wartosc.toLocaleString("pl-PL")
}

/** Puste pole to „ceny jeszcze nie znamy", a nie zero. Zero byłoby ceną. */
function liczbaZPola(tekst: string): number | null {
  const czysty = tekst.replace(/\s/g, "").replace(",", ".")
  if (!czysty) return null
  const wartosc = Number(czysty)
  return Number.isFinite(wartosc) ? wartosc : null
}

export default function SilnikiCennik() {
  const [marka, setMarka] = useState("xo")
  const [stan, setStan] = useState<"wczytuje" | "gotowe" | "blad">("wczytuje")
  const [blad, setBlad] = useState("")
  const [cennik, setCennik] = useState<CennikSilnikow | null>(null)
  const [gdzie, setGdzie] = useState<Record<string, string[]>>({})
  const [lodzie, setLodzie] = useState<{ slug: string; bezSilnika: number; bazowa: number }[]>([])
  const [zmiany, setZmiany] = useState<Zmiana[]>([])
  const [zapisuje, setZapisuje] = useState("")
  const [wynik, setWynik] = useState("")

  const pobierz = useCallback(async (ktora: string) => {
    setStan("wczytuje")
    setBlad("")
    try {
      const odpowiedz = await fetch(`/api/admin/silniki?marka=${encodeURIComponent(ktora)}`)
      const dane = await odpowiedz.json()
      if (!dane.ok) {
        setStan("blad")
        setBlad(dane.blad || "Nie udało się wczytać cennika.")
        return
      }
      setCennik(dane.cennik)
      setGdzie(dane.gdzie || {})
      setLodzie(dane.lodzie || [])
      setZmiany(dane.zmiany || [])
      setStan("gotowe")
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [])

  useEffect(() => {
    pobierz(marka)
  }, [pobierz, marka])

  /** Zmiana idzie do **wszystkich kluczy grupy** — inaczej wróciłby rozjazd. */
  function ustaw(klucze: string[], pole: keyof PozycjaCennika, wartosc: string) {
    setWynik("")
    const zbior = new Set(klucze)
    setCennik((teraz) => {
      if (!teraz) return teraz
      return {
        ...teraz,
        pozycje: teraz.pozycje.map((p) =>
          zbior.has(p.klucz)
            ? { ...p, [pole]: pole === "nazwa" ? wartosc : liczbaZPola(wartosc) }
            : p
        ),
      }
    })
  }

  /**
   * Podgląd liczymy **w przeglądarce**, z tego, co stoi w polach — a nie
   * z ostatniego zapisu. Inaczej po zmianie kursu trzeba by najpierw zapisać
   * cennik, żeby zobaczyć, co ta zmiana robi, czyli podejmować decyzję po
   * fakcie.
   */
  const podglad = useMemo(() => {
    if (!cennik) return []
    const poKluczu = new Map(cennik.pozycje.map((p) => [p.klucz, p]))
    return zmiany
      .map((z) => {
        const pozycja = poKluczu.get(kluczSilnika(z.staraNazwa))
        if (!pozycja) return null
        const eur = euroNetto(pozycja, cennik)
        if (eur === null) return null
        return {
          ...z,
          nowaNazwa: pozycja.nazwa || z.staraNazwa,
          nowaCena: z.bezSilnika + eur,
        }
      })
      .filter(Boolean) as Zmiana[]
  }, [cennik, zmiany])

  /**
   * Jeden wiersz na **silnik**, nie na zapis w Directusie.
   *
   * Klucz pozycji bierze się z nazwy w Directusie, a ta sama rzecz bywa tam
   * nazwana inaczej przy różnych łodziach: przy DFNDR 8 stoi „Suzuki 250 KM",
   * przy pozostałych „Suzuki 250 KM APX". To są dwa klucze i przez to w tabeli
   * stały dwa wiersze na jeden silnik — z tymi samymi kwotami, do wpisania
   * dwa razy i do rozjechania przy pierwszej nieuwadze.
   *
   * Sklejamy je po **nazwie docelowej**, czyli po tym, co ma zobaczyć klient.
   * Wpisana kwota idzie do wszystkich kluczy grupy naraz, więc rozjazd nie ma
   * jak powstać, a pod nazwą widać, których zapisów dotyczy.
   */
  const grupy = useMemo(() => {
    if (!cennik) return []
    const mapa = new Map<
      string,
      { nazwa: string; sztuk: number; klucze: string[]; pozycja: PozycjaCennika; zrodla: string[] }
    >()

    for (const p of cennik.pozycje) {
      const etykieta = (p.nazwa || p.klucz).trim().toLowerCase()
      const wpis = mapa.get(etykieta)
      if (wpis) {
        wpis.klucze.push(p.klucz)
        // Gdyby kwoty w grupie się rozjechały (import sprzed sklejania),
        // pokazujemy pierwszą wypełnioną — a zapis i tak wyrówna wszystkie.
        if (wpis.pozycja.silnikPln === null && p.silnikPln !== null) wpis.pozycja = p
      } else {
        mapa.set(etykieta, {
          nazwa: p.nazwa,
          sztuk: p.sztuk,
          klucze: [p.klucz],
          pozycja: p,
          zrodla: [],
        })
      }
    }

    for (const grupa of mapa.values()) {
      grupa.zrodla = [...new Set(grupa.klucze.flatMap((k) => gdzie[k] || []))].sort()
    }

    return [...mapa.values()].sort(
      (a, b) => a.sztuk - b.sztuk || a.nazwa.localeCompare(b.nazwa, "pl")
    )
  }, [cennik, gdzie])

  const doZmiany = podglad.filter(
    (z) => z.nowaCena !== z.staraCena || z.nowaNazwa !== z.staraNazwa
  )

  async function zapiszCennik() {
    if (!cennik) return
    setZapisuje("cennik")
    setWynik("")
    try {
      const odpowiedz = await fetch("/api/admin/silniki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cennik }),
      })
      const dane = await odpowiedz.json()
      setWynik(dane.ok ? "Cennik zapisany. Ceny w konfiguratorach zostały bez zmian." : dane.blad)
      if (dane.ok) await pobierz(marka)
    } catch {
      setWynik("Nie udało się zapisać.")
    } finally {
      setZapisuje("")
    }
  }

  async function zastosuj() {
    setZapisuje("zastosuj")
    setWynik("")
    try {
      const odpowiedz = await fetch("/api/admin/silniki", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marka }),
      })
      const dane = await odpowiedz.json()
      if (!dane.ok) {
        setWynik(dane.blad || "Nie udało się.")
        return
      }
      const bledy = (dane.bledy || []) as { pozycja: string; blad: string }[]
      setWynik(
        `Zapisane w konfiguratorach: ${dane.zapisanych}.` +
          (bledy.length ? ` Nie poszło: ${bledy.map((b) => b.pozycja).join(", ")}` : "")
      )
      await pobierz(marka)
    } catch {
      setWynik("Nie udało się zapisać.")
    } finally {
      setZapisuje("")
    }
  }

  if (stan === "wczytuje") {
    return <p className="text-sm text-[#111827]/50">Wczytuję cennik i konfiguratory…</p>
  }

  if (stan === "blad" || !cennik) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p>{blad}</p>
        <button
          type="button"
          onClick={() => pobierz(marka)}
          className="mt-2 underline transition hover:text-amber-700"
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  const wypelnione = grupy.filter((g) => g.pozycja.silnikPln !== null).length

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-4 rounded-lg border border-[#111827]/10 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#111827]/40">
            Marka
          </span>
          <select value={marka} onChange={(z) => setMarka(z.target.value)} className={pole}>
            {MARKI.map((m) => (
              <option key={m.klucz} value={m.klucz}>
                {m.nazwa}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#111827]/40">
            Kurs euro
          </span>
          <input
            inputMode="decimal"
            value={String(cennik.kurs ?? DOMYSLNY_KURS)}
            onChange={(z) =>
              setCennik({ ...cennik, kurs: liczbaZPola(z.target.value) ?? DOMYSLNY_KURS })
            }
            className={`${pole} w-24`}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#111827]/40">
            VAT
          </span>
          <select
            value={String(cennik.vat ?? DOMYSLNY_VAT)}
            onChange={(z) => setCennik({ ...cennik, vat: Number(z.target.value) })}
            className={pole}
          >
            <option value="0.23">23%</option>
            <option value="0">0% (ceny już netto)</option>
          </select>
        </label>

        <p className="text-sm text-[#111827]/55">
          Wyceniono <strong>{wypelnione}</strong> z {grupy.length}{" "}
          {grupy.length === 1 ? "silnika" : "silników"}.
          {cennik.zaktualizowano ? (
            <> Ostatnia zmiana: {cennik.zaktualizowano.slice(0, 10)}.</>
          ) : null}
        </p>
      </div>

      {/*
        Ceny podaje się w złotych brutto, bo w takich handlowiec je dostaje od
        dostawcy i w takich myśli. Konfigurator liczy netto w euro, więc
        przeliczenie robimy tutaj i pokazujemy obie kwoty — żeby nie trzeba było
        wierzyć na słowo, skąd się wzięła ta w ofercie.
      */}
      <div className="overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
              <th className="w-full max-w-0 px-4 py-3 font-semibold">Silnik</th>
              <th className="w-16 px-3 py-3 text-right font-semibold">Szt.</th>
              <th className="w-36 px-3 py-3 font-semibold">Silnik (zł brutto)</th>
              <th className="w-36 px-3 py-3 font-semibold">Zestaw (zł brutto)</th>
              <th className="w-32 px-3 py-3 text-right font-semibold">Razem zł</th>
              <th className="w-32 px-3 py-3 text-right font-semibold">EUR netto</th>
            </tr>
          </thead>
          <tbody>
            {grupy.map((g) => {
              const p = g.pozycja
              const eur = euroNetto(p, cennik)
              return (
                <tr key={g.klucze.join("+")} className="border-b border-[#111827]/6 last:border-0">
                  <td className="w-full max-w-0 px-4 py-3">
                    <input
                      value={p.nazwa}
                      onChange={(z) => ustaw(g.klucze, "nazwa", z.target.value)}
                      className={`${pole} w-full font-medium`}
                    />
                    <p className="mt-1 truncate text-xs text-[#111827]/40">
                      {g.zrodla.join(" · ") || "nie ma jej w żadnym konfiguratorze"}
                      {g.klucze.length > 1 ? (
                        <span className="text-[#2E64A8]">
                          {" "}
                          · jedna pozycja dla {g.klucze.length} zapisów w Directusie
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right text-[#111827]/60">{g.sztuk}</td>
                  <td className="px-3 py-3">
                    <input
                      inputMode="decimal"
                      value={p.silnikPln === null ? "" : String(p.silnikPln)}
                      onChange={(z) => ustaw(g.klucze, "silnikPln", z.target.value)}
                      className={`${pole} w-full text-right`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      inputMode="decimal"
                      value={p.zestawPln === null ? "" : String(p.zestawPln)}
                      onChange={(z) => ustaw(g.klucze, "zestawPln", z.target.value)}
                      className={`${pole} w-full text-right`}
                    />
                  </td>
                  <td className="px-3 py-3 text-right text-[#111827]/60">{zl(razemPln(p))}</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {eur === null ? "—" : `${eur.toLocaleString("pl-PL")} €`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* PODGLĄD — co konkretnie zmieni się przy łodziach. */}
      <div className="mt-6 rounded-lg border border-[#111827]/10 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#111827]/10 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Podgląd — {doZmiany.length}{" "}
            {doZmiany.length === 1 ? "pozycja się zmieni" : "pozycji się zmieni"} (z{" "}
            {podglad.length} dopasowanych)
          </h2>
          <p className="text-xs text-[#111827]/45">
            cena wariantu = cena „bez silnika" + cena silnika z cennika
          </p>
        </div>

        {doZmiany.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.12em] text-[#111827]/40">
                  <th className="px-4 py-3 font-semibold">Łódź</th>
                  <th className="w-full max-w-0 px-3 py-3 font-semibold">Pozycja</th>
                  <th className="w-32 px-3 py-3 text-right font-semibold">Bez silnika</th>
                  <th className="w-28 px-3 py-3 text-right font-semibold">Było</th>
                  <th className="w-28 px-3 py-3 text-right font-semibold">Będzie</th>
                  <th className="w-28 px-3 py-3 text-right font-semibold">Różnica</th>
                </tr>
              </thead>
              <tbody>
                {doZmiany.map((z) => {
                  const roznica = z.nowaCena - z.staraCena
                  return (
                    <tr key={z.id} className="border-b border-[#111827]/6 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-[#111827]/70">{z.slug}</td>
                      <td className="w-full max-w-0 px-3 py-2.5">
                        <p className="truncate">{z.nowaNazwa}</p>
                        {z.nowaNazwa !== z.staraNazwa ? (
                          <p className="truncate text-xs text-[#111827]/40">
                            było: {z.staraNazwa}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#111827]/50">
                        {z.bezSilnika ? z.bezSilnika.toLocaleString("pl-PL") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#111827]/50">
                        {z.staraCena.toLocaleString("pl-PL")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {z.nowaCena.toLocaleString("pl-PL")}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right ${
                          roznica > 0 ? "text-[#2E64A8]" : roznica < 0 ? "text-amber-700" : ""
                        }`}
                      >
                        {roznica ? `${roznica > 0 ? "+" : ""}${roznica.toLocaleString("pl-PL")}` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-[#111827]/50">
            Nic się nie zmieni — albo cennik jest jeszcze pusty, albo ceny w konfiguratorach już
            się z nim zgadzają.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-[#111827]/10 bg-white/95 py-4 backdrop-blur">
        <button
          type="button"
          onClick={zapiszCennik}
          disabled={Boolean(zapisuje)}
          className="rounded-md border border-[#111827]/15 px-4 py-2 text-sm font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8] disabled:opacity-50"
        >
          {zapisuje === "cennik" ? "Zapisuję…" : "Zapisz cennik"}
        </button>

        <button
          type="button"
          onClick={zastosuj}
          disabled={Boolean(zapisuje) || !doZmiany.length}
          className="rounded-md bg-[#2E64A8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"
        >
          {zapisuje === "zastosuj"
            ? "Zapisuję…"
            : `Przepisz do konfiguratorów (${doZmiany.length})`}
        </button>

        {/*
          Dwa przyciski, bo to są dwie różne decyzje. Cennik można uzupełniać
          tygodniami i nic się przez to na stronie nie zmienia; przepisanie do
          konfiguratorów widzi klient od najbliższego odświeżenia ISR.
        */}
        <p className="text-xs text-[#111827]/45">
          „Zapisz cennik" nie rusza cen na stronie. Dopiero „Przepisz do konfiguratorów" zmienia
          to, co widzi klient.
        </p>

        {wynik ? <p className="text-sm font-medium text-[#2E64A8]">{wynik}</p> : null}
      </div>

      {lodzie.length ? (
        <p className="mt-6 text-xs text-[#111827]/40">
          Łodzie w tym widoku:{" "}
          {lodzie
            .map((l) => `${l.slug} (bez silnika: ${l.bezSilnika ? l.bezSilnika.toLocaleString("pl-PL") : "—"})`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  )
}
