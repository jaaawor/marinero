import { NextResponse } from "next/server"
import { goscZCiasteczka, odciskDnia } from "@/lib/gosc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

const ETAPY = new Set(["klikanie", "dane", "wyslana"])

/**
 * Ślad po pracy w konfiguratorze — jedna sesja to jeden wiersz, dopisywany
 * w miarę klikania i domykany, gdy oferta pójdzie.
 *
 * Zapis tokenem serwera, tak samo jak wyszukiwania, koszyki i odsłony.
 * Dokładamy identyfikator z ciasteczka i odcisk dnia (do liczenia unikalnych
 * wejść) oraz to, co klient wpisał pod konfiguratorem — nawet jeżeli nie
 * dokończył wysyłki. Porzucona konfiguracja z numerem telefonu to zapytanie
 * ofertowe, które nie doszło; formularz mówi o tym wprost, żeby nikt nie był
 * zaskoczony telefonem.
 */
export async function POST(request: Request) {
  if (!TOKEN) return NextResponse.json({ zapisane: false, powod: "brak_tokenu" })

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ error: "zly_json" }, { status: 400 })
  }

  const sesja = String(dane?.sesja || "").trim().slice(0, 40)
  const etap = ETAPY.has(String(dane?.etap)) ? String(dane.etap) : "klikanie"

  if (!sesja) return NextResponse.json({ zapisane: false, powod: "brak_sesji" })

  const { gosc, powracajacy } = await goscZCiasteczka()

  const wpis = {
    sesja,
    gosc,
    powracajacy,
    odcisk: odciskDnia(request),
    klient_imie: String(dane?.klientImie || "").trim().slice(0, 120),
    klient_email: String(dane?.klientEmail || "").trim().slice(0, 180),
    klient_telefon: String(dane?.klientTelefon || "").trim().slice(0, 40),
    uwagi: String(dane?.uwagi || "").trim().slice(0, 2000),
    model_slug: String(dane?.modelSlug || "").slice(0, 150),
    model_name: String(dane?.modelName || "").slice(0, 150),
    etap,
    opcji: Number(dane?.opcji) || 0,
    wartosc: Number(dane?.wartosc) || 0,
    waluta: String(dane?.waluta || "").slice(0, 5),
  }

  try {
    const szukaj = await fetch(
      `${DIRECTUS}/items/configurator_sessions?filter[sesja][_eq]=${encodeURIComponent(sesja)}&fields=id&limit=1`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    )
    const istniejacy = (await szukaj.json())?.data?.[0]

    await fetch(
      istniejacy
        ? `${DIRECTUS}/items/configurator_sessions/${istniejacy.id}`
        : `${DIRECTUS}/items/configurator_sessions`,
      {
        method: istniejacy ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(wpis),
        cache: "no-store",
      }
    )
  } catch {
    // Statystyka nie może przeszkodzić w konfigurowaniu łodzi.
    return NextResponse.json({ zapisane: false, powod: "directus" })
  }

  return NextResponse.json({ zapisane: true })
}
