import { NextResponse } from "next/server"
import { zalogowanyKlient } from "@/lib/klient"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

const ETAPY = new Set(["koszyk", "zamowienie", "zlozone"])

/**
 * Zapisuje, co klient ma w koszyku.
 *
 * Medusa 2 nie wystawia listy koszyków przez API — `/admin/carts` odpowiada 404 —
 * więc sprzedawca nie ma jak zobaczyć, kto jest w trakcie zakupów. Trzymamy więc
 * własną migawkę: identyfikator koszyka, zawartość, wartość i etap.
 *
 * Zapis idzie tokenem serwera, tak jak wyszukiwania i oferty. Adres e-mail
 * pojawia się dopiero wtedy, gdy klient sam go wpisze w zamówieniu.
 */
export async function POST(request: Request) {
  if (!TOKEN) return NextResponse.json({ zapisane: false, powod: "brak_tokenu" })

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ error: "zly_json" }, { status: 400 })
  }

  const cartId = String(dane?.cartId || "").trim().slice(0, 64)
  if (!cartId) return NextResponse.json({ zapisane: false, powod: "brak_koszyka" })

  const etap = ETAPY.has(String(dane?.etap)) ? String(dane.etap) : "koszyk"
  const wpis: Record<string, unknown> = {
    cart_id: cartId,
    pozycje: String(dane?.pozycje || "").slice(0, 2000),
    sztuk: Number(dane?.sztuk) || 0,
    wartosc: Number(dane?.wartosc) || 0,
    etap,
  }
  // Pustym e-mailem nie nadpisujemy tego, który już jest — klient mógł go
  // wpisać, a potem wrócić do koszyka i wtedy przyszłaby pusta wartość.
  let email = String(dane?.email || "").trim().slice(0, 180)

  // Zalogowanego klienta znamy z jego sesji, więc nie musimy czekać, aż
  // dojdzie do zamówienia i sam wpisze adres. Bez tego porzucony koszyk
  // **zawsze** był anonimowy: adres pojawiał się dopiero w kasie, czyli
  // dokładnie tam, dokąd porzucony koszyk z definicji nie doszedł.
  // Adres bierzemy z potwierdzonej sesji w Medusie, nigdy z przeglądarki.
  if (!email) {
    const klient = await zalogowanyKlient().catch(() => null)
    if (klient?.email) email = klient.email.slice(0, 180)
  }

  if (email) wpis.email = email

  try {
    const szukaj = await fetch(
      `${DIRECTUS}/items/active_carts?filter[cart_id][_eq]=${encodeURIComponent(cartId)}&fields=id&limit=1`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    )
    const istniejacy = (await szukaj.json())?.data?.[0]

    await fetch(
      istniejacy ? `${DIRECTUS}/items/active_carts/${istniejacy.id}` : `${DIRECTUS}/items/active_carts`,
      {
        method: istniejacy ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(wpis),
        cache: "no-store",
      }
    )
  } catch {
    // Podgląd koszyków nie może przeszkodzić w zakupach.
    return NextResponse.json({ zapisane: false, powod: "directus" })
  }

  return NextResponse.json({ zapisane: true })
}
