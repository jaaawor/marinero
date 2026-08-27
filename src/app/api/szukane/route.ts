import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

// Zapis idzie **tokenem serwera**, tak samo jak formularz kontaktowy i oferty.
// Publicznego zapisu tu nie chcemy: kolekcja stałaby otworem dla botów, a wtedy
// statystyka wyszukiwań mówiłaby o botach, nie o klientach.
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

const GDZIE = new Set(["lodzie", "sklep"])

/**
 * Zapisuje frazę z wyszukiwarki. Bez adresu IP, ciasteczka i czegokolwiek,
 * co wskazuje na osobę — interesuje nas, **czego** ludzie szukają, a nie kto.
 */
export async function POST(request: Request) {
  if (!TOKEN) return NextResponse.json({ zapisane: false, powod: "brak_tokenu" })

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ error: "zly_json" }, { status: 400 })
  }

  const fraza = String(dane?.fraza || "").trim().slice(0, 120)
  const gdzie = String(dane?.gdzie || "")
  const wynikow = Number(dane?.wynikow)

  // Jedna i dwie litery to jeszcze nie jest zapytanie, tylko połowa słowa
  // wpisywana na klawiaturze — takie wpisy zalałyby statystykę.
  if (fraza.length < 3 || !GDZIE.has(gdzie)) {
    return NextResponse.json({ zapisane: false, powod: "za_krotkie" })
  }

  try {
    await fetch(`${DIRECTUS}/items/search_queries`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        fraza,
        gdzie,
        wynikow: Number.isFinite(wynikow) ? wynikow : null,
      }),
      cache: "no-store",
    })
  } catch {
    // Statystyka nie może przeszkodzić w szukaniu — jak Directus nie odpowie,
    // po prostu nie zapisujemy tej frazy.
    return NextResponse.json({ zapisane: false, powod: "directus" })
  }

  return NextResponse.json({ zapisane: true })
}
