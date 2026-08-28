import { getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

type Wpis = { fraza: string; gdzie: string; wynikow: number | null; date_created: string }

/**
 * Eksport wyszukiwań do arkusza.
 *
 * CSV, nie XLSX: Excel otwiera go dwuklikiem, a my nie ciągniemy do builda
 * biblioteki do zapisu skoroszytów tylko po to, żeby wystawić cztery kolumny.
 * Średnik jako separator i **BOM na początku** — bez nich polski Excel wrzuca
 * cały wiersz do jednej komórki i gubi ogonki.
 */
export async function GET(request: Request) {
  const zalogowany = await getAdminToken()
  if (!zalogowany) return new Response("Zaloguj się", { status: 401 })

  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return new Response("Brak tokenu Directusa", { status: 503 })

  const dni = Math.min(Number(new URL(request.url).searchParams.get("dni")) || 365, 3650)
  const od = new Date(Date.now() - dni * 24 * 60 * 60 * 1000).toISOString()

  const odpowiedz = await fetch(
    `${DIRECTUS}/items/search_queries?limit=-1&sort=-date_created` +
      `&fields=fraza,gdzie,wynikow,date_created&filter[date_created][_gte]=${encodeURIComponent(od)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!odpowiedz.ok) return new Response(`Directus ${odpowiedz.status}`, { status: 502 })

  const wpisy: Wpis[] = (await odpowiedz.json())?.data || []

  function komorka(wartosc: string | number | null) {
    const tekst = wartosc === null || wartosc === undefined ? "" : String(wartosc)
    // Cudzysłów i średnik w treści rozwaliłyby kolumny — stąd cytowanie.
    return `"${tekst.replace(/"/g, '""')}"`
  }

  const wiersze = [
    ["Data", "Godzina", "Gdzie", "Fraza", "Wyników"].map(komorka).join(";"),
    ...wpisy.map((wpis) =>
      [
        wpis.date_created.slice(0, 10),
        wpis.date_created.slice(11, 19),
        wpis.gdzie === "sklep" ? "sklep" : "łodzie",
        wpis.fraza,
        wpis.wynikow ?? "",
      ]
        .map(komorka)
        .join(";")
    ),
  ]

  const nazwa = `wyszukiwania-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response("﻿" + wiersze.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nazwa}"`,
    },
  })
}
