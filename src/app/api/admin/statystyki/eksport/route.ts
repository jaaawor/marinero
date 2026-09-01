import { getAdminToken } from "@/lib/admin-auth"
import { nazwaKraju } from "@/lib/kraj"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

type Wpis = { fraza: string; gdzie: string; wynikow: number | null; date_created: string }
type Odslona = { sciezka: string; gdzie: string; tytul: string; skad: string; kraj: string; date_created: string }

/**
 * Eksport statystyk do arkusza — wyszukiwań albo odsłon (`?co=odslony`).
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

  const parametry = new URL(request.url).searchParams
  const dni = Math.min(Number(parametry.get("dni")) || 365, 3650)
  const odslony = parametry.get("co") === "odslony"
  const od = new Date(Date.now() - dni * 24 * 60 * 60 * 1000).toISOString()

  const kolekcja = odslony
    ? `page_views?limit=-1&sort=-date_created&fields=sciezka,gdzie,tytul,skad,kraj,date_created`
    : `search_queries?limit=-1&sort=-date_created&fields=fraza,gdzie,wynikow,date_created`

  const odpowiedz = await fetch(
    `${DIRECTUS}/items/${kolekcja}&filter[date_created][_gte]=${encodeURIComponent(od)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!odpowiedz.ok) return new Response(`Directus ${odpowiedz.status}`, { status: 502 })

  const wpisy: (Wpis | Odslona)[] = (await odpowiedz.json())?.data || []

  function komorka(wartosc: string | number | null) {
    const tekst = wartosc === null || wartosc === undefined ? "" : String(wartosc)
    // Cudzysłów i średnik w treści rozwaliłyby kolumny — stąd cytowanie.
    return `"${tekst.replace(/"/g, '""')}"`
  }

  function dzial(gdzie: string) {
    return gdzie === "sklep" ? "sklep" : "łodzie"
  }

  const wiersze = odslony
    ? [
        ["Data", "Godzina", "Gdzie", "Adres", "Tytuł", "Skąd", "Kraj"].map(komorka).join(";"),
        ...(wpisy as Odslona[]).map((wpis) =>
          [
            wpis.date_created.slice(0, 10),
            wpis.date_created.slice(11, 19),
            dzial(wpis.gdzie),
            wpis.sciezka,
            wpis.tytul,
            wpis.skad || "wejście bezpośrednie",
            nazwaKraju(wpis.kraj || ""),
          ]
            .map(komorka)
            .join(";")
        ),
      ]
    : [
        ["Data", "Godzina", "Gdzie", "Fraza", "Wyników"].map(komorka).join(";"),
        ...(wpisy as Wpis[]).map((wpis) =>
          [
            wpis.date_created.slice(0, 10),
            wpis.date_created.slice(11, 19),
            dzial(wpis.gdzie),
            wpis.fraza,
            wpis.wynikow ?? "",
          ]
            .map(komorka)
            .join(";")
        ),
      ]

  const nazwa = `${odslony ? "odslony" : "wyszukiwania"}-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response("﻿" + wiersze.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nazwa}"`,
    },
  })
}
