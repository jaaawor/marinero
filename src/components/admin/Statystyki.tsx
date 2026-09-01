"use client"

import { useEffect, useMemo, useState } from "react"
import { flagaKraju, nazwaKraju } from "@/lib/kraj"

type Fraza = { fraza: string; ile: number; bezWynikow: number; gdzie?: string }
type Strona = { sciezka: string; tytul: string; ile: number; unikalnych: number }
type Konfigurator = {
  model: string
  slug: string
  zaczete: number
  wyslane: number
  porzucone: number
  waluta: string
  sredniaPorzuconych: number
  unikalnych: number
}
type Porzucona = {
  model: string
  slug: string
  etap: string
  opcji: number
  wartosc: number
  waluta: string
  kiedy: string
  imie: string
  email: string
  telefon: string
  uwagi: string
}
type Koszyk = {
  id: string
  email: string
  zmieniony: string
  suma: number
  waluta: string
  sztuk: number
  etap: string
  pozycje: string
}
type Dane = {
  szukania:
    | { dostepne: true; dni: number; razem: number; lodzie: Fraza[]; sklep: Fraza[]; bezWynikow: Fraza[] }
    | { dostepne: false; powod: string }
  koszyki: { dostepne: true; koszyki: Koszyk[] } | { dostepne: false; powod: string }
  odslony:
    | {
        dostepne: true
        razem: number
        unikalnych: number
        razemLodzie: number
        razemSklep: number
        lodzie: Strona[]
        sklep: Strona[]
        zrodla: { nazwa: string; ile: number }[]
        kraje: { kod: string; ile: number; osoby: number }[]
        seria: { dzien: string; ile: number; osoby: number }[]
      }
    | { dostepne: false; powod: string }
  konfiguratory:
    | {
        dostepne: true
        zaczete: number
        unikalnych: number
        zDanymi: number
        wyslane: number
        modele: Konfigurator[]
        ostatnie: Porzucona[]
      }
    | { dostepne: false; powod: string }
}

function kiedy(iso: string) {
  const minut = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minut < 1) return "przed chwilą"
  if (minut < 60) return `${minut} min temu`
  const godzin = Math.round(minut / 60)
  if (godzin < 24) return `${godzin} godz. temu`
  return `${Math.round(godzin / 24)} dni temu`
}

function Strony({ tytul, lead, strony }: { tytul: string; lead: string; strony: Strona[] }) {
  if (!strony.length) {
    return (
      <div>
        <h2 className="text-lg font-semibold">{tytul}</h2>
        <p className="mt-2 text-sm leading-7 text-[#111827]/55">{lead}</p>
        <p className="mt-5 text-sm text-[#111827]/40">Brak odsłon w tym okresie.</p>
      </div>
    )
  }

  const najwiecej = strony[0].ile

  return (
    <div>
      <h2 className="text-lg font-semibold">{tytul}</h2>
      <p className="mt-2 text-sm leading-7 text-[#111827]/55">{lead}</p>

      <table className="mt-5 w-full text-sm">
        <tbody>
          {strony.map((strona) => (
            <tr key={strona.sciezka} className="border-b border-[#111827]/5 last:border-0">
              <td className="py-2">
                <a
                  href={strona.sciezka}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#2E64A8]"
                >
                  {strona.tytul || strona.sciezka}
                </a>
                <span className="block text-xs text-[#111827]/35">{strona.sciezka}</span>
              </td>
              {/* Słupek zamiast samej liczby — od razu widać, czy pierwsza
                  pozycja odstaje dwukrotnie, czy o włos. */}
              <td className="w-32 py-2">
                <span
                  className="block h-1.5 rounded-full bg-[#2E64A8]/70"
                  style={{ width: `${Math.max(6, Math.round((strona.ile / najwiecej) * 100))}%` }}
                />
              </td>
              <td className="w-20 py-2 text-right tabular-nums">
                {strona.ile}
                {/* Odsłony obok unikalnych: duża różnica znaczy, że ludzie
                    wracają na tę stronę po kilka razy — przy modelu to dobry
                    znak, przy koszyku raczej nie. */}
                <span className="block text-xs font-normal text-[#111827]/35">
                  {strona.unikalnych} os.
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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


type Ziarno = "dzien" | "tydzien" | "miesiac"

/** Poniedziałek tygodnia, w którym leży dana data — tydzień liczymy po polsku. */
function poczatekTygodnia(dzien: string): string {
  const data = new Date(`${dzien}T00:00:00Z`)
  const dzienTygodnia = (data.getUTCDay() + 6) % 7
  data.setUTCDate(data.getUTCDate() - dzienTygodnia)
  return data.toISOString().slice(0, 10)
}

function etykieta(klucz: string, ziarno: Ziarno): string {
  if (ziarno === "miesiac") {
    const [rok, miesiac] = klucz.split("-")
    const nazwy = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]
    return `${nazwy[Number(miesiac) - 1] || miesiac} ${rok}`
  }
  const [, miesiac, dzien] = klucz.split("-")
  return ziarno === "tydzien" ? `od ${dzien}.${miesiac}` : `${dzien}.${miesiac}`
}

/**
 * Ruch w czasie — słupki dzień po dniu, tydzień po tygodniu albo miesiąc po
 * miesiącu.
 *
 * Serwer oddaje wyłącznie **doby**, a tygodnie i miesiące składamy tutaj.
 * Trzy osobne zapytania dawałyby trzy razy tę samą pracę po stronie Directusa,
 * a doba i tak jest najmniejszą cegłą, z której da się zbudować pozostałe dwa
 * widoki. Przełączanie ziarna nie rusza wtedy sieci.
 *
 * Sumowanie osób po tygodniu byłoby kłamstwem — ten sam człowiek wchodzący
 * w poniedziałek i w środę to jedna osoba, a nie dwie, a serwer przysyła już
 * policzone doby i nie da się ich uczciwie zsumować. Dlatego przy tygodniu
 * i miesiącu pokazujemy **sumę odsłon**, a osoby zostają przy dobach.
 */
function Wykres({ seria }: { seria: { dzien: string; ile: number; osoby: number }[] }) {
  const [ziarno, setZiarno] = useState<Ziarno>("dzien")

  const slupki = useMemo(() => {
    const kubelki = new Map<string, { ile: number; osoby: number }>()

    for (const punkt of seria) {
      const klucz =
        ziarno === "dzien"
          ? punkt.dzien
          : ziarno === "tydzien"
            ? poczatekTygodnia(punkt.dzien)
            : punkt.dzien.slice(0, 7)

      const kubelek = kubelki.get(klucz) || { ile: 0, osoby: 0 }
      kubelek.ile += punkt.ile
      kubelek.osoby += punkt.osoby
      kubelki.set(klucz, kubelek)
    }

    return [...kubelki.entries()]
      .map(([klucz, wpis]) => ({ klucz, ...wpis }))
      .sort((a, b) => a.klucz.localeCompare(b.klucz))
  }, [seria, ziarno])

  if (!slupki.length) return null

  const najwyzszy = Math.max(...slupki.map((slupek) => slupek.ile), 1)
  // Przy roku dziennych słupków byłoby 365 — pokazujemy ostatnie 60, bo
  // węższe niż piksel i tak nic nie mówią.
  const widoczne = slupki.slice(-60)

  return (
    <div className="mb-10 rounded-lg border border-[#111827]/10 bg-white p-6">
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold">Ruch w czasie</h2>

        <div className="ml-auto flex gap-1">
          {([
            ["dzien", "dziennie"],
            ["tydzien", "tygodniowo"],
            ["miesiac", "miesięcznie"],
          ] as [Ziarno, string][]).map(([klucz, nazwa]) => (
            <button
              key={klucz}
              onClick={() => setZiarno(klucz)}
              className={`rounded-sm px-3 py-1.5 text-xs ${
                ziarno === klucz ? "bg-[#2E64A8] text-white" : "border border-[#111827]/15"
              }`}
            >
              {nazwa}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-40 items-end gap-[3px] overflow-x-auto">
        {widoczne.map((slupek) => (
          <div
            key={slupek.klucz}
            className="group relative flex min-w-[6px] flex-1 flex-col justify-end"
            title={`${etykieta(slupek.klucz, ziarno)}: ${slupek.ile} odsłon${
              ziarno === "dzien" ? `, ${slupek.osoby} osób` : ""
            }`}
          >
            <div
              className="rounded-t-sm bg-[#2E64A8]/75 transition group-hover:bg-[#2E64A8]"
              style={{ height: `${Math.max(2, (slupek.ile / najwyzszy) * 100)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-xs text-[#111827]/40">
        <span>{etykieta(widoczne[0].klucz, ziarno)}</span>
        <span>{etykieta(widoczne[widoczne.length - 1].klucz, ziarno)}</span>
      </div>

      <p className="mt-4 text-xs leading-6 text-[#111827]/45">
        Najedź na słupek, żeby zobaczyć liczby.
        {ziarno === "dzien"
          ? " Osoby liczone na dobę."
          : " Przy tygodniach i miesiącach pokazujemy odsłony — osób nie da się uczciwie zsumować z dób, bo ten sam człowiek wchodzi kilka razy."}
        {widoczne.length < slupki.length ? ` Widocznych ostatnie ${widoczne.length} z ${slupki.length}.` : ""}
      </p>
    </div>
  )
}

/** Skąd geograficznie przychodzi ruch. */
function Kraje({ kraje }: { kraje: { kod: string; ile: number; osoby: number }[] }) {
  if (!kraje.length) return null

  const razem = kraje.reduce((suma, kraj) => suma + kraj.ile, 0)

  return (
    <div>
      <h2 className="text-lg font-semibold">Z jakich krajów</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/55">
        Kraj ustalamy z adresu IP w chwili odsłony i zapisujemy <strong>sam kod kraju</strong> —
        adresu nie przechowujemy. „Nieznany" to wpisy sprzed wprowadzenia tej kolumny
        albo takie, przy których usługa nie odpowiedziała.
      </p>

      <table className="mt-4 w-full max-w-xl text-sm">
        <thead>
          <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-[0.14em] text-[#111827]/40">
            <th className="py-2 font-semibold">Kraj</th>
            <th className="w-24 py-2 text-right font-semibold">Odsłon</th>
            <th className="w-20 py-2 text-right font-semibold">Osób</th>
            <th className="w-16 py-2 text-right font-semibold">Udział</th>
          </tr>
        </thead>
        <tbody>
          {kraje.map((kraj) => (
            <tr key={kraj.kod || "nieznany"} className="border-b border-[#111827]/5 last:border-0">
              <td className="py-2">
                <span className="mr-2">{kraj.kod ? flagaKraju(kraj.kod) : "🌍"}</span>
                {nazwaKraju(kraj.kod)}
              </td>
              <td className="py-2 text-right tabular-nums">{kraj.ile}</td>
              <td className="py-2 text-right tabular-nums text-[#111827]/55">{kraj.osoby}</td>
              <td className="py-2 text-right tabular-nums text-[#111827]/45">
                {razem ? `${Math.round((kraj.ile / razem) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const o = dane.odslony
  const kf = dane.konfiguratory

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2">
        {[
          { ile: 1, nazwa: "dziś" },
          { ile: 7, nazwa: "7 dni" },
          { ile: 30, nazwa: "30 dni" },
          { ile: 90, nazwa: "90 dni" },
          { ile: 365, nazwa: "rok" },
          // Zero to cała historia. Nic nie kasujemy, więc nie ma powodu,
          // żeby panel się na czymkolwiek zatrzymywał.
          { ile: 0, nazwa: "wszystko" },
        ].map((zakres) => (
          <button
            key={zakres.ile}
            onClick={() => setDni(zakres.ile)}
            className={`rounded-sm px-4 py-2 text-sm ${
              zakres.ile === dni ? "bg-[#2E64A8] text-white" : "border border-[#111827]/15"
            }`}
          >
            {zakres.nazwa}
          </button>
        ))}

        <a
          href={`/api/admin/statystyki/eksport?dni=${dni}&co=odslony`}
          className="ml-auto rounded-sm border border-[#111827]/15 px-4 py-2 text-sm hover:border-[#2E64A8] hover:text-[#2E64A8]"
        >
          Odsłony do Excela
        </a>
        <a
          href={`/api/admin/statystyki/eksport?dni=${dni}`}
          className="rounded-sm border border-[#111827]/15 px-4 py-2 text-sm hover:border-[#2E64A8] hover:text-[#2E64A8]"
        >
          Wyszukiwania do Excela
        </a>
      </div>

      {o.dostepne ? (
        <div className="mb-14">
          <p className="mb-8 text-sm text-[#111827]/60">
            Odsłon w tym okresie: <strong>{o.razem}</strong> od{" "}
            <strong>{o.unikalnych}</strong> unikalnych odwiedzających — łodzie{" "}
            <strong>{o.razemLodzie}</strong>, sklep <strong>{o.razemSklep}</strong>.
          </p>

          <p className="mb-8 max-w-3xl text-xs leading-6 text-[#111827]/45">
            Roboty indeksujące odrzucamy przy zapisie, a jedną osobę rozpoznajemy po
            ciasteczku sklejonym z dobowym odciskiem — bez tego klient, który ciasteczek
            nie przechowuje, liczył się jako nowa osoba przy każdej odsłonie.
            Wpisy sprzed tej zmiany zostają w bazie takie, jakie są.
          </p>

          <Wykres seria={o.seria} />

          <div className="grid gap-10 lg:grid-cols-2">
            <Strony
              tytul="Najczęściej otwierane — łodzie"
              lead="Strony modeli, marek, giełdy i aktualności."
              strony={o.lodzie}
            />
            <Strony
              tytul="Najczęściej otwierane — sklep"
              lead="Produkty, kategorie i koszyk."
              strony={o.sklep}
            />
          </div>

          <div className="mt-10">
            <Kraje kraje={o.kraje} />
          </div>

          {o.zrodla.length ? (
            <div className="mt-10">
              <h2 className="text-lg font-semibold">Skąd przychodzą</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/55">
                Domena strony, z której ktoś kliknął do nas. „Wejście bezpośrednie" to
                wpisany adres, zakładka albo link z maila — przeglądarka nie mówi wtedy skąd.
              </p>
              <table className="mt-4 w-full max-w-xl text-sm">
                <tbody>
                  {o.zrodla.map((zrodlo) => (
                    <tr key={zrodlo.nazwa} className="border-b border-[#111827]/5 last:border-0">
                      <td className="py-2">{zrodlo.nazwa}</td>
                      <td className="w-24 py-2 text-right tabular-nums">{zrodlo.ile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mb-14 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm">
          Statystyka odsłon niedostępna ({o.powod}).
        </p>
      )}

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

      {kf.dostepne ? (
        <div className="mt-14">
          <h2 className="text-lg font-semibold">Konfiguratory — przeklikane i porzucone</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/55">
            Ktoś otworzył konfigurator, wybrał opcje i nie wysłał oferty. Sama liczba
            wysłanych ofert tego nie pokaże, bo porzucona konfiguracja nie zostawia po sobie
            nic — a to właśnie ona mówi, gdzie coś nie zagrało: cena, opis albo formularz.
            W tym okresie zaczętych konfiguracji: <strong>{kf.zaczete}</strong> od{" "}
            <strong>{kf.unikalnych}</strong> osób, wysłanych <strong>{kf.wyslane}</strong>.
            Porzuconych z wypełnionymi danymi: <strong>{kf.zDanymi}</strong>.
          </p>

          {kf.modele.length ? (
            <div className="mt-5 overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-wider text-[#111827]/45">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Model</th>
                    <th className="px-4 py-3 text-right font-semibold">Zaczęte</th>
                    <th className="px-4 py-3 text-right font-semibold">Osób</th>
                    <th className="px-4 py-3 text-right font-semibold">Wysłane</th>
                    <th className="px-4 py-3 text-right font-semibold">Porzucone</th>
                    <th className="px-4 py-3 text-right font-semibold">Średnia porzuconej</th>
                  </tr>
                </thead>
                <tbody>
                  {kf.modele.map((wpis) => (
                    <tr key={wpis.slug || wpis.model} className="border-b border-[#111827]/5 last:border-0">
                      <td className="px-4 py-3">
                        {wpis.slug ? (
                          <a
                            href={`/modele/${wpis.slug}#konfigurator`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-[#2E64A8]"
                          >
                            {wpis.model}
                          </a>
                        ) : (
                          wpis.model
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{wpis.zaczete}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#111827]/55">
                        {wpis.unikalnych}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                        {wpis.wyslane}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {wpis.porzucone}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#111827]/60">
                        {wpis.sredniaPorzuconych
                          ? `${wpis.sredniaPorzuconych.toLocaleString("pl-PL")} ${wpis.waluta}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 text-sm text-[#111827]/40">
              Nikt jeszcze nie klikał w konfiguratorze w tym okresie.
            </p>
          )}

          {kf.ostatnie.length ? (
            <div className="mt-8">
              <h3 className="text-base font-semibold">Ostatnio porzucone</h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/55">
                Etap „wypełnia dane" znaczy, że ktoś doszedł już do formularza i się
                zatrzymał — tam najczęściej da się jeszcze coś uratować.
              </p>
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {kf.ostatnie.map((wpis, numer) => (
                    <tr key={`${wpis.slug}-${numer}`} className="border-b border-[#111827]/5 last:border-0">
                      <td className="py-2 whitespace-nowrap text-[#111827]/50">{kiedy(wpis.kiedy)}</td>
                      <td className="py-2">
                        {wpis.model}
                        {/* Kontakt zostawiony pod konfiguratorem, choć oferta
                            nie poszła — do takiej osoby warto oddzwonić. */}
                        {wpis.imie || wpis.email || wpis.telefon ? (
                          <span className="block text-xs text-[#2E64A8]">
                            {[wpis.imie, wpis.telefon, wpis.email].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                        {wpis.uwagi ? (
                          <span className="block text-xs text-[#111827]/40">{wpis.uwagi}</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-[#111827]/50">
                        {wpis.etap === "dane" ? "wypełnia dane" : "klikanie"}
                      </td>
                      <td className="py-2 text-right text-[#111827]/50">{wpis.opcji} opcji</td>
                      <td className="py-2 text-right tabular-nums">
                        {wpis.wartosc
                          ? `${Math.round(wpis.wartosc).toLocaleString("pl-PL")} ${wpis.waluta}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-14 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm">
          Statystyka konfiguratorów niedostępna ({kf.powod}).
        </p>
      )}

      <div className="mt-14">
        <h2 className="text-lg font-semibold">Koszyki w tej chwili</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#111827]/55">
          Niedokończone koszyki z towarem w środku — ktoś jest w trakcie zakupów albo
          się rozmyślił. Koszyk z adresem e-mail to ktoś, kto zaczął wypełniać zamówienie.
          Pokazujemy ruch z ostatnich dwóch tygodni; złożone zamówienia znikają z listy.
        </p>

        {k.dostepne ? (
          k.koszyki.length ? (
            <div className="mt-5 overflow-x-auto rounded-lg border border-[#111827]/10 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-wider text-[#111827]/45">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ostatni ruch</th>
                    <th className="px-4 py-3 font-semibold">W koszyku</th>
                    <th className="px-4 py-3 font-semibold">Etap</th>
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
                        {koszyk.pozycje || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#111827]/60">
                        {koszyk.etap === "zamowienie" ? "wypełnia zamówienie" : "koszyk"}
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
            {k.powod === "brak_tokenu_directus"
              ? "Brakuje DIRECTUS_ADMIN_TOKEN w .env.local na serwerze."
              : "Directus odrzucił zapytanie o kolekcję active_carts."}
          </p>
        )}
      </div>
    </>
  )
}
