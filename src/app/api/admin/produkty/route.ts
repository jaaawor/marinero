import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import {
  hasAdminToken,
  listAdminCategories,
  listProductRows,
  zmienCeneWariantu,
  zmienMetadaneProduktu,
} from "@/lib/medusa-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DOSTEPNOSCI = new Set([
  "",
  "od-reki",
  "2-3-dni",
  "7-10-dni",
  "14-dni",
  "na-zamowienie",
  "niedostepny",
])

export async function GET(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  if (!hasAdminToken()) {
    return NextResponse.json({ dostepne: false, powod: "brak_klucza_medusy" })
  }

  const parametry = new URL(request.url).searchParams
  const strona = Math.max(0, Number(parametry.get("strona")) || 0)
  const naStrone = 50

  try {
    const [dane, kategorie] = await Promise.all([
      listProductRows({
        limit: naStrone,
        offset: strona * naStrone,
        query: parametry.get("szukaj") || undefined,
        categoryId: parametry.get("kategoria") || undefined,
      }),
      listAdminCategories().catch(() => []),
    ])

    return NextResponse.json({ dostepne: true, ...dane, kategorie, strona, naStrone })
  } catch (problem: any) {
    return NextResponse.json(
      { dostepne: false, powod: "medusa", blad: problem?.message || "Medusa nie odpowiada" },
      { status: 502 }
    )
  }
}

/**
 * Zapis zmian — **paczką**, po zatwierdzeniu podglądu.
 *
 * Każda zmiana idzie osobnym żądaniem do Medusy i osobno zdaje raport: przy
 * dwudziestu poprawionych cenach jeden odrzucony produkt nie może przewrócić
 * pozostałych dziewiętnastu ani zostawić nas bez wiedzy, który to był.
 */
export async function POST(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  const zmiany = Array.isArray(dane?.zmiany) ? dane.zmiany : []
  if (!zmiany.length) {
    return NextResponse.json({ ok: false, blad: "Nie ma czego zapisać." }, { status: 400 })
  }

  const zapisane: string[] = []
  const bledy: { id: string; tytul: string; blad: string }[] = []

  for (const zmiana of zmiany) {
    const id = String(zmiana?.id || "")
    const tytul = String(zmiana?.tytul || id)
    if (!id) continue

    try {
      // Metadane najpierw: dostępność, sztuki i EAN idą jednym żądaniem,
      // bo Medusa i tak scala metadane.
      const meta: Record<string, unknown> = {}

      if (typeof zmiana.dostepnosc === "string") {
        if (!DOSTEPNOSCI.has(zmiana.dostepnosc)) {
          throw new Error(`Nieznany kod dostępności: ${zmiana.dostepnosc}`)
        }
        meta.dostepnosc = zmiana.dostepnosc
      }

      if (zmiana.sztuki !== undefined) {
        const ile = Number(zmiana.sztuki)
        meta.sztuki = zmiana.sztuki === "" || !Number.isFinite(ile) ? "" : Math.max(0, Math.round(ile))
      }

      if (typeof zmiana.ean === "string") meta.ean = zmiana.ean.trim().slice(0, 40)

      if (Object.keys(meta).length) await zmienMetadaneProduktu(id, meta)

      if (zmiana.cena !== undefined && zmiana.wariantId) {
        const cena = Number(zmiana.cena)
        if (!Number.isFinite(cena) || cena < 0) throw new Error("Cena musi być liczbą nieujemną")
        await zmienCeneWariantu(id, String(zmiana.wariantId), cena)
      }

      zapisane.push(id)
    } catch (problem: any) {
      bledy.push({ id, tytul, blad: problem?.message || "nie udało się" })
    }
  }

  return NextResponse.json({ ok: true, zapisane, bledy })
}
