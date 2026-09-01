"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { shop } from "@/components/shop/theme"
import { formatPrice } from "@/lib/medusa"
import { linkSledzenia, nazwaPrzewoznika } from "@/lib/przewoznicy"

type Klient = { email: string; imie: string; nazwisko: string; telefon: string }

type Pozycja = {
  tytul: string
  wariant: string
  ile: number
  cena: number
  razem: number
  handle: string
  zdjecie: string
}

type Zamowienie = {
  id: string
  numer: string
  kiedy: string
  suma: number
  sumaPozycji: number
  dostawaKoszt: number
  rabat: number
  waluta: string
  stan: string
  oplacone: boolean
  platnosc: string
  obsluga: string
  numerPrzesylki: string
  przewoznik: string
  dostawa: string
  adres: {
    imie: string
    nazwisko: string
    ulica: string
    kod: string
    miasto: string
    kraj: string
    telefon: string
    firma: string
  } | null
  nip: string
  pozycje: Pozycja[]
}

/**
 * Stan obsługi opisany po ludzku. To jest **nasz** stan z panelu
 * (`metadata.obsluga`), a nie `fulfillment_status` Medusy — realizacji przez
 * moduł Medusy tu nie prowadzimy, bo sklep nie ma magazynu.
 */
const STANY: Record<string, { nazwa: string; opis: string; klasa: string }> = {
  nowe: {
    nazwa: "Przyjęte",
    opis: "Zamówienie do nas dotarło. Odezwiemy się, gdy ruszy kompletowanie.",
    klasa: "bg-[#2E64A8]/10 text-[#2E64A8]",
  },
  "w-realizacji": {
    nazwa: "W realizacji",
    opis: "Kompletujemy zamówienie. Numer przesyłki pojawi się tutaj po nadaniu.",
    klasa: "bg-amber-500/15 text-amber-800",
  },
  wyslane: {
    nazwa: "Wysłane",
    opis: "Paczka jest u przewoźnika.",
    klasa: "bg-emerald-500/12 text-emerald-700",
  },
  anulowane: {
    nazwa: "Anulowane",
    opis: "Zamówienie zostało anulowane. Jeśli to pomyłka, napisz do nas.",
    klasa: "bg-[#0E1A2B]/8 text-[#0E1A2B]/60",
  },
}

function stanZamowienia(klucz: string) {
  return STANY[klucz] || STANY.nowe
}

function kiedy(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("pl-PL", { dateStyle: "long" })
}

function Wiersz({ nazwa, wartosc }: { nazwa: string; wartosc: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#0E1A2B]/50">{nazwa}</span>
      <span className="tabular-nums">{wartosc}</span>
    </div>
  )
}

/** Jedno zamówienie: nagłówek zawsze, szczegóły po rozwinięciu. */
function Karta({ zamowienie, prefiks }: { zamowienie: Zamowienie; prefiks: string }) {
  const [otwarte, setOtwarte] = useState(false)
  const stan = stanZamowienia(zamowienie.obsluga)
  const sledzenie = linkSledzenia(zamowienie.przewoznik, zamowienie.numerPrzesylki)
  const firma = nazwaPrzewoznika(zamowienie.przewoznik)
  const kwota = (wartosc: number) => formatPrice(wartosc, zamowienie.waluta)

  return (
    <div className="border border-[#0E1A2B]/12 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-5">
        <p className="font-semibold">
          Zamówienie {zamowienie.numer}
          <span className="ml-3 font-normal text-[#0E1A2B]/45">{kiedy(zamowienie.kiedy)}</span>
        </p>

        <p className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs ${stan.klasa}`}>{stan.nazwa}</span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${
              zamowienie.oplacone
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-amber-500/15 text-amber-800"
            }`}
          >
            {zamowienie.oplacone ? "opłacone" : "oczekuje na płatność"}
          </span>
          <strong className="tabular-nums">{kwota(zamowienie.suma)}</strong>
        </p>
      </div>

      {/* Pozycje pokazujemy zawsze — po to klient tu wchodzi. Kliknięcie
          prowadzi na stronę produktu w sklepie, żeby dało się dokupić to samo
          bez szukania w katalogu. Bez `handle` (produkt zdjęty ze sprzedaży)
          zostaje sam napis, a nie link donikąd. */}
      <ul className="border-t border-[#0E1A2B]/8 px-5 py-4">
        {zamowienie.pozycje.map((pozycja, numer) => {
          const tresc = (
            <>
              {/* Zwykły `<img>`, tak jak w kartach produktu: zdjęcia stoją
                  na hoście Medusy, którego nie ma w `images.remotePatterns`,
                  więc `next/image` odbiłby je błędem. */}
              <span className="block h-14 w-14 shrink-0 overflow-hidden border border-[#0E1A2B]/10 bg-white">
                {pozycja.zdjecie ? (
                  <img
                    src={pozycja.zdjecie}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-1"
                  />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{pozycja.tytul}</span>
                {pozycja.wariant ? (
                  <span className="block text-xs text-[#0E1A2B]/45">{pozycja.wariant}</span>
                ) : null}
                <span className="block text-xs text-[#0E1A2B]/45">
                  {pozycja.ile} × {kwota(pozycja.cena)}
                </span>
              </span>

              <span className="shrink-0 text-sm tabular-nums">{kwota(pozycja.razem)}</span>
            </>
          )

          return (
            <li key={`${zamowienie.id}-${numer}`} className="border-b border-[#0E1A2B]/6 last:border-0">
              {pozycja.handle ? (
                <Link
                  href={`${prefiks}/sklep/produkt/${pozycja.handle}`}
                  className="flex items-center gap-4 py-3 transition hover:text-[#2E64A8]"
                >
                  {tresc}
                </Link>
              ) : (
                <div className="flex items-center gap-4 py-3">{tresc}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-t border-[#0E1A2B]/8 px-5 py-3">
        <button
          type="button"
          onClick={() => setOtwarte((teraz) => !teraz)}
          className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/50 transition hover:text-[#2E64A8]"
        >
          {otwarte ? "Zwiń szczegóły" : "Szczegóły zamówienia"}
        </button>
      </div>

      {otwarte ? (
        <div className="grid gap-8 border-t border-[#0E1A2B]/8 p-5 text-sm md:grid-cols-2">
          <div>
            <p className={shop.label}>Stan zamówienia</p>
            <p className="leading-6 text-[#0E1A2B]/70">{stan.opis}</p>

            {zamowienie.numerPrzesylki ? (
              <div className="mt-4">
                <p className={shop.label}>Przesyłka</p>
                <p className="leading-6">
                  {firma ? `${firma}, numer ` : "Numer "}
                  <strong className="tabular-nums">{zamowienie.numerPrzesylki}</strong>
                </p>

                {sledzenie ? (
                  <a
                    href={sledzenie}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-semibold text-[#2E64A8] hover:underline"
                  >
                    Śledź przesyłkę →
                  </a>
                ) : (
                  // Bez przewoźnika nie zgadujemy, na czyjej stronie wpisać
                  // numer — odesłanie do cudzej wyszukiwarki jest gorsze niż
                  // brak odnośnika.
                  <p className="mt-2 text-xs text-[#0E1A2B]/45">
                    Numer wpisz na stronie przewoźnika podanego w mailu o nadaniu.
                  </p>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              <p className={shop.label}>Dostawa</p>
              <p className="leading-6 text-[#0E1A2B]/70">
                {zamowienie.dostawa || "Sposób dostawy ustalany indywidualnie"}
              </p>

              {zamowienie.adres ? (
                <p className="mt-2 leading-6 text-[#0E1A2B]/70">
                  {zamowienie.adres.firma ? (
                    <>
                      {zamowienie.adres.firma}
                      <br />
                    </>
                  ) : null}
                  {[zamowienie.adres.imie, zamowienie.adres.nazwisko].filter(Boolean).join(" ")}
                  <br />
                  {zamowienie.adres.ulica}
                  <br />
                  {[zamowienie.adres.kod, zamowienie.adres.miasto].filter(Boolean).join(" ")}
                  {zamowienie.adres.kraj ? `, ${zamowienie.adres.kraj}` : ""}
                  {zamowienie.adres.telefon ? (
                    <>
                      <br />
                      tel. {zamowienie.adres.telefon}
                    </>
                  ) : null}
                </p>
              ) : null}

              {zamowienie.nip ? (
                <p className="mt-2 text-[#0E1A2B]/70">NIP / VAT UE: {zamowienie.nip}</p>
              ) : null}
            </div>
          </div>

          <div>
            <p className={shop.label}>Kwoty</p>
            <div className="grid gap-1.5">
              <Wiersz nazwa="Produkty" wartosc={kwota(zamowienie.sumaPozycji)} />
              {zamowienie.rabat ? (
                <Wiersz nazwa="Rabat" wartosc={`−${kwota(zamowienie.rabat)}`} />
              ) : null}
              <Wiersz
                nazwa="Dostawa"
                wartosc={zamowienie.dostawaKoszt ? kwota(zamowienie.dostawaKoszt) : "0,00 zł"}
              />
              <div className="mt-1 flex justify-between gap-4 border-t border-[#0E1A2B]/10 pt-2 font-semibold">
                <span>Razem</span>
                <span className="tabular-nums">{kwota(zamowienie.suma)}</span>
              </div>
            </div>

            <p className={`${shop.label} mt-6`}>Zwrot i reklamacja</p>
            <p className="leading-6 text-[#0E1A2B]/70">
              Od odbioru masz <strong>14 dni</strong> na odstąpienie od umowy bez podania
              przyczyny. Reklamację z tytułu niezgodności towaru z umową zgłaszasz tak samo —
              napisz na{" "}
              <a href="mailto:biuro@marinero.pl" className="font-semibold text-[#2E64A8] hover:underline">
                biuro@marinero.pl
              </a>{" "}
              i podaj numer zamówienia {zamowienie.numer}. Szczegóły w{" "}
              <Link href={`${prefiks}/regulamin`} className="font-semibold text-[#2E64A8] hover:underline">
                regulaminie
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function KontoPanel({
  klient,
  zamowienia,
  prefiks = "",
}: {
  klient: Klient
  zamowienia: Zamowienie[]
  /** Przedrostek języka („" dla polskiego, „/en" dla reszty). */
  prefiks?: string
}) {
  const router = useRouter()
  const [pola, setPola] = useState({
    imie: klient.imie,
    nazwisko: klient.nazwisko,
    telefon: klient.telefon,
  })
  const [stan, setStan] = useState("")

  async function zapisz(zdarzenie: FormEvent) {
    zdarzenie.preventDefault()
    setStan("zapisuję…")

    const wynik = await fetch("/api/konto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ co: "dane", ...pola }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false }))

    setStan(wynik.ok ? "Zapisane." : "Nie udało się zapisać.")
    if (wynik.ok) router.refresh()
  }

  async function wyloguj() {
    await fetch("/api/konto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ co: "wyloguj" }),
    }).catch(() => {})

    router.refresh()
    router.push("/sklep")
  }

  function pole(nazwa: keyof typeof pola) {
    return {
      value: pola[nazwa],
      onChange: (zdarzenie: { target: { value: string } }) =>
        setPola((teraz) => ({ ...teraz, [nazwa]: zdarzenie.target.value })),
      className: shop.input,
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
      <div>
        <h2 className={`${shop.display} text-2xl`}>Twoje zamówienia</h2>

        {zamowienia.length ? (
          <div className="mt-6 space-y-4">
            {zamowienia.map((zamowienie) => (
              <Karta key={zamowienie.id} zamowienie={zamowienie} prefiks={prefiks} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm leading-7 text-[#0E1A2B]/55">
            Nie mamy jeszcze zamówień na ten adres. Pokazujemy tu wszystko, co kupiłeś
            na <strong>{klient.email}</strong> — także zakupy zrobione bez logowania.
          </p>
        )}
      </div>

      <aside className="h-fit border border-[#0E1A2B]/12 bg-white p-6">
        <h2 className={`${shop.display} text-xl`}>Twoje dane</h2>
        <p className="mt-2 text-sm text-[#0E1A2B]/55">{klient.email}</p>

        <form onSubmit={zapisz} className="mt-5 grid gap-4">
          <div>
            <label className={shop.label} htmlFor="k-imie">
              Imię
            </label>
            <input id="k-imie" {...pole("imie")} />
          </div>
          <div>
            <label className={shop.label} htmlFor="k-nazwisko">
              Nazwisko
            </label>
            <input id="k-nazwisko" {...pole("nazwisko")} />
          </div>
          <div>
            <label className={shop.label} htmlFor="k-telefon">
              Telefon
            </label>
            <input id="k-telefon" type="tel" {...pole("telefon")} />
          </div>

          <button type="submit" className={`${shop.btnGhost} w-full`}>
            Zapisz
          </button>

          {stan ? <p className="text-sm text-[#0E1A2B]/55">{stan}</p> : null}
        </form>

        <div className="mt-6 border-t border-[#0E1A2B]/10 pt-5 text-sm leading-6 text-[#0E1A2B]/55">
          <p className="font-semibold text-[#0E1A2B]">Potrzebujesz pomocy?</p>
          <p className="mt-1">
            Pisz na{" "}
            <a href="mailto:biuro@marinero.pl" className="font-semibold text-[#2E64A8] hover:underline">
              biuro@marinero.pl
            </a>{" "}
            — zwroty, reklamacje, faktury i zmiany w zamówieniu.
          </p>
        </div>

        <button
          type="button"
          onClick={wyloguj}
          className="mt-6 text-[13px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/50 transition hover:text-[#2E64A8]"
        >
          Wyloguj się
        </button>
      </aside>
    </div>
  )
}
