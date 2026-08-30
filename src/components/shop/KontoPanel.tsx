"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { shop } from "@/components/shop/theme"
import { formatPrice } from "@/lib/medusa"

type Klient = { email: string; imie: string; nazwisko: string; telefon: string }
type Zamowienie = {
  id: string
  numer: string
  kiedy: string
  suma: number
  stan: string
  oplacone: boolean
  pozycje: { tytul: string; ile: number }[]
}

function kiedy(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("pl-PL", { dateStyle: "long" })
}

export default function KontoPanel({
  klient,
  zamowienia,
}: {
  klient: Klient
  zamowienia: Zamowienie[]
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
              <div key={zamowienie.id} className="border border-[#0E1A2B]/12 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    Zamówienie {zamowienie.numer}
                    <span className="ml-3 font-normal text-[#0E1A2B]/45">
                      {kiedy(zamowienie.kiedy)}
                    </span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        zamowienie.oplacone
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-amber-500/15 text-amber-800"
                      }`}
                    >
                      {zamowienie.oplacone ? "opłacone" : "oczekuje na płatność"}
                    </span>
                    <strong className="tabular-nums">{formatPrice(zamowienie.suma)}</strong>
                  </p>
                </div>

                <ul className="mt-3 text-sm text-[#0E1A2B]/60">
                  {zamowienie.pozycje.map((pozycja, numer) => (
                    <li key={`${zamowienie.id}-${numer}`}>
                      {pozycja.ile} × {pozycja.tytul}
                    </li>
                  ))}
                </ul>
              </div>
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
