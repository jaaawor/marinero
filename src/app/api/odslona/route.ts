import { NextResponse } from "next/server"
import { identyfikatorGoscia, odciskDnia } from "@/lib/gosc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

// Zapis idzie tokenem serwera, tak samo jak wyszukiwania i koszyki. Publicznego
// zapisu tu nie chcemy: kolekcja stałaby otworem dla botów, a wtedy statystyka
// mówiłaby o botach, nie o klientach.
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

const DZIALY = new Set(["lodzie", "sklep"])

/**
 * Zapisuje odsłonę strony.
 *
 * Do liczenia **unikalnych wejść** dokładamy identyfikator z ciasteczka
 * i odcisk dnia (skrót z IP i przeglądarki). Samego adresu IP nie zapisujemy —
 * patrz `src/lib/gosc.ts`.
 */
export async function POST(request: Request) {
  if (!TOKEN) return NextResponse.json({ zapisane: false, powod: "brak_tokenu" })

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ error: "zly_json" }, { status: 400 })
  }

  // Parametry (`?marka=XO`, `?utm_source=…`) rozbiłyby jeden adres na
  // kilkadziesiąt wierszy w statystyce. Interesuje nas strona, nie jej filtry.
  const sciezka = String(dane?.sciezka || "").split("?")[0].split("#")[0].trim().slice(0, 300)
  const gdzie = String(dane?.gdzie || "")

  if (!sciezka.startsWith("/") || !DZIALY.has(gdzie)) {
    return NextResponse.json({ zapisane: false, powod: "zly_adres" })
  }

  // Tytuł zwykle kończy się nazwą serwisu — w tabeli powtarzałaby się w każdym
  // wierszu i zjadała szerokość kolumny.
  const tytul = String(dane?.tytul || "")
    .replace(/\s*[|·—-]\s*Marinero.*$/i, "")
    .trim()
    .slice(0, 200)

  const gosc = await identyfikatorGoscia()

  try {
    await fetch(`${DIRECTUS}/items/page_views`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sciezka,
        gdzie,
        tytul,
        jezyk: String(dane?.jezyk || "pl").slice(0, 5),
        skad: String(dane?.skad || "").slice(0, 120),
        gosc,
        odcisk: odciskDnia(request),
      }),
      cache: "no-store",
    })
  } catch {
    // Statystyka nie może przeszkodzić w oglądaniu strony.
    return NextResponse.json({ zapisane: false, powod: "directus" })
  }

  return NextResponse.json({ zapisane: true })
}
