import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  CIASTECZKO_DOSTEPU,
  WAZNOSC_SEKUNDY,
  czytajBilet,
  poprawnyEmail,
  zapiszBilet,
} from "@/lib/konfigurator-dostep"
import { goscZCiasteczka, odciskDnia } from "@/lib/gosc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

/**
 * Czy ta przeglądarka ma już dostęp do konfiguratorów z bramką.
 *
 * Pytamy o to **z przeglądarki**, a nie w komponencie serwerowym, i to jest
 * decyzja, nie niedopatrzenie: sięgnięcie po ciasteczko przy renderze strony
 * modelu wyłączyłoby ISR na wszystkich 79 stronach łodzi. Ta sama zasada co
 * przy „Moje konto" w nagłówku sklepu.
 */
export async function GET() {
  const bilet = czytajBilet((await cookies()).get(CIASTECZKO_DOSTEPU)?.value)

  return NextResponse.json(
    {
      odblokowany: Boolean(bilet),
      imie: bilet?.imie || "",
      // Bez tokenu nie mamy gdzie zapisać kontaktu, więc bramka byłaby
      // formularzem donikąd — wtedy konfigurator zostaje otwarty i mówimy
      // o tym wprost, zamiast po cichu gubić zgłoszenia.
      bramkaDziala: Boolean(TOKEN),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

/**
 * Odblokowanie: zapisujemy kontakt i wydajemy bilet na rok.
 *
 * Kontakt trafia do Directusa **zawsze**, zanim wydamy bilet — odwrotna
 * kolejność gubiłaby zgłoszenia przy każdym potknięciu sieci, a to jest cała
 * treść tej funkcji: nie chodzi o zasłonięcie kalkulatora, tylko o to, żeby
 * wiedzieć, kto go otwiera.
 */
export async function POST(request: Request) {
  if (!TOKEN) {
    return NextResponse.json({ ok: false, powod: "brak_tokenu" }, { status: 503 })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, powod: "zly_json" }, { status: 400 })
  }

  const imie = String(dane?.imie || "").trim().slice(0, 120)
  const email = String(dane?.email || "").trim().slice(0, 180)

  if (!imie || imie.length < 2) {
    return NextResponse.json({ ok: false, powod: "brak_imienia" }, { status: 400 })
  }
  if (!poprawnyEmail(email)) {
    return NextResponse.json({ ok: false, powod: "zly_email" }, { status: 400 })
  }

  // Pułapka na boty — pole ukryte w formularzu, którego człowiek nie widzi.
  // Ta sama co przy formularzu kontaktowym.
  if (String(dane?.website || "").trim()) {
    return NextResponse.json({ ok: true, cichoOdrzucone: true })
  }

  const { gosc } = await goscZCiasteczka()
  const teraz = new Date().toISOString()
  const modelSlug = String(dane?.modelSlug || "").slice(0, 150)
  const modelName = String(dane?.modelName || "").slice(0, 150)

  try {
    // **Sklejamy po adresie e-mail**, nie zakładamy nowego wpisu przy każdym
    // wejściu z innej przeglądarki. Inaczej ten sam człowiek z telefonu i z
    // biura byłby dwiema osobami, a licznik wizyt niczego by nie mówił.
    const szukaj = await fetch(
      `${DIRECTUS}/items/configurator_leads?filter[email][_eq]=${encodeURIComponent(email)}` +
        "&fields=id&limit=1",
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    )
    const istnieje = (await szukaj.json())?.data?.[0]

    // **Wejść tu nie liczymy** — robi to `/api/konfigurator/dane`, przez które
    // przechodzi każde otwarcie kalkulatora, także to z gotowym ciasteczkiem.
    // Liczenie w obu miejscach dawałoby przy pierwszej wizycie dwójkę.
    const wpis: Record<string, unknown> = {
      imie,
      email,
      gosc,
      odcisk: odciskDnia(request),
      ostatni_model: modelName || modelSlug,
      ostatnio: teraz,
    }
    if (!istnieje) {
      wpis.pierwszy_model = modelName || modelSlug
      wpis.kiedy = teraz
      wpis.wejsc = 0
    }

    await fetch(
      istnieje
        ? `${DIRECTUS}/items/configurator_leads/${istnieje.id}`
        : `${DIRECTUS}/items/configurator_leads`,
      {
        method: istnieje ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(wpis),
        cache: "no-store",
      }
    )
  } catch {
    return NextResponse.json({ ok: false, powod: "directus" }, { status: 502 })
  }

  const odpowiedz = NextResponse.json({ ok: true, imie })
  odpowiedz.cookies.set(
    CIASTECZKO_DOSTEPU,
    zapiszBilet({ email, imie, kiedy: Math.floor(Date.now() / 1000) }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: WAZNOSC_SEKUNDY,
    }
  )
  return odpowiedz
}
