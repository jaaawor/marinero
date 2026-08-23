// Klient Medusa Store API. Klucz publishable jest z założenia publiczny
// (trafia do przeglądarki), sekrety trzymamy poza repo.

import { plGrouping } from "@/lib/format"
import { SHOP_TAXONOMY } from "@/lib/shop-taxonomy"

export const MEDUSA_URL =
  process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"

export const MEDUSA_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"

// Sklep prowadzi sprzedaż w złotówkach.
export const SHOP_REGION_CURRENCY = "pln"

// Instalacja Medusy ma jeszcze kategorie z przykładowych danych — pomijamy je.
const SEED_CATEGORY_HANDLES = new Set(["shirts", "sweatshirts", "pants", "merch"])

export type ShopImage = { id: string; url: string }

export type ShopVariant = {
  id: string
  title: string
  /** Symbol produktu — wspólny klucz dla Allegro, OLX i magazynu. */
  sku: string
  price: number | null
  inventoryQuantity: number | null
  allowBackorder: boolean
  manageInventory: boolean
  /** Czy cena z Medusy zawiera już VAT (ustawienie regionu). */
  taxInclusive: boolean
  /** Opcje wariantu, np. „Akumulator: Tak". */
  options: { title: string; value: string }[]
}

export type ShopProduct = {
  id: string
  handle: string
  title: string
  subtitle: string
  description: string
  thumbnail: string
  images: ShopImage[]
  price: number | null
  /** Ceny w tym regionie są brutto (zawierają VAT). */
  taxInclusive: boolean
  /** Tytuły opcji produktu w kolejności z Medusy. */
  optionTitles: string[]
  /** Metadane produktu — stąd bierzemy m.in. dostępność. */
  metadata: Record<string, unknown>
  variants: ShopVariant[]
  categories: { id: string; name: string; handle: string }[]
}

export type ShopCategory = {
  id: string
  name: string
  handle: string
  /** Opis z panelu Medusy — wstęp nad listą produktów. */
  description?: string
  productCount?: number
  /** Metadane kategorii z panelu Medusy — m.in. treść zajawki marki. */
  metadata?: Record<string, unknown>
}

async function medusaFetch(path: string, init: RequestInit = {}, revalidate = 300) {
  const response = await fetch(`${MEDUSA_URL}/store${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": MEDUSA_KEY,
      ...(init.headers || {}),
    },
    ...(init.method && init.method !== "GET"
      ? { cache: "no-store" as RequestCache }
      : { next: { revalidate } }),
  })

  if (!response.ok) {
    throw new Error(`Medusa ${path}: ${response.status}`)
  }

  return response.json()
}

function variantPrice(variant: any): number | null {
  const calculated = variant?.calculated_price?.calculated_amount
  if (typeof calculated === "number") return calculated

  const price = (variant?.prices || []).find(
    (item: any) => item?.currency_code === SHOP_REGION_CURRENCY
  )
  return typeof price?.amount === "number" ? price.amount : null
}

function mapProduct(product: any): ShopProduct {
  const variants: ShopVariant[] = (product?.variants || []).map((variant: any) => ({
    id: variant.id,
    title: variant.title || "",
    sku: variant.sku || "",
    price: variantPrice(variant),
    inventoryQuantity:
      typeof variant.inventory_quantity === "number" ? variant.inventory_quantity : null,
    allowBackorder: Boolean(variant.allow_backorder),
    manageInventory: Boolean(variant.manage_inventory),
    taxInclusive: Boolean(variant?.calculated_price?.is_calculated_price_tax_inclusive),
    options: (variant?.options || [])
      .map((option: any) => ({
        title: option?.option?.title || "",
        value: option?.value || "",
      }))
      .filter((option: { title: string; value: string }) => option.title && option.value),
  }))

  const prices = variants.map((v) => v.price).filter((v): v is number => typeof v === "number")

  return {
    id: product.id,
    handle: product.handle || product.id,
    title: product.title || "",
    subtitle: product.subtitle || "",
    description: product.description || "",
    thumbnail: product.thumbnail || product?.images?.[0]?.url || "",
    images: (product.images || []).map((image: any) => ({ id: image.id, url: image.url })),
    price: prices.length ? Math.min(...prices) : null,
    taxInclusive: variants.some((variant) => variant.taxInclusive),
    optionTitles: (product?.options || [])
      .map((option: any) => option?.title || "")
      .filter(Boolean),
    metadata: (product?.metadata || {}) as Record<string, unknown>,
    variants,
    categories: (product.categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
      handle: category.handle,
    })),
  }
}

export async function getShopRegionId(): Promise<string> {
  const data = await medusaFetch("/regions", {}, 3600)
  const regions = data?.regions || []
  const polish = regions.find(
    (region: any) => String(region.currency_code).toLowerCase() === SHOP_REGION_CURRENCY
  )
  return (polish || regions[0])?.id || ""
}

export async function getShopCategories(): Promise<ShopCategory[]> {
  const own = await ownCategories()
  return [...own, ...(await departmentCategories(own))]
}

/**
 * Działy złożone z kilku kategorii Medusy („Elektronika", „Oleje i chemia")
 * mają zero produktów przypisanych wprost, więc wypadłyby z listy. Doliczamy
 * je osobno — i to prawdziwą liczbą pozycji, a nie sumą kategorii składowych:
 * ten sam olej potrafi wisieć i w „Quicksilver", i w „Materiały eksploatacyjne",
 * przez co suma pokazywała 16 tam, gdzie produktów jest 9.
 */
async function departmentCategories(known: ShopCategory[]): Promise<ShopCategory[]> {
  const byHandle = new Map(known.map((category) => [category.handle, category]))
  const out: ShopCategory[] = []

  for (const group of SHOP_TAXONOMY) {
    if (!group.sources?.length || byHandle.has(group.handle)) continue

    const ids = group.sources
      .map((handle) => byHandle.get(handle)?.id)
      .filter((id): id is string => Boolean(id))

    if (!ids.length) continue

    const listing = await getShopProducts({ limit: 1, categoryIds: ids })
    if (!listing.count) continue

    out.push({
      id: `dept:${group.handle}`,
      name: group.label,
      handle: group.handle,
      productCount: listing.count,
      metadata: {},
    })
  }

  return out
}

async function ownCategories(): Promise<ShopCategory[]> {
  try {
    const data = await medusaFetch(
      // `+metadata` z plusem — samo `metadata` przełącza Medusę w tryb
      // „tylko te pola" i gubi nazwę oraz uchwyt.
      "/product-categories?limit=100&fields=id,name,handle,products.id,+metadata"
    )

    return (data?.product_categories || [])
      .map((category: any) => ({
        id: category.id,
        name: category.name || "",
        handle: category.handle || "",
        productCount: (category.products || []).length,
        // Treść zajawki marki — edytowalna w Medusie w metadanych kategorii.
        metadata: category.metadata || {},
      }))
      .filter(
        (category: ShopCategory) =>
          category.name &&
          category.handle &&
          (category.productCount || 0) > 0 &&
          // kategorie z przykładowych danych Medusy — nie są ofertą sklepu
          !SEED_CATEGORY_HANDLES.has(category.handle)
      )
      .sort(
        (a: ShopCategory, b: ShopCategory) => (b.productCount || 0) - (a.productCount || 0)
      )
  } catch {
    return []
  }
}

type ProductQuery = {
  limit?: number
  offset?: number
  categoryId?: string
  /** Kilka kategorii naraz (suma) — dział sklepu bywa złożony z paru gałęzi. */
  categoryIds?: string[]
  query?: string
  order?: string
}

export async function getShopProducts(
  options: ProductQuery = {}
): Promise<{ products: ShopProduct[]; count: number }> {
  const { limit = 24, offset = 0, categoryId, categoryIds, query, order } = options

  try {
    const regionId = await getShopRegionId()
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      // `+metadata` z plusem — samo `metadata` przełącza Medusę na tryb
      // „tylko wymienione pola" i gubi handle, tytuł oraz opis.
      fields:
        "*variants.calculated_price,*variants.options,+variants.sku,*options,*categories,*images,+metadata",
    })

    if (regionId) params.set("region_id", regionId)
    // `category_id[]` powtórzone kilka razy działa jak suma — tak zbieramy
    // dział rozsypany po kilku kategoriach Medusy.
    for (const id of categoryIds || (categoryId ? [categoryId] : [])) {
      params.append("category_id[]", id)
    }
    if (query) params.set("q", query)
    if (order) params.set("order", order)

    const data = await medusaFetch(`/products?${params.toString()}`)

    return {
      products: (data?.products || []).map(mapProduct),
      count: Number(data?.count) || 0,
    }
  } catch {
    return { products: [], count: 0 }
  }
}

export async function getShopProduct(handle: string): Promise<ShopProduct | null> {
  try {
    const regionId = await getShopRegionId()
    const params = new URLSearchParams({
      handle,
      limit: "1",
      // `+metadata` z plusem — samo `metadata` przełącza Medusę na tryb
      // „tylko wymienione pola" i gubi handle, tytuł oraz opis.
      fields:
        "*variants.calculated_price,*variants.options,+variants.sku,*options,*categories,*images,+metadata",
    })
    if (regionId) params.set("region_id", regionId)

    const data = await medusaFetch(`/products?${params.toString()}`)
    const product = data?.products?.[0]
    return product ? mapProduct(product) : null
  } catch {
    return null
  }
}

export async function getShopCategory(handle: string): Promise<ShopCategory | null> {
  try {
    const data = await medusaFetch(
      // `+metadata`, bo opis kategorii redagujemy w panelu Medusy.
      `/product-categories?handle=${encodeURIComponent(
        handle
      )}&limit=1&fields=id,name,handle,description,+metadata`
    )
    const category = data?.product_categories?.[0]
    return category
      ? {
          id: category.id,
          name: category.name,
          handle: category.handle,
          description: category.description || "",
          metadata: category.metadata || {},
        }
      : null
  } catch {
    return null
  }
}

// Medusa podaje kwoty w groszach — w całym sklepie trzymamy je w tej postaci
// i dzielimy dopiero przy wyświetlaniu.
// `plGrouping` domyka spację tysięcy tam, gdzie polskie CLDR jej nie stawia.
export function formatPrice(amount: number | null | undefined, currency = "PLN"): string {
  if (typeof amount !== "number") return ""

  // Medusa 2 trzyma kwoty w jednostce głównej (66 = 66,00 zł). Po imporcie
  // z WooCommerce siedziały tam grosze — dane zostały przeliczone,
  // więc tutaj już nic nie dzielimy.
  const value = amount

  return plGrouping(
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      // Bez tego „1234,50 zł" nie dostaje spacji, a „12 400,00 zł" dostaje.
      useGrouping: "always",
    } as Intl.NumberFormatOptions).format(value)
  )
}


/**
 * Cały katalog stronami po 100 — potrzebny tam, gdzie musimy przeszukać
 * wszystko (podpowiadanie w wyszukiwarce, dopasowania „pasuje do").
 */
export async function getAllShopProducts(max = 400): Promise<ShopProduct[]> {
  const first = await getShopProducts({ limit: 100 })
  const all = [...first.products]

  for (let offset = 100; offset < Math.min(first.count, max); offset += 100) {
    const chunk = await getShopProducts({ limit: 100, offset })
    all.push(...chunk.products)
  }

  return all
}
