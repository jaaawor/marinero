import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopNav from "@/components/shop/ShopNav"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopStats,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { formatPrice, getShopCategories, getShopProducts } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type ShopHomeProps = {
  params: Promise<{ locale: string }>
}

const SHOP_BRANDS = ["Mercury", "Suzuki", "Garmin", "Simrad", "Fusion", "Torqeedo"]

export default async function ShopHomePage({ params }: ShopHomeProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const [categories, newest, pool] = await Promise.all([
    getShopCategories(),
    getShopProducts({ limit: 8, order: "-created_at" }),
    getShopProducts({ limit: 100, order: "-created_at" }),
  ])

  const imageByCategory = new Map<string, string>()
  for (const product of pool.products) {
    for (const category of product.categories) {
      if (product.thumbnail && !imageByCategory.has(category.id)) {
        imageByCategory.set(category.id, product.thumbnail)
      }
    }
  }

  const collections = categories.slice(0, 5)
  const heroProduct = pool.products.find((item) => item.thumbnail && (item.price || 0) > 100000)
  const heroImage = heroProduct?.thumbnail || newest.products[0]?.thumbnail || ""

  const featured: ShopProduct[] = pool.products
    .filter((product) => typeof product.price === "number" && product.thumbnail)
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 8)

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} />
      <ShopNav locale={current} categories={categories} />

      {/* HERO — ciemny, pełnoekranowy, duża typografia */}
      <section className={`relative overflow-hidden ${shop.dark}`}>
        <div className={`${shop.container} grid items-center gap-12 py-16 lg:grid-cols-[1fr_0.9fr] lg:py-24`}>
          <div>
            <p className={shop.eyebrowLight}>{t.shopStatsEyebrow}</p>

            <h1 className={`${shop.display} mt-7 text-[2.6rem] md:text-6xl xl:text-7xl`}>
              {t.shopHeroTitle}
            </h1>

            <p className="mt-8 max-w-xl text-base leading-8 text-white/60 md:text-lg">
              {t.shopHeroLead}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href={href("/sklep/produkty")} className={`${shop.btnOnDark}`}>
                {t.shopHeroCta}
              </a>
              <a href={href("/kontakt")} className={shop.btnLight}>
                {t.shopHeroSecondary}
              </a>
            </div>
          </div>

          {heroImage ? (
            <a
              href={
                heroProduct
                  ? href(`/sklep/produkt/${heroProduct.handle}`)
                  : href("/sklep/produkty")
              }
              className="group relative"
            >
              <div className="flex aspect-square items-center justify-center bg-white/[0.04] p-12">
                <img
                  src={heroImage}
                  alt={heroProduct?.title || t.shopTitle}
                  className="h-full w-full object-contain transition duration-700 group-hover:scale-[1.05]"
                />
              </div>

              {heroProduct ? (
                <div className="mt-5 flex items-end justify-between gap-6 border-t border-white/15 pt-5">
                  <p className="max-w-xs text-sm leading-6 text-white/70">{heroProduct.title}</p>
                  <p className="shrink-0 text-lg font-semibold">
                    {heroProduct.price ? formatPrice(heroProduct.price) : ""}
                  </p>
                </div>
              ) : null}
            </a>
          ) : null}
        </div>
      </section>

      {/* KOLEKCJE — wysokie kadry z nazwą na zdjęciu */}
      {collections.length ? (
        <section className={`${shop.container} py-16 md:py-24`}>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={shop.eyebrow}>{t.shopCollections}</p>
              <h2 className={`${shop.display} mt-4 text-3xl md:text-5xl`}>{t.shopCategories}</h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#0E1A2B]/55">
                {t.shopCategoriesLead}
              </p>
            </div>

            <a href={href("/sklep/produkty")} className={shop.link}>
              {t.shopBrowseAll} →
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((category, index) => (
              <a
                key={category.id}
                href={href(`/sklep/kategoria/${category.handle}`)}
                className={`group relative overflow-hidden bg-white ${
                  index === 0 ? "sm:col-span-2 sm:row-span-2" : ""
                }`}
              >
                <div
                  className={`flex items-center justify-center p-10 ${
                    index === 0 ? "aspect-[16/11] sm:aspect-[4/3]" : "aspect-[4/3]"
                  }`}
                >
                  {imageByCategory.get(category.id) ? (
                    <img
                      src={imageByCategory.get(category.id)}
                      alt={category.name}
                      className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.06]"
                    />
                  ) : null}
                </div>

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#0E1A2B]/85 via-[#0E1A2B]/30 to-transparent p-6 pt-16">
                  <div>
                    <h3
                      className={`font-semibold tracking-[-0.02em] text-white ${
                        index === 0 ? "text-2xl md:text-3xl" : "text-xl"
                      }`}
                    >
                      {category.name}
                    </h3>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                      {category.productCount} {t.shopProducts}
                    </p>
                  </div>

                  <span className="shrink-0 text-white/70 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <ShopStats
        locale={current}
        productCount={pool.count}
        categoryCount={categories.length}
      />

      {/* WYBRANE PRODUKTY */}
      <CartProvider>
        {featured.length ? (
          <section className={`${shop.container} py-16 md:py-24`}>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className={shop.eyebrow}>{t.shopFeatured}</p>
                <h2 className={`${shop.display} mt-4 text-3xl md:text-5xl`}>{t.shopPopular}</h2>
              </div>

              <a href={href("/sklep/produkty")} className={shop.link}>
                {t.shopBrowseAll} →
              </a>
            </div>

            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} locale={current} quickAdd />
              ))}
            </div>
          </section>
        ) : null}

        {/* NOWOŚCI na białym tle */}
        {newest.products.length ? (
          <section className="border-y border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-16 md:py-24`}>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                <h2 className={`${shop.display} text-3xl md:text-5xl`}>{t.shopNewest}</h2>
                <a href={href("/sklep/produkty")} className={shop.link}>
                  {t.shopBrowseAll} →
                </a>
              </div>

              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {newest.products.slice(0, 4).map((product) => (
                  <ProductCard key={product.id} product={product} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </CartProvider>

      {/* MARKI */}
      <section className={`${shop.container} py-16 md:py-20`}>
        <p className={shop.eyebrow}>{t.shopBrandsTitle}</p>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[#0E1A2B]/55">{t.shopBrandsLead}</p>

        <div className="mt-10 grid grid-cols-2 gap-px border border-[#0E1A2B]/10 bg-[#0E1A2B]/10 sm:grid-cols-3 lg:grid-cols-6">
          {SHOP_BRANDS.map((brand) => (
            <div
              key={brand}
              className="flex items-center justify-center bg-[#F4F1EC] px-4 py-8 text-sm font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/55 transition hover:bg-white hover:text-[#0E1A2B]"
            >
              {brand}
            </div>
          ))}
        </div>
      </section>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
