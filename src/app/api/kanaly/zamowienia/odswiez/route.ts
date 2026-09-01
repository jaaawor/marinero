import { NextResponse } from "next/server"
import { listOrders, readAllegroConfig } from "@/lib/allegro"
import { zapiszMigawke } from "@/lib/allegro-magazyn"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Automatyczne pobranie zamówień z Allegro.
 *
 * Woła to **cron na VPS-ie**, nie przeglądarka — stąd token w nagłówku zamiast
 * logowania. Zadaniem tej końcówki nie jest pokazanie czegokolwiek, tylko
 * zapisanie migawki, z której panel wie, **co przyszło od ostatniego razu**.
 *
 * Wpisy w cronie (`crontab -e` na VPS):
 *
 *   # co pół godziny w godzinach pracy
 *   0,30 8-17 * * *  curl -fsS -X POST -H "x-sync-token: $CHANNEL_SYNC_TOKEN" https://marinero.pl/api/kanaly/zamowienia/odswiez >/dev/null
 *   # poza nimi raz na godzinę
 *   0 0-7,18-23 * * * curl -fsS -X POST -H "x-sync-token: $CHANNEL_SYNC_TOKEN" https://marinero.pl/api/kanaly/zamowienia/odswiez >/dev/null
 *
 * Godziny są **lokalne dla serwera**, więc przy zmianie czasu nic się nie
 * rozjeżdża — inaczej niż przy harmonogramie liczonym w UTC.
 */
export async function POST(request: Request) {
  const oczekiwany = process.env.CHANNEL_SYNC_TOKEN || ""
  if (!oczekiwany) {
    return NextResponse.json(
      { ok: false, powod: "Brak CHANNEL_SYNC_TOKEN — automat nie jest skonfigurowany." },
      { status: 503 }
    )
  }

  if (request.headers.get("x-sync-token") !== oczekiwany) {
    return NextResponse.json({ ok: false, powod: "Brak dostępu." }, { status: 401 })
  }

  const config = readAllegroConfig()
  if (!config) {
    return NextResponse.json({ ok: false, powod: "brak_kluczy_allegro" }, { status: 400 })
  }

  try {
    // Bierzemy **wszystko**, nie sam widok „do obsłużenia": migawka ma
    // odpowiadać na pytanie „co przyszło", a nie „co jest do zrobienia".
    const lista = await listOrders(config, { widok: "wszystkie" })
    const migawka = await zapiszMigawke(lista.zamowienia)

    return NextResponse.json({
      ok: true,
      ile: migawka.ile,
      nowe: migawka.nowe.length,
      kiedy: migawka.kiedy,
    })
  } catch (blad) {
    return NextResponse.json(
      { ok: false, powod: blad instanceof Error ? blad.message.slice(0, 300) : "allegro_blad" },
      { status: 502 }
    )
  }
}
