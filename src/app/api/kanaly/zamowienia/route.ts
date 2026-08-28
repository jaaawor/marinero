import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import {
  STANY_REALIZACJI,
  type StanRealizacji,
  addShipment,
  listCarriers,
  listOrders,
  readAllegroConfig,
  setFulfillment,
} from "@/lib/allegro"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Zamówienia z Allegro w narzędziach sklepu.
 *
 * Odczyt i zmiana stanu idą **z serwera**, kluczem konta sprzedażowego —
 * do przeglądarki nie trafia ani token, ani dane logowania. Wejście chroni
 * to samo logowanie co resztę narzędzi.
 */
export async function GET(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  const config = readAllegroConfig()
  if (!config) {
    return NextResponse.json({ dostepne: false, powod: "brak_kluczy_allegro" })
  }

  const status = new URL(request.url).searchParams.get("status") || undefined

  try {
    const [zamowienia, przewoznicy] = await Promise.all([
      listOrders(config, { status }),
      // Lista przewoźników zmienia się raz na kwartał, ale jest krótka —
      // pobieramy ją razem z zamówieniami, żeby nie robić drugiego wejścia.
      listCarriers(config).catch(() => []),
    ])

    return NextResponse.json({ dostepne: true, zamowienia, przewoznicy })
  } catch (blad) {
    return NextResponse.json({
      dostepne: false,
      powod: blad instanceof Error ? blad.message.slice(0, 300) : "allegro_blad",
    })
  }
}

/**
 * Jedna zmiana przy jednym zamówieniu: stan realizacji albo numer przesyłki.
 *
 * Numer przesyłki i stan „wysłane" idą **razem, w tej kolejności** — kupujący
 * dostaje wtedy powiadomienie z numerem do śledzenia. Odwrotnie zobaczyłby
 * „wysłane" bez numeru i zaraz by o niego zapytał.
 */
export async function POST(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  const config = readAllegroConfig()
  if (!config) {
    return NextResponse.json({ ok: false, powod: "brak_kluczy_allegro" }, { status: 400 })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, powod: "zly_json" }, { status: 400 })
  }

  const id = String(dane?.id || "").trim()
  if (!id) return NextResponse.json({ ok: false, powod: "brak_zamowienia" }, { status: 400 })

  const stan = String(dane?.stan || "").trim()
  const przewoznik = String(dane?.przewoznik || "").trim()
  const numer = String(dane?.numer || "").trim()

  if (stan && !STANY_REALIZACJI.includes(stan as StanRealizacji)) {
    return NextResponse.json({ ok: false, powod: "nieznany_stan" }, { status: 400 })
  }

  try {
    if (przewoznik && numer) {
      await addShipment(config, id, { przewoznik, numer })
    }
    if (stan) {
      await setFulfillment(config, id, stan as StanRealizacji)
    }

    return NextResponse.json({ ok: true })
  } catch (blad) {
    return NextResponse.json({
      ok: false,
      powod: blad instanceof Error ? blad.message.slice(0, 300) : "allegro_blad",
    })
  }
}
