import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import { hasAdminToken, zmienCeneWariantu } from "@/lib/medusa-admin"
import { readAllegroConfig, updateOffer } from "@/lib/allegro"
import { buildXlsx } from "@/lib/xlsx-write"
import {
  NAGLOWKI_ARKUSZA,
  SZEROKOSCI_ARKUSZA,
  wierszDoArkusza,
  wierszeCen,
  zapomnijCeny,
} from "@/lib/ceny-kanalow"
import { odswiezSklep } from "@/lib/odswiez"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Ceny sklepu i Allegro w jednym miejscu — podgląd, arkusz i zapis.
 *
 * Wszystko idzie z serwera: klucz Medusy i konto Allegro nie opuszczają VPS-a.
 */
export async function GET(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }
  if (!hasAdminToken()) {
    return NextResponse.json({ dostepne: false, powod: "brak_klucza_medusy" })
  }

  const parametry = new URL(request.url).searchParams
  const odswiez = parametry.get("odswiez") === "1"

  // Tryb strumienia: zamiast jednej odpowiedzi po kilkunastu sekundach lecą
  // linijki z postępem, a na końcu komplet danych. Bez tego panel stał przez
  // cały ten czas z jednym zdaniem „wczytuję" i wyglądał na zawieszony —
  // a że raz naprawdę się zaciął, to nie jest teoretyczne zmartwienie.
  if (parametry.get("strumien") === "1") {
    const kod = new TextEncoder()

    const strumien = new ReadableStream({
      async start(kontroler) {
        const linia = (obiekt: unknown) =>
          kontroler.enqueue(kod.encode(`${JSON.stringify(obiekt)}\n`))

        try {
          const { wiersze, allegroDziala } = await wierszeCen({
            odswiez,
            onPostep: (postep) => linia({ co: "postep", ...postep }),
          })
          linia({ co: "koniec", dostepne: true, wiersze, allegroDziala })
        } catch (problem: any) {
          linia({
            co: "koniec",
            dostepne: false,
            powod: "medusa",
            blad: problem?.message || "Medusa nie odpowiada",
          })
        } finally {
          kontroler.close()
        }
      },
    })

    return new NextResponse(strumien, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        // nginx buforuje odpowiedzi i przy buforowaniu postęp dotarłby
        // dopiero razem z końcem — czyli po nic.
        "X-Accel-Buffering": "no",
      },
    })
  }

  try {
    const { wiersze, allegroDziala } = await wierszeCen({ odswiez })

    if (parametry.get("format") === "xlsx") {
      const plik = buildXlsx({
        nazwaArkusza: "Ceny",
        naglowki: NAGLOWKI_ARKUSZA,
        wiersze: wiersze.map(wierszDoArkusza),
        szerokosci: SZEROKOSCI_ARKUSZA,
      })

      const dzis = new Date().toISOString().slice(0, 10)

      return new NextResponse(plik as unknown as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="marinero-ceny-${dzis}.xlsx"`,
          "Cache-Control": "no-store",
        },
      })
    }

    return NextResponse.json({ dostepne: true, wiersze, allegroDziala })
  } catch (problem: any) {
    return NextResponse.json(
      { dostepne: false, powod: "medusa", blad: problem?.message || "Medusa nie odpowiada" },
      { status: 502 }
    )
  }
}

type Zmiana = {
  sku?: string
  tytul?: string
  handle?: string
  produktId?: string
  wariantId?: string
  cenaSklep?: number
  ofertaId?: string
  cenaAllegro?: number
}

function poprawnaCena(wartosc: unknown): wartosc is number {
  return typeof wartosc === "number" && Number.isFinite(wartosc) && wartosc >= 0
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

  const zmiany: Zmiana[] = Array.isArray(dane?.zmiany) ? dane.zmiany : []
  if (!zmiany.length) {
    return NextResponse.json({ ok: false, blad: "Nie ma czego zapisać." }, { status: 400 })
  }

  const config = readAllegroConfig()

  const zapisane = { sklep: 0, allegro: 0 }
  const bledy: { co: string; tytul: string; blad: string }[] = []
  const doOdswiezenia: string[] = []

  for (const zmiana of zmiany) {
    const nazwa = zmiana.tytul || zmiana.sku || zmiana.wariantId || "?"

    // Sklep i Allegro zapisujemy **osobno**. Odbicie jednej ceny nie może
    // zabrać drugiej: przy podwyżce na dwustu pozycjach jedno odrzucone
    // Allegro zostawiłoby sklep w połowie przepisany.
    if (poprawnaCena(zmiana.cenaSklep) && zmiana.produktId && zmiana.wariantId) {
      try {
        await zmienCeneWariantu(zmiana.produktId, zmiana.wariantId, zmiana.cenaSklep)
        zapisane.sklep += 1
        if (zmiana.handle) doOdswiezenia.push(zmiana.handle)
      } catch (problem: any) {
        bledy.push({ co: "sklep", tytul: nazwa, blad: problem?.message || "nie udało się" })
      }
    }

    if (poprawnaCena(zmiana.cenaAllegro) && zmiana.ofertaId) {
      if (!config) {
        bledy.push({ co: "allegro", tytul: nazwa, blad: "Allegro nie jest podpięte" })
      } else {
        try {
          await updateOffer(config, zmiana.ofertaId, { price: zmiana.cenaAllegro })
          zapisane.allegro += 1
        } catch (problem: any) {
          bledy.push({ co: "allegro", tytul: nazwa, blad: problem?.message || "nie udało się" })
        }
      }
    }
  }

  if (zapisane.sklep || zapisane.allegro) zapomnijCeny()
  if (doOdswiezenia.length) odswiezSklep(doOdswiezenia)

  return NextResponse.json({ ok: true, zapisane, bledy })
}
