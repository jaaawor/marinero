import type { MetadataRoute } from "next"
import { LOCALES, localeHref } from "@/lib/i18n"
import { getAllShopProducts, getShopCategories } from "@/lib/medusa"
import { getBoatModelsPublic, getBrandsPublic, getNewsPublic } from "@/lib/public-site-data"
import { SHOP_TAXONOMY } from "@/lib/shop-taxonomy"
import { absoluteUrl } from "@/lib/seo"

// Mapa strony budowana z danych, nie z listy wpisanej ręcznie — 79 modeli
// i kilkaset produktów zmienia się bez wdrożenia, więc lista musi odświeżać
// się sama.
export const revalidate = 3600

type Entry = {
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  lastModified?: Date
}

/**
 * Jeden adres w ośmiu wersjach językowych. Polska wersja jest kanoniczna
 * (stoi bez prefiksu), reszta trafia do `alternates.languages` — dzięki temu
 * Google nie traktuje tłumaczeń jak zduplikowanej treści.
 */
function withLanguages(entry: Entry): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {}
  for (const code of LOCALES) {
    languages[code] = absoluteUrl(localeHref(code, entry.path))
  }

  return {
    url: absoluteUrl(localeHref("pl", entry.path)),
    lastModified: entry.lastModified || new Date(),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    alternates: { languages },
  }
}

const STATIC: Entry[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/lodzie", priority: 0.9, changeFrequency: "weekly" },
  { path: "/modele", priority: 0.9, changeFrequency: "weekly" },
  { path: "/silniki", priority: 0.8, changeFrequency: "weekly" },
  { path: "/sklep", priority: 0.9, changeFrequency: "daily" },
  { path: "/sklep/produkty", priority: 0.8, changeFrequency: "daily" },
  { path: "/aktualnosci", priority: 0.7, changeFrequency: "weekly" },
  { path: "/kontakt", priority: 0.7, changeFrequency: "monthly" },
  { path: "/archiwum", priority: 0.4, changeFrequency: "monthly" },
  { path: "/regulamin", priority: 0.3, changeFrequency: "yearly" },
  { path: "/polityka-prywatnosci", priority: 0.3, changeFrequency: "yearly" },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Każde źródło osobno — padnięta Medusa nie może zabrać z mapy modeli łodzi.
  const [models, brands, news, categories, products] = await Promise.all([
    getBoatModelsPublic().catch(() => []),
    getBrandsPublic().catch(() => []),
    getNewsPublic(100).catch(() => []),
    getShopCategories().catch(() => []),
    getAllShopProducts().catch(() => []),
  ])

  const entries: Entry[] = [...STATIC]

  for (const brand of brands) {
    if (brand?.slug) entries.push({ path: `/marki/${brand.slug}`, priority: 0.8, changeFrequency: "weekly" })
  }

  for (const model of models) {
    if (model?.slug) entries.push({ path: `/modele/${model.slug}`, priority: 0.9, changeFrequency: "weekly" })
  }

  for (const item of news) {
    if (item?.slug) {
      entries.push({
        path: `/aktualnosci/${item.slug}`,
        priority: 0.5,
        changeFrequency: "monthly",
        lastModified: item.date ? new Date(item.date) : undefined,
      })
    }
  }

  // Działy sklepu z taksonomii — „Elektronika" nie ma w Medusie własnego
  // worka na towar, więc z samych kategorii by wypadła.
  const shopHandles = new Set<string>(SHOP_TAXONOMY.map((group) => group.handle))
  for (const category of categories) {
    if (category?.handle) shopHandles.add(category.handle)
  }

  for (const handle of shopHandles) {
    entries.push({ path: `/sklep/kategoria/${handle}`, priority: 0.7, changeFrequency: "weekly" })
  }

  for (const product of products) {
    if (product?.handle) {
      entries.push({ path: `/sklep/produkt/${product.handle}`, priority: 0.7, changeFrequency: "weekly" })
    }
  }

  const seen = new Set<string>()
  return entries
    .filter((entry) => {
      if (seen.has(entry.path)) return false
      seen.add(entry.path)
      return true
    })
    .map(withLanguages)
}
