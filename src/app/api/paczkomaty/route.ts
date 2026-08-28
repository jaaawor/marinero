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

// InPost filtruje po nazwie miasta **dokładnie**: „GDYNIA" i „gdynia" dają zero
// wyników, a „Gdansk" bez ogonka też. Klient wpisuje jak wpisuje — i zwykle
// jest to miasto przepisane z pola adresu, czyli często wersalikami.
function zNazwyMiasta(tekst: string): string {
  return tekst
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((czesc) => (/^[\s-]/.test(czesc) ? czesc : czesc.charAt(0).toUpperCase() + czesc.slice(1)))
    .join("")
}

// Miasta, które klienci najczęściej piszą bez polskich znaków. Pełnego słownika
// nie da się tu zrobić — InPost nie ma wyszukiwania rozmytego, a lista wszystkich
// automatów to kilkadziesiąt megabajtów. Ta garść to miasta wojewódzkie
// i wybrzeże, czyli tam, gdzie mieszkają nasi klienci.
const BEZ_OGONKOW: Record<string, string> = {
  Gdansk: "Gdańsk",
  Krakow: "Kraków",
  Poznan: "Poznań",
  Lodz: "Łódź",
  Wroclaw: "Wrocław",
  Torun: "Toruń",
  Bialystok: "Białystok",
  Czestochowa: "Częstochowa",
  Rzeszow: "Rzeszów",
  "Gorzow Wielkopolski": "Gorzów Wielkopolski",
  "Zielona Gora": "Zielona Góra",
  "Jelenia Gora": "Jelenia Góra",
  "Nowy Sacz": "Nowy Sącz",
  Plock: "Płock",
  Wloclawek: "Włocławek",
  Slupsk: "Słupsk",
  Swinoujscie: "Świnoujście",
  Kolobrzeg: "Kołobrzeg",
  Leba: "Łeba",
  Elblag: "Elbląg",
  Suwalki: "Suwałki",
  Koscierzyna: "Kościerzyna",
  Darlowo: "Darłowo",
  Miedzyzdroje: "Międzyzdroje",
  Goleniow: "Goleniów",
  Wladyslawowo: "Władysławowo",
  Jastarnia: "Jastarnia",
  Wegorzewo: "Węgorzewo",
  Gizycko: "Giżycko",
  Mikolajki: "Mikołajki",
  Ilawa: "Iława",
  Ostroda: "Ostróda",
}

const KOD_POCZTOWY = /^\d{2}-?\d{3}$/

function adresy(szukane: string): string[] {
  const wspolne = { type: "parcel_locker", status: "Operating", per_page: "40" }

  if (KOD_POCZTOWY.test(szukane)) {
    const kod = szukane.length === 5 ? `${szukane.slice(0, 2)}-${szukane.slice(2)}` : szukane
    return [String(new URLSearchParams({ ...wspolne, post_code: kod }))]
  }

  const miasto = zNazwyMiasta(szukane)
  const zOgonkami = BEZ_OGONKOW[miasto]

  // Najpierw tak, jak wpisał klient (po poprawieniu wielkości liter), a dopiero
  // gdy to nic nie da — z przywróconymi ogonkami.
  return [miasto, ...(zOgonkami && zOgonkami !== miasto ? [zOgonkami] : [])].map((nazwa) =>
    String(new URLSearchParams({ ...wspolne, city: nazwa }))
  )
}

export async function GET(request: Request) {
  const szukane = (new URL(request.url).searchParams.get("q") || "").trim()
  if (szukane.length < 3) return NextResponse.json({ punkty: [] })

  try {
    let odpowiedz: Response | null = null
    let dane: any = null

    for (const parametry of adresy(szukane)) {
      odpowiedz = await fetch(`${SHIPX}?${parametry}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      })
      if (!odpowiedz.ok) return NextResponse.json({ punkty: [], powod: `inpost_${odpowiedz.status}` })

      dane = await odpowiedz.json()
      if ((dane?.items || []).length) break
    }

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
