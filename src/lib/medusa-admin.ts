// Klient Admin API Medusy — tylko do narzędzi wewnętrznych.
//
// Klucz jest sekretem i **nie może** znaleźć się w repozytorium: siedzi
// w `MEDUSA_ADMIN_TOKEN` w `.env.local` na VPS-ie. Bez niego narzędzie
// pokazuje czytelny komunikat zamiast się wywracać.
//
// Medusa 2 uwierzytelnia klucz `sk_…` przez HTTP Basic (klucz jako login,
// puste hasło). Nagłówek `x-medusa-access-token` zwraca 401 — to ślepa uliczka,
// na którą łatwo wpaść, bo tak wygląda dokumentacja Medusy 1.

import { MEDUSA_URL } from "@/lib/medusa"

export function adminToken(): string {
  return process.env.MEDUSA_ADMIN_TOKEN || ""
}

export function hasAdminToken(): boolean {
  return Boolean(adminToken())
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${adminToken()}:`).toString("base64")}`
}

export async function medusaAdmin(path: string, init: RequestInit = {}): Promise<any> {
  const token = adminToken()
  if (!token) {
    throw new Error(
      "Brak klucza do Medusy. Dopisz MEDUSA_ADMIN_TOKEN do .env.local na serwerze i przebuduj stronę."
    )
  }

  const response = await fetch(`${MEDUSA_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  const text = await response.text()
  const body = text ? safeJson(text) : {}

  if (!response.ok) {
    const message =
      body?.message || body?.error || `Medusa odpowiedziała ${response.status}`
    throw new Error(message)
  }

  return body
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 200) }
  }
}

export type AdminProduct = {
  id: string
  title: string
  handle: string
  description: string
  subtitle: string
  category: string
  thumbnail: string
  /** Propozycja opisu czekająca na zatwierdzenie (metadane produktu). */
  proposal: string
  metadata: Record<string, unknown>
}

const FIELDS =
  "id,title,handle,description,subtitle,thumbnail,+metadata,categories.id,categories.name"

function mapProduct(item: any): AdminProduct {
  const metadata = (item?.metadata || {}) as Record<string, unknown>
  return {
    id: item.id,
    title: item.title || "",
    handle: item.handle || "",
    description: item.description || "",
    subtitle: item.subtitle || "",
    category: item.categories?.[0]?.name || "",
    thumbnail: item.thumbnail || "",
    proposal: typeof metadata.opis_propozycja === "string" ? metadata.opis_propozycja : "",
    metadata,
  }
}

export async function listAdminProducts(options: {
  categoryId?: string
  query?: string
  limit?: number
  offset?: number
}): Promise<{ products: AdminProduct[]; count: number }> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
    fields: FIELDS,
    order: "title",
  })

  if (options.categoryId) params.append("category_id[]", options.categoryId)
  if (options.query) params.set("q", options.query)

  const body = await medusaAdmin(`/admin/products?${params.toString()}`)

  return {
    products: (body?.products || []).map(mapProduct),
    count: Number(body?.count) || 0,
  }
}

export async function updateAdminProduct(
  id: string,
  patch: { description?: string; metadata?: Record<string, unknown> }
): Promise<AdminProduct> {
  const body = await medusaAdmin(`/admin/products/${id}`, {
    method: "POST",
    body: JSON.stringify(patch),
  })
  return mapProduct(body?.product || {})
}

export async function listAdminCategories(): Promise<{ id: string; name: string; handle: string }[]> {
  const body = await medusaAdmin(
    "/admin/product-categories?limit=100&fields=id,name,handle"
  )
  return (body?.product_categories || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    handle: item.handle,
  }))
}


// — Zamówienia ze sklepu —
//
// Do tej pory zamówienia oglądało się wyłącznie w panelu Medusy: po angielsku,
// bez naszego stanu płatności z PayU i bez tego, co dopisujemy w metadanych.
// Panel ma je pokazywać tak, jak sprzedawca ich potrzebuje.
//
// Stan **obsługi** trzymamy w metadanych zamówienia (`obsluga`), a nie
// w polu `fulfillment_status` Medusy. Medusa liczy realizację przez osobne
// zasoby (fulfillments, shipments), zakładające magazyn i rezerwacje —
// czego tu nie prowadzimy. Metadane są dla nas źródłem prawdy w codziennej
// pracy, a `fulfillment_status` zostawiamy Medusie takim, jaki jest.
//
// Uwaga na metadane Medusy: **scalają się i nie da się skasować klucza** —
// `{"klucz": null}` zostawia klucz z wartością `null`. Dlatego wszędzie
// sprawdzamy wartość, nie samą obecność.

export const STANY_OBSLUGI = ["nowe", "w-realizacji", "wyslane", "anulowane"] as const
export type StanObslugi = (typeof STANY_OBSLUGI)[number]

export const OPISY_STANOW: Record<StanObslugi, string> = {
  nowe: "Nowe",
  "w-realizacji": "W realizacji",
  wyslane: "Wysłane",
  anulowane: "Anulowane",
}

export type AdminOrderItem = {
  id: string
  tytul: string
  wariant: string
  sku: string
  ile: number
  cena: number
  razem: number
}

export type AdminOrder = {
  id: string
  numer: string
  kiedy: string
  email: string
  klient: string
  telefon: string
  adres: string
  /** NIP albo VAT UE podany w zamówieniu — leży w metadanych koszyka. */
  nip: string
  waluta: string
  razem: number
  dostawa: string
  dostawaKoszt: number
  /** Stan płatności widziany przez Medusę (`captured`, `not_paid`, …). */
  platnosc: string
  /** Nasz zapis z PayU — Medusa nie wie o płatnościach spoza swojego modułu. */
  payu: string
  oplacone: boolean
  realizacja: string
  obsluga: StanObslugi
  /** Czy poszedł mail z potwierdzeniem (znacznik z `potwierdzenie-zamowienia.ts`). */
  mailWyslany: boolean
  numerPrzesylki: string
  uwagi: string
  pozycje: AdminOrderItem[]
  metadata: Record<string, unknown>
}

const POLA_ZAMOWIENIA = [
  "id",
  "display_id",
  "status",
  "email",
  "currency_code",
  "total",
  "payment_status",
  "fulfillment_status",
  "created_at",
  "+metadata",
  "*items",
  "*shipping_methods",
  "*shipping_address",
].join(",")

function tekst(wartosc: unknown): string {
  return typeof wartosc === "string" ? wartosc : ""
}

function mapOrder(zam: any): AdminOrder {
  const meta = (zam?.metadata || {}) as Record<string, unknown>
  const adres = zam?.shipping_address || {}
  const payu = tekst(meta.payu_status)

  const obsluga = STANY_OBSLUGI.includes(tekst(meta.obsluga) as StanObslugi)
    ? (tekst(meta.obsluga) as StanObslugi)
    : "nowe"

  return {
    id: zam?.id || "",
    numer: String(zam?.display_id || zam?.id || ""),
    kiedy: zam?.created_at || "",
    email: zam?.email || "",
    klient: [adres.first_name, adres.last_name].filter(Boolean).join(" "),
    telefon: adres.phone || "",
    adres: [adres.address_1, [adres.postal_code, adres.city].filter(Boolean).join(" "), adres.country_code?.toUpperCase()]
      .filter(Boolean)
      .join(", "),
    nip: tekst(meta.vat_id) || tekst(meta.nip),
    waluta: (zam?.currency_code || "pln").toUpperCase(),
    razem: Number(zam?.total) || 0,
    dostawa: zam?.shipping_methods?.[0]?.name || "",
    dostawaKoszt: Number(zam?.shipping_methods?.[0]?.total) || 0,
    platnosc: zam?.payment_status || "",
    payu,
    // Zapłacone znaczy: albo Medusa pobrała płatność, albo PayU potwierdziło.
    // Samo `payu_order_id` nie wystarcza — zamówienie może być założone
    // w PayU i nieopłacone.
    oplacone: zam?.payment_status === "captured" || payu === "COMPLETED",
    realizacja: zam?.fulfillment_status || "",
    obsluga,
    mailWyslany: tekst(meta.mail_potwierdzenie) === "wyslany",
    numerPrzesylki: tekst(meta.przesylka_numer),
    uwagi: tekst(meta.uwagi_obslugi),
    pozycje: (zam?.items || []).map((p: any) => ({
      id: p.id,
      tytul: p.product_title || p.title || "",
      wariant: p.variant_title || "",
      sku: p.variant_sku || p.variant?.sku || "",
      ile: Number(p.quantity) || 0,
      cena: Number(p.unit_price) || 0,
      razem: Number(p.total) || 0,
    })),
    metadata: meta,
  }
}

export async function listAdminOrders(opcje: {
  limit?: number
  offset?: number
  query?: string
} = {}): Promise<{ zamowienia: AdminOrder[]; ile: number }> {
  const parametry = new URLSearchParams({
    limit: String(opcje.limit ?? 50),
    offset: String(opcje.offset ?? 0),
    order: "-created_at",
    fields: POLA_ZAMOWIENIA,
  })
  if (opcje.query) parametry.set("q", opcje.query)

  const body = await medusaAdmin(`/admin/orders?${parametry.toString()}`)

  return {
    zamowienia: (body?.orders || []).map(mapOrder),
    ile: Number(body?.count) || 0,
  }
}

export async function getAdminOrder(id: string): Promise<AdminOrder> {
  const body = await medusaAdmin(`/admin/orders/${id}?fields=${POLA_ZAMOWIENIA}`)
  return mapOrder(body?.order || {})
}

/**
 * Dopisuje do metadanych zamówienia. Medusa **scala** metadane, więc podajemy
 * tylko to, co zmieniamy — reszta zostaje nietknięta.
 */
export async function zmienMetadaneZamowienia(
  id: string,
  zmiany: Record<string, unknown>
): Promise<AdminOrder> {
  const body = await medusaAdmin(`/admin/orders/${id}`, {
    method: "POST",
    body: JSON.stringify({ metadata: zmiany }),
  })
  return mapOrder(body?.order || {})
}
