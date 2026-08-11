import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopTrust } from "@/components/shop/ShopChrome"
import { getShopCategories, getShopProducts } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

const PAGE_SIZE = 24

type ShopPageProps = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ q?: string; sort?: string; strona?: string }>
}

export default async function ShopProductsPage({ params, searchParams }: ShopPageProps) {
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
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <ShopAnnouncement locale={current} />
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Marinero
          </p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            {t.shopTitle}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">{t.shopLead}</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
        <form
          action={href("/sklep/produkty")}
          className="rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm md:p-6"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t.shopSearchPlaceholder}
              className="rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
            />

            <select
              name="sort"
              defaultValue={sort}
              className="rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
            >
              <option value="">{t.shopSortNewest}</option>
              <option value="cena-rosnaco">{t.shopSortPriceAsc}</option>
              <option value="cena-malejaco">{t.shopSortPriceDesc}</option>
            </select>

            <button
              type="submit"
              className="rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
            >
              {t.searchButton}
            </button>
          </div>
        </form>
      </section>

      {categories.length ? (
        <section className="mx-auto max-w-[1500px] px-5 pb-4 md:px-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            {t.shopCategories}
          </h2>

          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 24).map((category) => (
              <a
                key={category.id}
                href={href(`/sklep/kategoria/${category.handle}`)}
                className="rounded-md border border-[#111827]/12 bg-white px-4 py-2 text-sm font-semibold text-[#111827]/70 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
              >
                {category.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {count} {t.shopProducts}
          </h2>
        </div>

        {products.length ? (
          <CartProvider>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} locale={current} quickAdd />
              ))}
            </div>
          </CartProvider>
        ) : (
          <div className="rounded-lg border border-[#111827]/10 bg-white p-8 text-center shadow-sm">
            <p className="text-[#111827]/55">{t.shopNoResults}</p>
          </div>
        )}

        {pages > 1 ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: pages }, (_, index) => index + 1)
              .filter(
                (item) => item === 1 || item === pages || Math.abs(item - page) <= 2
              )
              .map((item, index, list) => (
                <span key={item} className="flex items-center gap-2">
                  {index > 0 && item - list[index - 1] > 1 ? (
                    <span className="text-[#111827]/30">…</span>
                  ) : null}
                  <a
                    href={pageHref(item)}
                    className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                      item === page
                        ? "border-[#2E64A8] bg-[#2E64A8] text-white"
                        : "border-[#111827]/12 bg-white text-[#111827]/70 hover:border-[#2E64A8] hover:text-[#2E64A8]"
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
      <Footer locale={current} />
    </main>
  )
}
