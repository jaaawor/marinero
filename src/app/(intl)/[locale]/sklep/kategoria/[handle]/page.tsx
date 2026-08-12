import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopNav from "@/components/shop/ShopNav"
import ShopFilters, { ActiveFilterChips } from "@/components/shop/ShopFilters"
import { notFound } from "next/navigation"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopPageHeader,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories, getShopCategory, getShopProducts } from "@/lib/medusa"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import {
  applyFilters,
  availabilityCounts,
  brandCounts,
  parseFilters,
  technicalFacets,
} from "@/lib/shop-filters"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

const PAGE_SIZE = 24

type CategoryPageProps = {
  params: Promise<{ locale: string; handle: string }>
  searchParams?: Promise<Record<string, string | undefined>>
}

export default async function ShopCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, handle } = await params
  const search = (await searchParams) || {}
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const category = await getShopCategory(handle)
  if (!category) {
    notFound()
  }

  const page = Math.max(1, Number(search.strona) || 1)
  const filters = parseFilters(search)

  // Kategoria może mieć więcej niż stronę wyników (Silniki: 170), a filtry
  // liczymy na pełnej liście — dociągamy resztę stronami po 100.
  const [listing, categories] = await Promise.all([
    getShopProducts({ limit: 100, categoryId: category.id }),
    getShopCategories(),
  ])

  const all = [...listing.products]
  for (let offset = 100; offset < Math.min(listing.count, 400); offset += 100) {
    const chunk = await getShopProducts({ limit: 100, offset, categoryId: category.id })
    all.push(...chunk.products)
  }
  const filtered = applyFilters(all, filters)
  const products = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Dział, w którym mieści się ta kategoria — jego pozycje idą do filtrów.
  const menu = buildShopMenu(categories)
  const group =
    menu.find((item) => item.children.some((child) => child.handle === category.handle)) ||
    menu.find((item) => item.handle === category.handle)

  const prices = all.map((item) => item.price).filter((price): price is number => price !== null)

  const basePath = `/sklep/kategoria/${category.handle}`

  const pageHref = (target: number) => {
    const merged: Record<string, string> = {}
    for (const [key, value] of Object.entries(search)) {
      if (value && key !== "strona") merged[key] = value
    }
    if (target > 1) merged.strona = String(target)
    const query = new URLSearchParams(merged).toString()
    return href(`${basePath}${query ? `?${query}` : ""}`)
  }

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} variant="shop" />
      <ShopNav locale={current} categories={categories} activeHandle={category.handle} />

      <ShopPageHeader
        locale={current}
        title={category.name}
        meta={`${filtered.length} ${t.shopProducts}`}
      />

      <section className={`${shop.container} py-10 md:py-14`}>
        <div className="grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
          <ShopFilters
            locale={current}
            basePath={basePath}
            params={search}
            filters={filters}
            brands={brandCounts(all)}
            availability={availabilityCounts(all)}
            group={group}
            activeHandle={category.handle}
            priceRange={
              prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined
            }
            technical={technicalFacets(all)}
            total={filtered.length}
          />

          <div>
            <ActiveFilterChips locale={current} basePath={basePath} params={search} />

            {products.length ? (
              <CartProvider>
                <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} locale={current} quickAdd />
                  ))}
                </div>
              </CartProvider>
            ) : (
              <p className="py-16 text-center text-[#0E1A2B]/45">{t.shopNoResults}</p>
            )}

            {pages > 1 ? (
              <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
                {Array.from({ length: pages }, (_, index) => index + 1)
                  .filter((item) => item === 1 || item === pages || Math.abs(item - page) <= 2)
                  .map((item) => (
                    <a
                      key={item}
                      href={pageHref(item)}
                      className={`min-w-[44px] rounded-sm px-3 py-2.5 text-center text-sm font-bold transition ${
                        item === page
                          ? "bg-[#0E1A2B] text-white"
                          : "border border-[#0E1A2B]/15 text-[#0E1A2B]/60 hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                      }`}
                    >
                      {item}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
