import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import { wyslijPotwierdzenie } from "@/lib/potwierdzenie-zamowienia"
import { PRZEWOZNICY } from "@/lib/przewoznicy"
import {
  STANY_OBSLUGI,
  type StanObslugi,
  getAdminOrder,
  hasAdminToken,
  listAdminOrders,
  zmienMetadaneZamowienia,
} from "@/lib/medusa-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Zamówienia ze sklepu w panelu.
 *
 * Wszystko idzie **z serwera**, kluczem administratora Medusy — do przeglądarki
 * nie trafia ani klucz, ani nic, czym dałoby się sięgnąć do cudzych zamówień.
 * Wejście chroni to samo logowanie kontem Directusa co resztę narzędzi.
 */
export async function GET(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  if (!hasAdminToken()) {
    return NextResponse.json({ dostepne: false, powod: "brak_klucza_medusy" })
  }

  const parametry = new URL(request.url).searchParams
  const strona = Math.max(0, Number(parametry.get("strona")) || 0)
  const naStrone = 25

  try {
    const { zamowienia, ile } = await listAdminOrders({
      limit: naStrone,
      offset: strona * naStrone,
      query: parametry.get("szukaj") || undefined,
    })

    return NextResponse.json({ dostepne: true, zamowienia, ile, strona, naStrone })
  } catch (problem: any) {
    return NextResponse.json(
      { dostepne: false, powod: "medusa", blad: problem?.message || "Medusa nie odpowiada" },
      { status: 502 }
    )
  }
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

  const id = String(dane?.id || "")
  const co = String(dane?.co || "")
  if (!id) return NextResponse.json({ ok: false, blad: "Brak zamówienia." }, { status: 400 })

  try {
    if (co === "stan") {
      const stan = String(dane?.stan || "") as StanObslugi
      if (!STANY_OBSLUGI.includes(stan)) {
        return NextResponse.json({ ok: false, blad: "Nieznany stan." }, { status: 400 })
      }
      return NextResponse.json({ ok: true, zamowienie: await zmienMetadaneZamowienia(id, { obsluga: stan }) })
    }

    if (co === "uwagi") {
      const uwagi = String(dane?.uwagi || "").slice(0, 2000)
      return NextResponse.json({ ok: true, zamowienie: await zmienMetadaneZamowienia(id, { uwagi_obslugi: uwagi }) })
    }

    if (co === "przesylka") {
      const numer = String(dane?.numer || "").trim().slice(0, 100)
      // Przewoźnika zapisujemy razem z numerem, bo bez niego numer nie prowadzi
      // donikąd: konto klienta buduje z tej pary odnośnik wprost do śledzenia.
      const firma = String(dane?.przewoznik || "").trim()
      if (firma && !PRZEWOZNICY.some((p) => p.klucz === firma)) {
        return NextResponse.json({ ok: false, blad: "Nieznany przewoźnik." }, { status: 400 })
      }
      // Numer przesyłki i stan „wysłane" idą razem — sprzedawca wpisuje numer
      // dokładnie w momencie nadania, a osobne klikanie stanu tylko po to,
      // żeby zgadzało się z rzeczywistością, jest robotą dla robota.
      const zmiany: Record<string, unknown> = {
        przesylka_numer: numer,
        przesylka_przewoznik: firma,
      }
      if (numer) zmiany.obsluga = "wyslane"
      return NextResponse.json({ ok: true, zamowienie: await zmienMetadaneZamowienia(id, zmiany) })
    }

    if (co === "mail") {
      const zamowienie = await getAdminOrder(id)
      const wynik = await wyslijPotwierdzenie(id, { oplacone: zamowienie.oplacone, wymus: true })
      if (!wynik.wyslane) {
        return NextResponse.json({ ok: false, blad: `Nie wysłano: ${wynik.powod || "nieznany powód"}` }, { status: 400 })
      }
      return NextResponse.json({ ok: true, zamowienie: await getAdminOrder(id) })
    }

    return NextResponse.json({ ok: false, blad: "Nieznana operacja." }, { status: 400 })
  } catch (problem: any) {
    // Panel ma powiedzieć, co się stało, a nie oddać stronę błędu w HTML-u,
    // której formularz nie umie odczytać.
    return NextResponse.json({ ok: false, blad: problem?.message || "Nie udało się." }, { status: 500 })
  }
}
