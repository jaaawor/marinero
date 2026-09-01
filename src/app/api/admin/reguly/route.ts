import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import { pobierzReguly, zapiszReguly } from "@/lib/channel-pricing"
import type { ZapisaneReguly } from "@/lib/reguly-cen"
import { czystaRegula } from "@/lib/reguly-cen"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Reguły cen kanałów (Allegro, OLX).
 *
 * Zapisane w Directusie, więc zmiana narzutu z 9 na 10 procent nie wymaga
 * wdrożenia — dotąd oznaczała commit, build i pięć minut czekania.
 */
export async function GET() {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  return NextResponse.json({ ok: true, reguly: await pobierzReguly() })
}

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

  const przyslane = dane?.reguly
  if (!przyslane || typeof przyslane !== "object") {
    return NextResponse.json({ ok: false, blad: "Brak reguł do zapisania." }, { status: 400 })
  }

  // Przepuszczamy przez ten sam filtr co odczyt: do Directusa ma trafić
  // wyłącznie to, co potem umiemy odczytać.
  const czyste: ZapisaneReguly = {}
  for (const [kanal, wpis] of Object.entries(przyslane as Record<string, any>)) {
    const kategorie: Record<string, ReturnType<typeof czystaRegula>> = {}

    for (const [uchwyt, regula] of Object.entries(wpis?.kategorie || {})) {
      const czysta = czystaRegula(regula)
      // Wiersz bez procentu i bez kwoty niczego nie zmienia — zamiast trzymać
      // go jako regułę „zero", po prostu go nie zapisujemy.
      if (czysta.percent || czysta.amount) kategorie[uchwyt] = czysta
    }

    czyste[kanal] = { domyslna: czystaRegula(wpis?.domyslna), kategorie }
  }

  if (!(await zapiszReguly(czyste))) {
    return NextResponse.json(
      {
        ok: false,
        blad:
          "Nie udało się zapisać w Directusie. Sprawdź DIRECTUS_ADMIN_TOKEN w .env.local na serwerze.",
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, reguly: await pobierzReguly() })
}
