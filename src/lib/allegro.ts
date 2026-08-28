// Klient REST API Allegro — tyle, ile potrzeba do synchronizacji cen i stanów.
//
// Allegro wymaga tokenu użytkownika (zgoda właściciela konta sprzedażowego).
// Ścieżka: raz przechodzimy „device flow", zapisujemy refresh token w env
// (`ALLEGRO_REFRESH_TOKEN`), a potem odświeżamy go przy każdej synchronizacji.
// Bez kompletu zmiennych funkcje zwracają `null` i synchronizacja idzie
// w tryb podglądu — nic nie wysyła.

const AUTH_URL = "https://allegro.pl/auth/oauth"
const API_URL = "https://api.allegro.pl"

// Allegro wymaga, żeby integracja się przedstawiała. Bez tego nagłówka część
// zapytań wraca z błędem, a przy przekroczeniu limitów nie mają jak nas
// namierzyć — i wtedy blokują całe konto, a nie jedną integrację.
const UA = process.env.ALLEGRO_USER_AGENT || "marinero-sklep/1 (+marinero.pl)"

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
      "User-Agent": UA,
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


// — Zamówienia —
//
// Zamówienie na Allegro to „checkout form". Sprzedawca prowadzi je przez trzy
// rzeczy: **stan realizacji** (`fulfillment`), **przesyłkę** (numer listu
// przewozowego) i ewentualne anulowanie. Płatność i zwroty prowadzi Allegro,
// my ich nie ruszamy.

export type AllegroPozycja = {
  id: string
  nazwa: string
  /** Sygnatura sprzedawcy z oferty — łączy pozycję z produktem w Medusie. */
  sygnatura: string
  ile: number
  cena: number
}

export type AllegroZamowienie = {
  id: string
  numer: string
  zlozone: string
  /** Stan realizacji: NEW, PROCESSING, READY_FOR_SHIPMENT, SENT, PICKED_UP, CANCELLED… */
  stan: string
  /** Czy zapłacone — po tym poznajemy, co wolno wysłać. */
  oplacone: boolean
  kwota: number
  kupujacy: { login: string; imie: string; email: string }
  dostawa: { nazwa: string; adres: string; punkt: string }
  pozycje: AllegroPozycja[]
}

function adresDostawy(dostawa: any): { nazwa: string; adres: string; punkt: string } {
  const adres = dostawa?.address
  const linie = [
    adres?.street,
    [adres?.zipCode, adres?.city].filter(Boolean).join(" "),
  ].filter(Boolean)

  return {
    nazwa: dostawa?.method?.name || "",
    adres: linie.join(", "),
    // Przy paczkomacie i punkcie odbioru adres kupującego jest pusty, a liczy
    // się identyfikator punktu — bez niego przesyłki nie da się nadać.
    punkt: dostawa?.pickupPoint?.id || "",
  }
}

function naZamowienie(form: any): AllegroZamowienie {
  return {
    id: String(form.id),
    numer: String(form.id).slice(0, 8),
    zlozone: form.updatedAt || form.boughtAt || "",
    stan: form.fulfillment?.status || "NEW",
    // Allegro oznacza opłacenie osobno od stanu realizacji — zamówienie
    // nieopłacone potrafi wisieć tygodniami i nie wolno go wysłać.
    oplacone: form.payment?.finishedAt ? true : false,
    kwota: Number(form.summary?.totalToPay?.amount) || 0,
    kupujacy: {
      login: form.buyer?.login || "",
      imie: [form.buyer?.firstName, form.buyer?.lastName].filter(Boolean).join(" "),
      email: form.buyer?.email || "",
    },
    dostawa: adresDostawy(form.delivery),
    pozycje: (form.lineItems || []).map((pozycja: any) => ({
      id: String(pozycja.id),
      nazwa: pozycja.offer?.name || "",
      sygnatura: pozycja.offer?.external?.id || "",
      ile: Number(pozycja.quantity) || 0,
      cena: Number(pozycja.price?.amount) || 0,
    })),
  }
}

/**
 * Zamówienia sprzedawcy, od najnowszych.
 *
 * Domyślnie tylko `READY_FOR_PROCESSING`, czyli te, które czekają na nas —
 * zamówienia nieopłacone i już zamknięte tylko zaśmiecałyby listę.
 */
export async function listOrders(
  config: AllegroConfig,
  opcje: { status?: string; limit?: number } = {}
): Promise<AllegroZamowienie[]> {
  const limit = Math.min(opcje.limit || 50, 100)
  const status = opcje.status === "wszystkie" ? "" : opcje.status || "READY_FOR_PROCESSING"

  const parametry = new URLSearchParams({ limit: String(limit), offset: "0" })
  if (status) parametry.set("status", status)

  const dane = await api(config, `/order/checkout-forms?${parametry}`, { method: "GET" })
  return (dane.checkoutForms || []).map(naZamowienie)
}

export async function getOrder(config: AllegroConfig, id: string): Promise<AllegroZamowienie> {
  return naZamowienie(await api(config, `/order/checkout-forms/${id}`, { method: "GET" }))
}

/** Stany realizacji, które Allegro przyjmuje od sprzedawcy. */
export const STANY_REALIZACJI = [
  "NEW",
  "PROCESSING",
  "READY_FOR_SHIPMENT",
  "READY_FOR_PICKUP",
  "SENT",
  "PICKED_UP",
  "CANCELLED",
] as const

export type StanRealizacji = (typeof STANY_REALIZACJI)[number]

/**
 * Zmiana stanu realizacji. To jest to, co kupujący widzi u siebie w „Moich
 * zakupach" — dlatego „wysłane" ustawiamy dopiero razem z numerem przesyłki,
 * a nie z góry.
 */
export async function setFulfillment(
  config: AllegroConfig,
  id: string,
  stan: StanRealizacji,
  token?: string
) {
  return api(
    config,
    `/order/checkout-forms/${id}/fulfillment`,
    { method: "PUT", body: JSON.stringify({ status: stan }) },
    token
  )
}

/** Przewoźnicy rozpoznawani przez Allegro — do wyboru przy numerze przesyłki. */
export async function listCarriers(config: AllegroConfig): Promise<{ id: string; nazwa: string }[]> {
  const dane = await api(config, "/order/carriers", { method: "GET" })
  return (dane.carriers || []).map((p: any) => ({ id: p.id, nazwa: p.name || p.id }))
}

/**
 * Numer listu przewozowego przy zamówieniu. Allegro pokazuje go kupującemu
 * i samo śledzi przesyłkę, więc nie musimy nic dopisywać w wiadomości.
 */
export async function addShipment(
  config: AllegroConfig,
  id: string,
  przesylka: { przewoznik: string; numer: string; nadane?: string },
  token?: string
) {
  return api(
    config,
    `/order/checkout-forms/${id}/shipments`,
    {
      method: "POST",
      body: JSON.stringify({
        carrierId: przesylka.przewoznik,
        waybill: przesylka.numer,
        // Bez daty Allegro wstawia „teraz", ale przy nadaniu wstecz warto ją podać.
        ...(przesylka.nadane ? { createdAt: przesylka.nadane } : {}),
      }),
    },
    token
  )
}
