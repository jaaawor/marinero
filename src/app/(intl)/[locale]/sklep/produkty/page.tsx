import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopHeader from "@/components/shop/ShopHeader"
import ShopFilters, { ActiveFilterChips } from "@/components/shop/ShopFilters"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopPageHeader,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories, getShopProducts } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import {
  applyFilters,
  availabilityCounts,
  brandCounts,
  parseFilters,
  technicalFacets,
} from "@/lib/shop-filters"
import ShopSubnav from "@/components/shop/ShopSubnav"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getShopLifestyle, pickLifestyle } from "@/lib/shop-lifestyle"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

const PAGE_SIZE = 24

type ShopProductsProps = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | undefined>>
}

export default async function ShopProductsPage({ params, searchParams }: ShopProductsProps) {
  const { locale } = await params
  const search = (await searchParams) || {}
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const query = (search.q || "").trim()
  const brand = (search.marka || "").trim()
  const page = Math.max(1, Number(search.strona) || 1)
  const filters = parseFilters(search)

  const order =
    filters.sort === "cena-rosnaco"
      ? "variants.calculated_price"
      : filters.sort === "cena-malejaco"
        ? "-variants.calculated_price"
        : "-created_at"

  // Filtry liczymy na pełnej liście, więc pobieramy katalog stronami po 100.
  async function loadAll(): Promise<ShopProduct[]> {
    const first = await getShopProducts({
      limit: 100,
      query: query || brand || undefined,
      order,
    })

    const rest: ShopProduct[] = []
    for (let offset = 100; offset < Math.min(first.count, 400); offset += 100) {
      const chunk = await getShopProducts({
        limit: 100,
        offset,
        query: query || brand || undefined,
        order,
      })
      rest.push(...chunk.products)
    }

    return [...first.products, ...rest]
  }

  const [categories, everything, lifestyle] = await Promise.all([
    getShopCategories(),
    loadAll(),
    getShopLifestyle(),
  ])

  // Wyszukiwarka Medusy przegląda też opisy, więc przy filtrze marki
  // zostawiamy tylko trafienia w nazwie produktu.
  const pool = brand
    ? everything.filter((product) => product.title.toLowerCase().includes(brand.toLowerCase()))
    : everything

  const filtered = applyFilters(pool, filters)
  const products = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const prices = pool.map((item) => item.price).filter((price): price is number => price !== null)

  // Po kliknięciu marki („Suzuki") lecą naraz silniki, części i oleje —
  // ten pasek pozwala zawęzić wynik do kategorii, bez szukania w liście.
  const menu = buildShopMenu(categories)
  const groupCounts = new Map<string, number>()
  for (const product of pool) {
    for (const category of product.categories) {
      const group = menu.find(
        (item) =>
          item.handle === category.handle ||
          item.children.some((child) => child.handle === category.handle)
      )
      if (!group) continue
      groupCounts.set(group.handle, (groupCounts.get(group.handle) || 0) + 1)
    }
  }

  const pageHref = (target: number) => {
    const merged: Record<string, string> = {}
    for (const [key, value] of Object.entries(search)) {
      if (value && key !== "strona") merged[key] = value
    }
    if (target > 1) merged.strona = String(target)
    const suffix = new URLSearchParams(merged).toString()
    return href(`/sklep/produkty${suffix ? `?${suffix}` : ""}`)
  }

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />

      <ShopPageHeader
        locale={current}
        title={brand || query || t.shopAllProducts}
        meta={`${filtered.length} ${t.shopProducts}`}
        image={pickLifestyle(lifestyle, brand || query || "katalog")?.image}
      />

      {brand && groupCounts.size > 1 ? (
        <ShopSubnav
          title={brand}
          items={menu
            .filter((group) => groupCounts.get(group.handle))
            .map((group) => ({
              label: group.label,
              href: href(
                `/sklep/kategoria/${group.handle}?marki=${encodeURIComponent(brand)}`
              ),
              count: groupCounts.get(group.handle) || 0,
            }))}
        />
      ) : null}

      <section className={`${shop.container} py-10 md:py-14`}>
        <div className="grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
          <ShopFilters
            locale={current}
            basePath="/sklep/produkty"
            params={search}
            filters={filters}
            brands={brandCounts(pool)}
            availability={availabilityCounts(pool)}
            priceRange={
              prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined
            }
            technical={technicalFacets(pool)}
            total={filtered.length}
          />

          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <ActiveFilterChips locale={current} basePath="/sklep/produkty" params={search} />

              <form action={href("/sklep/produkty")} className="ml-auto flex items-center gap-2">
                {Object.entries(search)
                  .filter(([key, value]) => value && !["sort", "strona"].includes(key))
                  .map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                  ))}

                <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/40">
                  {t.shopSort}
                </label>
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  className="rounded-sm border border-[#0E1A2B]/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0E1A2B]"
                >
                  <option value="">{t.shopSortNewest}</option>
                  <option value="cena-rosnaco">{t.shopSortPriceAsc}</option>
                  <option value="cena-malejaco">{t.shopSortPriceDesc}</option>
                </select>
                <button
                  type="submit"
                  className="rounded-sm border border-[#0E1A2B]/15 px-3 py-2 text-sm text-[#0E1A2B]/60 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                >
                  →
                </button>
              </form>
            </div>

            {products.length ? (
              <CartProvider>
                <div className={shop.gridNarrow}>
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
                  .map((item, index, list) => (
                    <span key={item} className="flex items-center gap-3">
                      {index > 0 && item - list[index - 1] > 1 ? (
                        <span className="text-[#0E1A2B]/25">…</span>
                      ) : null}
                      <a
                        href={pageHref(item)}
                        className={`min-w-[44px] rounded-sm px-3 py-2.5 text-center text-sm font-bold transition ${
                          item === page
                            ? "bg-[#0E1A2B] text-white"
                            : "border border-[#0E1A2B]/15 text-[#0E1A2B]/60 hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                        }`}
                      >
                        {item}
                      </a>
                    </span>
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
