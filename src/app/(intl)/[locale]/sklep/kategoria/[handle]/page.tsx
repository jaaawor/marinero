import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import { notFound } from "next/navigation"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopTrust } from "@/components/shop/ShopChrome"
import { getShopCategories, getShopCategory, getShopProducts } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

const PAGE_SIZE = 24

type CategoryPageProps = {
  params: Promise<{ locale: string; handle: string }>
  searchParams?: Promise<{ strona?: string }>
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

  const [{ products, count }, categories] = await Promise.all([
    getShopProducts({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      categoryId: category.id,
    }),
    getShopCategories(),
  ])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <ShopAnnouncement locale={current} />
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <a
            href={href("/sklep")}
            className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
          >
            ← {t.shopTitle}
          </a>

          <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            {category.name}
          </h1>
          <p className="mt-5 text-lg text-[#111827]/65">
            {count} {t.shopProducts}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-6 md:px-8">
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 24).map((item) => (
            <a
              key={item.id}
              href={href(`/sklep/kategoria/${item.handle}`)}
              className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                item.handle === category.handle
                  ? "border-[#2E64A8] bg-[#2E64A8] text-white"
                  : "border-[#111827]/12 bg-white text-[#111827]/70 hover:border-[#2E64A8] hover:text-[#2E64A8]"
              }`}
            >
              {item.name}
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-6 md:px-8 md:py-10">
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
              .filter((item) => item === 1 || item === pages || Math.abs(item - page) <= 2)
              .map((item) => (
                <a
                  key={item}
                  href={href(
                    `/sklep/kategoria/${category.handle}${item > 1 ? `?strona=${item}` : ""}`
                  )}
                  className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                    item === page
                      ? "border-[#2E64A8] bg-[#2E64A8] text-white"
                      : "border-[#111827]/12 bg-white text-[#111827]/70 hover:border-[#2E64A8] hover:text-[#2E64A8]"
                  }`}
                >
                  {item}
                </a>
              ))}
          </div>
        ) : null}
      </section>

      <ShopTrust locale={current} />
      <Footer locale={current} />
    </main>
  )
}
