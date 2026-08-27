// Dane firmy po NIP-ie — do wypełnienia adresu w zamówieniu.
//
// Pytamy z serwera, nie z przeglądarki: wykaz MF nie wystawia nagłówków CORS,
// a przy okazji nie pokazujemy klientowi, dokąd idzie zapytanie.

import { isValidNip, lookupCompany, normalizeNip } from "@/lib/firma"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let payload: any
  try {
    payload = await request.json()
  } catch {
    return Response.json({ found: false, error: "bad_request" }, { status: 400 })
  }

  const nip = normalizeNip(payload?.nip)
  if (!nip || !isValidNip(nip)) {
    return Response.json({ found: false, error: "format" })
  }

  try {
    const firma = await lookupCompany(nip)
    if (!firma) return Response.json({ found: false, error: "not_found" })

    return Response.json({ found: true, ...firma })
  } catch {
    // Wykaz bywa niedostępny w nocy (okno serwisowe MF) — to nie jest powód,
    // żeby klient nie mógł złożyć zamówienia. Adres wpisze ręcznie.
    return Response.json({ found: false, error: "unavailable" }, { status: 502 })
  }
}
