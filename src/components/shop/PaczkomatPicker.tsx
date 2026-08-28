"use client"

import { useEffect, useState } from "react"
import { shop } from "@/components/shop/theme"

type Paczkomat = {
  kod: string
  opis: string
  ulica: string
  miasto: string
  kod_pocztowy: string
}

type Props = {
  /** Kod wybranego automatu, np. `GDY01B`. */
  wybrany: string
  onWybor: (paczkomat: Paczkomat | null) => void
  /** Miasto z formularza — pierwsze wyszukanie robimy za klienta. */
  miasto?: string
}

/**
 * Wybór paczkomatu InPost.
 *
 * Zamiast widżetu InPostu (od 2024 wymaga własnego tokenu i wciąga na stronę
 * cudzą mapę razem z ciasteczkami) — zwykłe szukanie po mieście albo kodzie
 * pocztowym. Lista idzie z naszego `/api/paczkomaty`, które pyta publiczne API
 * InPostu i pamięta odpowiedź przez godzinę.
 */
export default function PaczkomatPicker({ wybrany, onWybor, miasto = "" }: Props) {
  const [fraza, setFraza] = useState(miasto)
  const [punkty, setPunkty] = useState<Paczkomat[]>([])
  const [szukam, setSzukam] = useState(false)
  const [szukane, setSzukane] = useState("")

  // Podpowiadamy listę dla miasta z adresu, ale tylko raz — gdyby lecieć za
  // każdą literą wpisywaną w adresie, lista skakałaby pod ręką.
  useEffect(() => {
    if (!fraza && miasto) setFraza(miasto)
  }, [miasto, fraza])

  useEffect(() => {
    const pytanie = fraza.trim()
    if (pytanie.length < 3) {
      setPunkty([])
      return
    }

    const licznik = setTimeout(() => {
      setSzukam(true)
      fetch(`/api/paczkomaty?q=${encodeURIComponent(pytanie)}`)
        .then((odpowiedz) => odpowiedz.json())
        .then((dane) => {
          setPunkty(dane?.punkty || [])
          setSzukane(pytanie)
        })
        .catch(() => setPunkty([]))
        .finally(() => setSzukam(false))
    }, 400)

    return () => clearTimeout(licznik)
  }, [fraza])

  const wybranyPunkt = punkty.find((punkt) => punkt.kod === wybrany)

  return (
    <div className="mt-4 rounded-sm border border-[#0E1A2B]/15 bg-[#F4F1EC] p-4">
      <label className={shop.label} htmlFor="paczkomat-szukaj">
        Wybierz paczkomat
      </label>

      <input
        id="paczkomat-szukaj"
        value={fraza}
        onChange={(event) => setFraza(event.target.value)}
        placeholder="Miasto albo kod pocztowy"
        className={shop.input}
        autoComplete="off"
      />

      {wybrany ? (
        <p className="mt-3 text-sm">
          Wybrany automat: <span className="font-semibold">{wybrany}</span>
          {wybranyPunkt ? ` — ${wybranyPunkt.ulica}, ${wybranyPunkt.miasto}` : ""}
          <button
            type="button"
            onClick={() => onWybor(null)}
            className="ml-3 text-[13px] font-bold uppercase tracking-[0.16em] text-[#2E64A8]"
          >
            Zmień
          </button>
        </p>
      ) : null}

      {szukam ? <p className="mt-3 text-sm text-[#0E1A2B]/50">Szukam…</p> : null}

      {!szukam && !wybrany && punkty.length ? (
        <ul className="mt-3 max-h-64 overflow-y-auto rounded-sm border border-[#0E1A2B]/10 bg-white">
          {punkty.map((punkt) => (
            <li key={punkt.kod} className="border-b border-[#0E1A2B]/5 last:border-0">
              <button
                type="button"
                onClick={() => onWybor(punkt)}
                className="block w-full px-4 py-3 text-left text-sm transition hover:bg-[#F4F1EC]"
              >
                <span className="font-semibold">{punkt.kod}</span> — {punkt.ulica},{" "}
                {punkt.kod_pocztowy} {punkt.miasto}
                {punkt.opis ? (
                  <span className="block text-[#0E1A2B]/50">{punkt.opis}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!szukam && !wybrany && szukane && !punkty.length ? (
        <p className="mt-3 text-sm text-[#0E1A2B]/50">
          Nie znalazłem paczkomatu dla „{szukane}". Spróbuj samej nazwy miasta.
        </p>
      ) : null}
    </div>
  )
}
