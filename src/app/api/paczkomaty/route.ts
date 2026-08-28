import { NextResponse } from "next/server"

export const runtime = "nodejs"
// Lista automatów zmienia się rzadko, a szukanie odpytuje ją przy każdym
// wpisanym mieście — godzina pamięci wystarczy z zapasem.
export const revalidate = 3600

/**
 * Wyszukiwarka paczkomatów InPost.
 *
 * Lista punktów stoi w publicznym API InPostu (ShipX) i nie wymaga żadnego
 * klucza — pytamy o nią z serwera, żeby przeglądarka nie chodziła po obcym
 * adresie i żeby dało się to zapamiętać między klientami.
 *
 * Widżetu InPostu celowo nie wstawiamy: od 2024 wymaga własnego tokenu
 * i wciąga na stronę cudzą mapę razem z jej ciasteczkami. Do wybrania punktu
 * wystarczy nazwa ulicy i miasto.
 */
const SHIPX = "https://api-shipx-pl.easypack24.net/v1/points"

export type Paczkomat = {
  kod: string
  opis: string
  ulica: string
  miasto: string
  kod_pocztowy: string
}

export async function GET(request: Request) {
  const szukane = (new URL(request.url).searchParams.get("q") || "").trim()
  if (szukane.length < 3) return NextResponse.json({ punkty: [] })

  // Kod pocztowy rozpoznajemy po zapisie — InPost ma na niego osobne pole,
  // a wrzucony do `city` nie znajduje niczego.
  const kodPocztowy = /^\d{2}-?\d{3}$/.test(szukane)
  const parametry = new URLSearchParams({
    type: "parcel_locker",
    status: "Operating",
    per_page: "40",
    ...(kodPocztowy
      ? { post_code: szukane.length === 5 ? `${szukane.slice(0, 2)}-${szukane.slice(2)}` : szukane }
      : { city: szukane }),
  })

  try {
    const odpowiedz = await fetch(`${SHIPX}?${parametry}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    })
    if (!odpowiedz.ok) return NextResponse.json({ punkty: [], powod: `inpost_${odpowiedz.status}` })

    const dane = await odpowiedz.json()
    const punkty: Paczkomat[] = (dane?.items || []).map((punkt: any) => ({
      kod: punkt.name,
      opis: punkt.location_description || "",
      ulica: punkt.address?.line1 || punkt.address_details?.street || "",
      miasto: punkt.address_details?.city || "",
      kod_pocztowy: punkt.address_details?.post_code || "",
    }))

    return NextResponse.json({ punkty })
  } catch {
    return NextResponse.json({ punkty: [], powod: "inpost_niedostepny" })
  }
}
