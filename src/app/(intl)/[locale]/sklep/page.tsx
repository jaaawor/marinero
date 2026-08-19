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
import ShopStory from "@/components/shop/ShopStory"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getBoatModelsPublic } from "@/lib/public-site-data"
import { getModelImage } from "@/lib/model-taxonomy"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type ShopHomeProps = {
  params: Promise<{ locale: string }>
}

// Logotypy marek — pliki z materiałów Marinero (public/marki-sklep).
// Każdy prowadzi do listy produktów danej marki.
const SHOP_BRANDS = [
  { name: "Mercury", logo: "/marki-sklep/mercury.png", query: "Mercury" },
  { name: "Suzuki", logo: "/marki-sklep/suzuki.png", query: "Suzuki" },
  { name: "Garmin", logo: "/marki-sklep/garmin.png", query: "Garmin" },
  { name: "Torqeedo", logo: "/marki-sklep/torqeedo.png", query: "Torqeedo" },
  { name: "Fusion", logo: "/marki-sklep/fusion.png", query: "Fusion" },
  { name: "Lowrance", logo: "/marki-sklep/lowrance.png", query: "Lowrance" },
]

export default async function ShopHomePage({ params }: ShopHomeProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const [categories, newest, pool, boats] = await Promise.all([
    getShopCategories(),
    getShopProducts({ limit: 8, order: "-created_at" }),
    getShopProducts({ limit: 100, order: "-created_at" }),
    getBoatModelsPublic(),
  ])

  // Zdjęcia z życia bierzemy z galerii modeli — pakshoty na bieli same
  // nie zbudują nastroju, a te kadry i tak są nasze.
  const lifestyle = boats
    .map((boat: any) => ({ image: getModelImage(boat), name: boat.name as string }))
    .filter((item: { image: string }) => Boolean(item.image))

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
    .slice(0, 4)

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} variant="shop" />
      <ShopNav locale={current} categories={categories} />

      {/* HERO — duże zdjęcie z wody, na nim biała karta z tekstem */}
      <section className="relative">
        <div className="relative h-[62vh] min-h-[420px] w-full md:h-[74vh]">
          {lifestyle[0]?.image ? (
            <img
              src={lifestyle[0].image}
              alt={lifestyle[0].name || t.shopTitle}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[#0E1A2B]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A2B]/45 via-transparent to-transparent" />
        </div>

        <div className={`${shop.container} relative -mt-24 md:-mt-32`}>
          <div className="max-w-2xl bg-white p-8 shadow-[0_40px_80px_-60px_rgba(14,26,43,0.8)] md:p-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#2E64A8]">
              {t.shopStatsEyebrow}
            </p>

            <h1 className={`${shop.display} mt-6 text-[2.25rem] md:text-[3.25rem]`}>
              {t.shopHeroTitle}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-[#0E1A2B]/60">{t.shopHeroLead}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={href("/sklep/produkty")} className={shop.btnPrimary}>
                {t.shopHeroCta}
              </a>
              <a href={href("/kontakt")} className={shop.btnGhost}>
                {t.shopHeroSecondary}
              </a>
            </div>
          </div>

          {/* Trzy fakty pod kartą — lekko, bez ciężkiego pasa */}
          <dl className="mt-10 grid max-w-3xl grid-cols-3 gap-6 border-t border-[#0E1A2B]/10 pt-7">
            {[
              { value: String(pool.count), label: t.shopProducts },
              { value: "24 h", label: t.shopTrust2 },
              { value: String(menu.length), label: t.shopCategories },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                  {item.value}
                </dt>
                <dd className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/40">
                  {item.label}
                </dd>
              </div>
            ))}
          </dl>
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
                className="group flex flex-col border border-[#0E1A2B]/10 bg-white p-6 transition hover:border-[#0E1A2B]/25 hover:shadow-[0_24px_60px_-40px_rgba(14,26,43,0.55)]"
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

      <ShopStory
        eyebrow={t.shopStoryEyebrow1}
        title={t.shopStoryTitle1}
        lead={t.shopStoryLead1}
        ctaLabel={t.shopStoryCta1}
        ctaHref={href("/kontakt")}
        image={lifestyle[1]?.image || lifestyle[0]?.image || ""}
        imageAlt={lifestyle[1]?.name || ""}
      />

      {/* MARKI */}
      <section className="border-y border-[#0E1A2B]/10 bg-white">
        <div className={`${shop.container} py-14 md:py-16`}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={shop.eyebrow}>{t.shopBrandsTitle}</p>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[#0E1A2B]/55">
                {t.shopBrandsLead}
              </p>
            </div>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SHOP_BRANDS.map((brand) => (
              <a
                key={brand.name}
                href={href(`/sklep/produkty?marka=${encodeURIComponent(brand.query)}`)}
                aria-label={brand.name}
                className="flex h-24 items-center justify-center border border-[#0E1A2B]/10 bg-white px-6 transition hover:border-[#0E1A2B]/30 hover:shadow-[0_18px_40px_-30px_rgba(14,26,43,0.6)]"
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-7 w-auto max-w-full object-contain opacity-70 transition group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

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

      <ShopStory
        reverse
        eyebrow={t.shopStoryEyebrow2}
        title={t.shopStoryTitle2}
        lead={t.shopStoryLead2}
        ctaLabel={t.shopStoryCta2}
        ctaHref={href("/kontakt")}
        image={lifestyle[2]?.image || lifestyle[0]?.image || ""}
        imageAlt={lifestyle[2]?.name || ""}
      />

      {/* Marinero od 2004 — tuż nad trzema powodami zakupu */}
      <ShopStats locale={current} productCount={pool.count} categoryCount={menu.length} />

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
