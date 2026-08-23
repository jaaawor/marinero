const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_DIRECTUS_URL ||
  "https://dms.marinero.150197.pl"

type AnyItem = Record<string, any>

export type PublicBrand = {
  id: string | number
  name: string
  slug: string
  description: string
  image: string
  logo: string
  featured: boolean
  sort: number
}

export type PublicBoatModel = {
  id: string | number
  name: string
  slug: string
  description: string
  brandName: string
  brandSlug: string
  image: string
  price: number | null
  currency: string
  loa: string
  beam: string
  cabins: string
  bathrooms: string
  maxPeople: string
  featured: boolean
  sort: number
}

export type PublicEngineModel = {
  id: string | number
  name: string
  slug: string
  description: string
  brandName: string
  image: string
  power: string
  type: string
}

export type PublicNewsItem = {
  id: string | number
  title: string
  slug: string
  excerpt: string
  image: string
  date: string
  /** Rodzaj wpisu — flaga na karcie (news, test, szkolenie, poradnik…). */
  kind: string
  /** Uchwyt produktu w sklepie — wpis dostaje wtedy wyjście do zakupu. */
  productHandle: string
}

// Osoby przygotowujące oferty — edytowalne w panelu admina (kolekcja `team`).
export type PublicTeamMember = {
  id: string | number
  name: string
  position: string
  email: string
  phone: string
  /** Grupa w banerze kontaktowym: `sprzedaz` | `sklep` | `serwis`. */
  department: string
}

async function directusItems(collection: string, query = ""): Promise<AnyItem[]> {
  try {
    const separator = query ? `?${query}` : ""
    const response = await fetch(`${DIRECTUS_URL}/items/${collection}${separator}`, {
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      return []
    }

    const json = await response.json()
    return Array.isArray(json?.data) ? json.data : []
  } catch {
    return []
  }
}

function assetUrl(file: any): string {
  if (!file) return ""

  if (typeof file === "string") {
    return `${DIRECTUS_URL}/assets/${file}`
  }

  if (typeof file === "object" && file.id) {
    return `${DIRECTUS_URL}/assets/${file.id}`
  }

  return ""
}

function getImage(item: AnyItem): string {
  return (
    assetUrl(item.hero_image) ||
    assetUrl(item.main_image) ||
    assetUrl(item.cover) ||
    assetUrl(item.image) ||
    assetUrl(item.logo)
  )
}

function brandName(brand: any): string {
  if (!brand) return ""
  if (typeof brand === "string") return ""
  return brand.name || ""
}

function brandSlug(brand: any): string {
  if (!brand) return ""
  if (typeof brand === "string") return ""
  return brand.slug || ""
}

export async function getBrandsPublic(): Promise<PublicBrand[]> {
  const items = await directusItems(
    "brands",
    "filter[status][_eq]=published&fields=*.*&limit=100&sort=sort,name"
  )

  return items
    .map((item: AnyItem): PublicBrand => ({
      id: item.id,
      name: item.name || "",
      slug: item.slug || "",
      description: item.description || item.short_description || "",
      image: getImage(item),
      logo: assetUrl(item.logo),
      featured: Boolean(item.featured),
      sort: Number(item.sort) || 0,
    }))
    .filter((item: PublicBrand) => item.name && item.slug)
}

export async function getBrandPublic(slug: string): Promise<PublicBrand | null> {
  const items = await directusItems(
    "brands",
    `filter[slug][_eq]=${encodeURIComponent(slug)}&fields=*.*&limit=1`
  )

  const item = items[0]
  if (!item) return null

  return {
    id: item.id,
    name: item.name || "",
    slug: item.slug || "",
    description: item.description || item.short_description || "",
    image: getImage(item),
    logo: assetUrl(item.logo),
    featured: Boolean(item.featured),
    sort: Number(item.sort) || 0,
  }
}

async function getFirstImageByModelId(): Promise<Record<string, string>> {
  const items = await directusItems("boat_model_images", "fields=*&limit=500")
  const map: Record<string, string> = {}

  const sorted = [...items].sort(
    (a, b) => (Number(a?.sort) || 0) - (Number(b?.sort) || 0)
  )

  for (const item of sorted) {
    const ref =
      item?.boat_model ?? item?.model ?? item?.boat ?? item?.boat_models_id
    const refId = typeof ref === "object" && ref !== null ? ref.id : ref
    if (refId === null || refId === undefined) continue

    const url = assetUrl(
      item?.image ?? item?.file ?? item?.photo ?? item?.directus_files_id
    )
    if (url && !map[String(refId)]) {
      map[String(refId)] = url
    }
  }

  return map
}

export async function getBoatModelsPublic(): Promise<PublicBoatModel[]> {
  return getBoatModelsByStatusPublic("published")
}

export async function getArchivedBoatModelsPublic(): Promise<PublicBoatModel[]> {
  return getBoatModelsByStatusPublic("archived")
}

async function getBoatModelsByStatusPublic(status: string): Promise<PublicBoatModel[]> {
  const [items, imagesByModelId] = await Promise.all([
    directusItems(
      "boat_models",
      `filter[status][_eq]=${encodeURIComponent(status)}&fields=*.*&limit=200&sort=name`
    ),
    getFirstImageByModelId(),
  ])

  return items
    .map((item: AnyItem): PublicBoatModel => ({
      id: item.id,
      name: item.name || "",
      slug: item.slug || "",
      description: item.short_description || item.description || "",
      brandName: brandName(item.brand),
      brandSlug: brandSlug(item.brand),
      image: getImage(item) || imagesByModelId[String(item.id)] || "",
      price: item.base_price || item.price || null,
      currency: item.currency || "USD",
      loa: item.loa || "",
      beam: item.beam || "",
      cabins: item.cabins || "",
      bathrooms: item.bathrooms || "",
      maxPeople: item.max_people || "",
      featured: Boolean(item.featured),
      sort: Number(item.sort) || 0,
    }))
    .filter((item: PublicBoatModel) => item.name && item.slug)
}

export async function getBoatModelsByBrandPublic(slug: string): Promise<PublicBoatModel[]> {
  const all = await getBoatModelsPublic()

  return all.filter(
    (model: PublicBoatModel) =>
      model.brandSlug === slug ||
      model.brandName.toLowerCase().replaceAll(" ", "-") === slug
  )
}

export async function getEngineModelsPublic(): Promise<PublicEngineModel[]> {
  const items = await directusItems("engine_models", "fields=*.*&limit=200&sort=name")

  return items
    .map((item: AnyItem): PublicEngineModel => ({
      id: item.id,
      name: item.name || "",
      slug: item.slug || "",
      description: item.description || item.short_description || "",
      brandName: brandName(item.brand),
      image: getImage(item),
      power: String(item.power_hp || item.hp || item.power || ""),
      type: item.type || "",
    }))
    .filter((item: PublicEngineModel) => item.name)
}

export async function getNewsPublic(limit = 20): Promise<PublicNewsItem[]> {
  const items = await directusItems(
    "news",
    `filter[status][_eq]=published&fields=*.*&limit=${limit}&sort=-published_at`
  )

  return items
    .map((item: AnyItem): PublicNewsItem => ({
      id: item.id,
      title: item.title || "",
      slug: item.slug || "",
      excerpt: item.excerpt || item.short_description || item.description || "",
      image: getImage(item),
      date: item.published_at || item.date_created || item.date || "",
      kind: item.kind || "news",
      productHandle: item.product_handle || "",
    }))
    .filter((item: PublicNewsItem) => item.title)
}

export async function getNewsBySlugPublic(slug: string): Promise<PublicNewsItem & { content: string } | null> {
  const items = await directusItems(
    "news",
    `filter[status][_eq]=published&filter[slug][_eq]=${encodeURIComponent(slug)}&fields=*.*&limit=1`
  )

  const item = items[0]
  if (!item) return null

  return {
    id: item.id,
    title: item.title || "",
    slug: item.slug || "",
    excerpt: item.excerpt || "",
    image: getImage(item),
    date: item.published_at || item.date_created || "",
    kind: item.kind || "news",
    productHandle: item.product_handle || "",
    content: item.content || "",
  }
}

/**
 * Zespół z Directusa. `offersOnly` zawęża listę do osób, które przygotowują
 * oferty w konfiguratorze — stopka pokazuje wszystkich (także sklep i serwis).
 */
export async function getTeamPublic(offersOnly = true): Promise<PublicTeamMember[]> {
  const items = await directusItems(
    "team",
    `filter[status][_eq]=published${
      offersOnly ? "&filter[offers][_eq]=true" : ""
    }&fields=id,name,position,email,phone,department,sort&limit=50&sort=sort`
  )

  return items
    .map((item: AnyItem): PublicTeamMember => ({
      id: item.id,
      name: item.name || "",
      position: item.position || "",
      email: item.email || "",
      phone: item.phone || "",
      department: item.department || "",
    }))
    .filter((item: PublicTeamMember) => item.name && (item.email || item.phone))
}

export function formatMoney(value: any, currency = "USD"): string {
  if (!value) return ""
  const number = String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${number} ${currency}`
}
