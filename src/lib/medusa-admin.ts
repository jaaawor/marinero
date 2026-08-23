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
