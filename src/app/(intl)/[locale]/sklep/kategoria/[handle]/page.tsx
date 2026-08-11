import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopNav from "@/components/shop/ShopNav"
import { notFound } from "next/navigation"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopContactBand, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
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
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} />
      <ShopNav locale={current} categories={categories} activeHandle={category.handle} />

      {/* Ciemny nagłówek kategorii */}
      <section className={shop.dark}>
        <div className={`${shop.container} py-14 md:py-20`}>
          <a href={href("/sklep")} className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/45 transition hover:text-white">
            ← {t.shopTitle}
          </a>

          <h1 className={`${shop.display} mt-7 text-4xl md:text-6xl`}>{category.name}</h1>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
            {count} {t.shopProducts}
          </p>
        </div>
      </section>

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
              .map((item) => (
                <a
                  key={item}
                  href={href(
                    `/sklep/kategoria/${category.handle}${item > 1 ? `?strona=${item}` : ""}`
                  )}
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
      </section>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
