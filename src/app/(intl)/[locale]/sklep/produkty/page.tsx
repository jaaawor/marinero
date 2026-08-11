import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopNav from "@/components/shop/ShopNav"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopPageHeader,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories, getShopProducts } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

const PAGE_SIZE = 24

type ShopProductsProps = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ q?: string; sort?: string; strona?: string }>
}

export default async function ShopProductsPage({ params, searchParams }: ShopProductsProps) {
  const { locale } = await params
  const search = (await searchParams) || {}
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const query = (search.q || "").trim()
  const sort = search.sort || ""
  const page = Math.max(1, Number(search.strona) || 1)

  const order =
    sort === "cena-rosnaco"
      ? "variants.calculated_price"
      : sort === "cena-malejaco"
        ? "-variants.calculated_price"
        : "-created_at"

  const [categories, { products, count }] = await Promise.all([
    getShopCategories(),
    getShopProducts({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      query: query || undefined,
      order,
    }),
  ])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (sort) params.set("sort", sort)
    if (target > 1) params.set("strona", String(target))
    const suffix = params.toString()
    return href(`/sklep/produkty${suffix ? `?${suffix}` : ""}`)
  }

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} />
      <ShopNav locale={current} categories={categories} />

      <ShopPageHeader
        locale={current}
        title={t.shopAllProducts}
        meta={`${count} ${t.shopProducts}`}
      />

      {/* Pasek wyszukiwania i sortowania */}
      <div className="border-b border-[#0E1A2B]/10 bg-white">
        <form action={href("/sklep/produkty")} className={`${shop.container} py-4`}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t.shopSearchPlaceholder}
              className="rounded-sm border border-[#0E1A2B]/15 px-4 py-3 text-sm outline-none transition focus:border-[#0E1A2B]"
            />

            <select
              name="sort"
              defaultValue={sort}
              className="rounded-sm border border-[#0E1A2B]/15 px-4 py-3 text-sm outline-none transition focus:border-[#0E1A2B]"
            >
              <option value="">{t.shopSortNewest}</option>
              <option value="cena-rosnaco">{t.shopSortPriceAsc}</option>
              <option value="cena-malejaco">{t.shopSortPriceDesc}</option>
            </select>

            <button
              type="submit"
              className="rounded-sm bg-[#0E1A2B] px-8 py-3 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8]"
            >
              {t.searchButton}
            </button>
          </div>
        </form>
      </div>

      <section className={`${shop.container} py-14 md:py-20`}>
        {products.length ? (
          <CartProvider>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      </section>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
