// Klient REST API Allegro — tyle, ile potrzeba do synchronizacji cen i stanów.
//
// Allegro wymaga tokenu użytkownika (zgoda właściciela konta sprzedażowego).
// Ścieżka: raz przechodzimy „device flow", zapisujemy refresh token w env
// (`ALLEGRO_REFRESH_TOKEN`), a potem odświeżamy go przy każdej synchronizacji.
// Bez kompletu zmiennych funkcje zwracają `null` i synchronizacja idzie
// w tryb podglądu — nic nie wysyła.

const AUTH_URL = "https://allegro.pl/auth/oauth"
const API_URL = "https://api.allegro.pl"

export type AllegroConfig = {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export function readAllegroConfig(): AllegroConfig | null {
  const clientId = process.env.ALLEGRO_CLIENT_ID
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET
  const refreshToken = process.env.ALLEGRO_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken }
}

async function accessToken(config: AllegroConfig): Promise<string> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")

  const response = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Allegro auth: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.access_token as string
}

async function api(
  config: AllegroConfig,
  path: string,
  init: RequestInit = {},
  token?: string
) {
  const bearer = token || (await accessToken(config))

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/vnd.allegro.public.v1+json",
      "Content-Type": "application/vnd.allegro.public.v1+json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Allegro ${path}: ${response.status} ${(await response.text()).slice(0, 300)}`)
  }

  return response.json()
}

export type AllegroOffer = {
  id: string
  name: string
  /** Sygnatura sprzedawcy — po niej łączymy ofertę z produktem w Medusie. */
  signature: string
  price: number
  stock: number
}

/** Pobiera oferty sprzedawcy (wszystkie strony). */
export async function listOffers(config: AllegroConfig): Promise<AllegroOffer[]> {
  const token = await accessToken(config)
  const offers: AllegroOffer[] = []
  let offset = 0

  for (;;) {
    const data = await api(
      config,
      `/sale/offers?limit=100&offset=${offset}`,
      { method: "GET" },
      token
    )

    for (const offer of data.offers || []) {
      offers.push({
        id: offer.id,
        name: offer.name,
        signature: offer.external?.id || "",
        price: Number(offer.sellingMode?.price?.amount) || 0,
        stock: Number(offer.stock?.available) || 0,
      })
    }

    offset += 100
    if (offset >= (data.totalCount || 0)) break
  }

  return offers
}

/** Zmienia cenę i stan pojedynczej oferty. */
export async function updateOffer(
  config: AllegroConfig,
  offerId: string,
  changes: { price?: number; stock?: number },
  token?: string
) {
  const body: Record<string, unknown> = {}
  if (typeof changes.price === "number") {
    body.sellingMode = { price: { amount: changes.price.toFixed(2), currency: "PLN" } }
  }
  if (typeof changes.stock === "number") {
    body.stock = { available: changes.stock }
  }

  return api(config, `/sale/product-offers/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, token)
}
