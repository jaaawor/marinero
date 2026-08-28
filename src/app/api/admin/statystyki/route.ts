import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

type Wpis = { fraza: string; gdzie: string; wynikow: number | null; date_created: string }

function odIlu(dni: number) {
  return new Date(Date.now() - dni * 24 * 60 * 60 * 1000).toISOString()
}

async function szukania(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/search_queries` +
    `?limit=-1&fields=fraza,gdzie,wynikow,date_created` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const wpisy: Wpis[] = (await odpowiedz.json())?.data || []

  // Zliczamy po frazie **znormalizowanej** (małe litery, zbite spacje), ale
  // pokazujemy pierwszy oryginalny zapis — inaczej „Nordkapp" i „nordkapp"
  // byłyby dwoma osobnymi wierszami.
  function podsumuj(gdzie: string) {
    const kubelki = new Map<string, { fraza: string; ile: number; bezWynikow: number }>()
    for (const wpis of wpisy) {
      if (wpis.gdzie !== gdzie) continue
      const klucz = wpis.fraza.toLowerCase().replace(/\s+/g, " ").trim()
      const kubelek = kubelki.get(klucz) || { fraza: wpis.fraza, ile: 0, bezWynikow: 0 }
      kubelek.ile += 1
      if (wpis.wynikow === 0) kubelek.bezWynikow += 1
      kubelki.set(klucz, kubelek)
    }
    return [...kubelki.values()].sort((a, b) => b.ile - a.ile)
  }

  const lodzie = podsumuj("lodzie")
  const sklep = podsumuj("sklep")

  return {
    dostepne: true as const,
    dni,
    razem: wpisy.length,
    lodzie: lodzie.slice(0, 40),
    sklep: sklep.slice(0, 40),
    // Frazy bez ani jednego wyniku to najkonkretniejszy sygnał, jaki daje
    // wyszukiwarka: ludzie szukają czegoś, czego nie mamy albo co nazywa się
    // u nas inaczej.
    bezWynikow: [...lodzie.map((w) => ({ ...w, gdzie: "lodzie" })), ...sklep.map((w) => ({ ...w, gdzie: "sklep" }))]
      .filter((w) => w.bezWynikow > 0)
      .sort((a, b) => b.bezWynikow - a.bezWynikow)
      .slice(0, 30),
  }
}

async function koszyki() {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  // Medusa 2 nie wystawia listy koszyków przez API (`/admin/carts` odpowiada 404),
  // więc czytamy własne migawki z kolekcji `active_carts` — zapisuje je sklep
  // przy każdej zmianie koszyka i przy wypełnianiu zamówienia.
  const adres =
    `${DIRECTUS}/items/active_carts` +
    `?limit=60&sort=-date_updated&fields=id,cart_id,pozycje,sztuk,wartosc,email,etap,date_updated,date_created` +
    `&filter[etap][_neq]=zlozone` +
    `&filter[date_updated][_gte]=${encodeURIComponent(odIlu(14))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const lista = ((await odpowiedz.json())?.data || [])
    .filter((wpis: any) => Number(wpis.sztuk) > 0)
    .map((wpis: any) => ({
      id: String(wpis.id),
      email: wpis.email || "",
      zmieniony: wpis.date_updated || wpis.date_created,
      suma: Number(wpis.wartosc) || 0,
      waluta: "PLN",
      sztuk: Number(wpis.sztuk) || 0,
      etap: wpis.etap || "koszyk",
      pozycje: String(wpis.pozycje || ""),
    }))

  return { dostepne: true as const, koszyki: lista }
}

export async function GET(request: Request) {
  const zalogowany = await getAdminToken()
  if (!zalogowany) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  const dni = Number(new URL(request.url).searchParams.get("dni")) || 30

  const [wyszukiwania, aktywne] = await Promise.all([
    szukania(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    koszyki().catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
  ])

  return NextResponse.json({ szukania: wyszukiwania, koszyki: aktywne })
}
