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
import { buildShopMenu } from "@/lib/shop-taxonomy"
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
      if (product.thumbnail && !imageByCategory.has(category.handle)) {
        imageByCategory.set(category.handle, product.thumbnail)
      }
    }
  }

  // Kategorie z Medusy są płaskie — na stronie pokazujemy działy z `shop-taxonomy`.
  const menu = buildShopMenu(categories)

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

      {/* HERO — jasny, redakcyjny: typografia po lewej, produkt po prawej */}
      <section className="border-b border-[#0E1A2B]/10 bg-white">
        <div
          className={`${shop.container} grid items-center gap-12 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20 lg:py-20`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#2E64A8]">
              {t.shopStatsEyebrow}
            </p>

            <h1 className={`${shop.display} mt-7 text-[2.5rem] md:text-6xl xl:text-[4.25rem]`}>
              {t.shopHeroTitle}
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-[#0E1A2B]/60 md:text-lg">
              {t.shopHeroLead}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={href("/sklep/produkty")} className={shop.btnPrimary}>
                {t.shopHeroCta}
              </a>
              <a href={href("/kontakt")} className={shop.btnGhost}>
                {t.shopHeroSecondary}
              </a>
            </div>

            {/* Trzy fakty zamiast ciężkiego pasa — lekko i konkretnie */}
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-[#0E1A2B]/10 pt-7">
              {[
                { value: String(pool.count), label: t.shopProducts },
                { value: "24 h", label: t.shopTrust2 },
                { value: String(menu.length), label: t.shopCategories },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-2xl font-semibold tracking-[-0.03em]">{item.value}</dt>
                  <dd className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/40">
                    {item.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {heroImage ? (
            <a
              href={
                heroProduct
                  ? href(`/sklep/produkt/${heroProduct.handle}`)
                  : href("/sklep/produkty")
              }
              className="group relative block"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-[#F4F1EC] p-10 md:p-16">
                <img
                  src={heroImage}
                  alt={heroProduct?.title || t.shopTitle}
                  className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>

              {heroProduct ? (
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-6 bg-white/95 p-5 backdrop-blur md:left-8 md:right-8 md:max-w-md">
                  <div className="min-w-0">
                    <p className={shop.eyebrow}>{t.shopFeatured}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#0E1A2B]/75">
                      {heroProduct.title}
                    </p>
                  </div>

                  <p className="shrink-0 text-lg font-semibold tracking-[-0.02em]">
                    {heroProduct.price ? formatPrice(heroProduct.price) : ""}
                  </p>
                </div>
              ) : null}
            </a>
          ) : null}
        </div>
      </section>

      {/* DZIAŁY — sześć kafelków wg uporządkowanej taksonomii */}
      {menu.length ? (
        <section className={`${shop.container} py-14 md:py-20`}>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={shop.eyebrow}>{t.shopCollections}</p>
              <h2 className={`${shop.display} mt-4 text-3xl md:text-[2.75rem]`}>
                {t.shopCategories}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#0E1A2B]/55">
                {t.shopCategoriesLead}
              </p>
            </div>

            <a href={href("/sklep/produkty")} className={shop.link}>
              {t.shopBrowseAll} →
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menu.map((group) => (
              <a
                key={group.handle}
                href={href(`/sklep/kategoria/${group.handle}`)}
                className="group flex flex-col bg-white p-6 transition hover:shadow-[0_24px_60px_-40px_rgba(14,26,43,0.55)]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.02em]">{group.label}</h3>
                    <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
                      {group.productCount} {t.shopProducts}
                    </p>
                  </div>

                  <span className="text-[#0E1A2B]/25 transition group-hover:translate-x-1 group-hover:text-[#2E64A8]">
                    →
                  </span>
                </div>

                <div className="mt-6 flex h-32 items-center justify-center md:h-40">
                  {imageByCategory.get(group.handle) ||
                  imageByCategory.get(group.children[0]?.handle || "") ? (
                    <img
                      src={
                        imageByCategory.get(group.handle) ||
                        imageByCategory.get(group.children[0]?.handle || "")
                      }
                      alt=""
                      className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.06]"
                    />
                  ) : null}
                </div>

                {group.children.length ? (
                  <p className="mt-6 line-clamp-2 border-t border-[#0E1A2B]/10 pt-4 text-sm leading-6 text-[#0E1A2B]/45">
                    {group.children.map((child) => child.label).join(" · ")}
                  </p>
                ) : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* WYBRANE PRODUKTY */}
      <CartProvider>
        {featured.length ? (
          <section className="border-y border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-14 md:py-20`}>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className={shop.eyebrow}>{t.shopFeatured}</p>
                  <h2 className={`${shop.display} mt-4 text-3xl md:text-[2.75rem]`}>
                    {t.shopPopular}
                  </h2>
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
            </div>
          </section>
        ) : null}

        {/* NOWOŚCI */}
        {newest.products.length ? (
          <section className={`${shop.container} py-14 md:py-20`}>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <h2 className={`${shop.display} text-3xl md:text-[2.75rem]`}>{t.shopNewest}</h2>
              <a href={href("/sklep/produkty")} className={shop.link}>
                {t.shopBrowseAll} →
              </a>
            </div>

            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {newest.products.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} locale={current} quickAdd />
              ))}
            </div>
          </section>
        ) : null}
      </CartProvider>

      <ShopStats locale={current} productCount={pool.count} categoryCount={menu.length} />

      {/* MARKI */}
      <section className={`${shop.container} py-14 md:py-16`}>
        <p className={shop.eyebrow}>{t.shopBrandsTitle}</p>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[#0E1A2B]/55">{t.shopBrandsLead}</p>

        <div className="mt-9 grid grid-cols-2 gap-px border border-[#0E1A2B]/10 bg-[#0E1A2B]/10 sm:grid-cols-3 lg:grid-cols-6">
          {SHOP_BRANDS.map((brand) => (
            <div
              key={brand}
              className="flex items-center justify-center bg-white px-4 py-8 text-sm font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/50 transition hover:text-[#0E1A2B]"
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
