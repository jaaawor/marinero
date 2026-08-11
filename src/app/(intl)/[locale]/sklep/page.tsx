import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopTrust } from "@/components/shop/ShopChrome"
import { getShopCategories, getShopProducts } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type ShopHomeProps = {
  params: Promise<{ locale: string }>
}

// Marki, których jesteśmy dealerem — pasek zaufania jak w sklepach wzorcowych.
const SHOP_BRANDS = ["Mercury", "Suzuki", "Garmin", "Simrad", "Fusion", "Torqeedo"]

export default async function ShopHomePage({ params }: ShopHomeProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const [categories, newest, pool] = await Promise.all([
    getShopCategories(),
    getShopProducts({ limit: 8, order: "-created_at" }),
    // szerszy zaciąg, żeby dobrać zdjęcia do kafelków kategorii
    getShopProducts({ limit: 100, order: "-created_at" }),
  ])

  // Kafelek kategorii dostaje zdjęcie pierwszego produktu, jaki do niej należy.
  const imageByCategory = new Map<string, string>()
  for (const product of pool.products) {
    for (const category of product.categories) {
      if (product.thumbnail && !imageByCategory.has(category.id)) {
        imageByCategory.set(category.id, product.thumbnail)
      }
    }
  }

  const topCategories = categories.slice(0, 6)
  const heroImage = newest.products.find((item) => item.thumbnail)?.thumbnail || ""

  const popular: ShopProduct[] = pool.products
    .filter((product) => typeof product.price === "number")
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 8)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <ShopAnnouncement locale={current} />
      <Header locale={current} />

      {/* Hero sklepu */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1500px] items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#2E64A8]">
              {t.shopTitle} Marinero
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-6xl">
              {t.shopHeroTitle}
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-[#111827]/65">{t.shopHeroLead}</p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href={href("/sklep/produkty")}
                className="inline-flex justify-center rounded-md bg-[#2E64A8] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#28588F]"
              >
                {t.shopHeroCta}
              </a>
              <a
                href={href("/kontakt")}
                className="inline-flex justify-center rounded-md border border-[#111827]/15 px-7 py-3.5 text-sm font-bold text-[#111827]/70 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
              >
                {t.shopHeroSecondary}
              </a>
            </div>
          </div>

          <a
            href={href("/sklep/produkty")}
            className="group overflow-hidden rounded-lg bg-[#f6f5f2]"
          >
            <div className="flex aspect-[4/3] items-center justify-center p-10">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt={t.shopTitle}
                  className="h-full w-full object-contain transition duration-700 group-hover:scale-[1.04]"
                />
              ) : null}
            </div>
          </a>
        </div>
      </section>

      {/* Kategorie ze zdjęciami */}
      {topCategories.length ? (
        <section className="mx-auto max-w-[1500px] px-5 py-12 md:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {t.shopCategories}
              </h2>
              <p className="mt-2 max-w-xl text-[#111827]/55">{t.shopCategoriesLead}</p>
            </div>

            <a
              href={href("/sklep/produkty")}
              className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
            >
              {t.shopBrowseAll}
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCategories.map((category) => (
              <a
                key={category.id}
                href={href(`/sklep/kategoria/${category.handle}`)}
                className="group relative overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex aspect-[16/10] items-center justify-center bg-white p-8">
                  {imageByCategory.get(category.id) ? (
                    <img
                      src={imageByCategory.get(category.id)}
                      alt={category.name}
                      className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.05]"
                    />
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-[#111827]/8 px-5 py-4">
                  <span className="text-lg font-semibold">{category.name}</span>
                  <span className="text-sm text-[#111827]/45">
                    {category.productCount} {t.shopProducts}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <CartProvider>
        {/* Najczęściej kupowane */}
        {popular.length ? (
          <section className="mx-auto max-w-[1500px] px-5 pb-12 md:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {t.shopPopular}
              </h2>
              <a
                href={href("/sklep/produkty")}
                className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
              >
                {t.shopBrowseAll}
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((product) => (
                <ProductCard key={product.id} product={product} locale={current} quickAdd />
              ))}
            </div>
          </section>
        ) : null}

        {/* Nowości */}
        {newest.products.length ? (
          <section className="border-t border-[#111827]/10 bg-white">
            <div className="mx-auto max-w-[1500px] px-5 py-12 md:px-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {t.shopNewest}
                </h2>
                <a
                  href={href("/sklep/produkty")}
                  className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
                >
                  {t.shopBrowseAll}
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {newest.products.slice(0, 4).map((product) => (
                  <ProductCard key={product.id} product={product} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </CartProvider>

      {/* Marki */}
      <section className="mx-auto max-w-[1500px] px-5 py-14 md:px-8">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.shopBrandsTitle}</h2>
        <p className="mt-2 max-w-2xl text-[#111827]/55">{t.shopBrandsLead}</p>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SHOP_BRANDS.map((brand) => (
            <div
              key={brand}
              className="flex items-center justify-center rounded-lg border border-[#111827]/10 bg-white px-4 py-6 text-sm font-bold uppercase tracking-[0.18em] text-[#111827]/60"
            >
              {brand}
            </div>
          ))}
        </div>
      </section>

      <ShopTrust locale={current} />
      <Footer locale={current} />
    </main>
  )
}
