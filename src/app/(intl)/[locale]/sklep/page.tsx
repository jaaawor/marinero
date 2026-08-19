import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopHeader from "@/components/shop/ShopHeader"
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
import { getShopLifestyle } from "@/lib/shop-lifestyle"
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

  const [categories, newest, pool, lifestyle] = await Promise.all([
    getShopCategories(),
    getShopProducts({ limit: 8, order: "-created_at" }),
    getShopProducts({ limit: 100, order: "-created_at" }),
    getShopLifestyle(),
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

  const featured: ShopProduct[] = pool.products
    .filter((product) => typeof product.price === "number" && product.thumbnail)
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 4)

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />

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

      {/* DZIAŁY — mozaika redakcyjna: pierwszy dział na zdjęciu z wody,
          pozostałe na czystej bieli, bez ramek i kafelkowej siatki. */}
      {menu.length ? (
        <section className={`${shop.container} py-16 md:py-24`}>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
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

          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {menu.map((group, index) => {
              const pack =
                imageByCategory.get(group.handle) ||
                imageByCategory.get(group.children[0]?.handle || "")

              // Pierwszy dział dostaje kadr z życia — łączy listę działów
              // z resztą strony, zamiast otwierać ją siatką pakshotów.
              if (index === 0) {
                const cover = lifestyle[3]?.image || lifestyle[0]?.image || ""

                return (
                  <a
                    key={group.handle}
                    href={href(`/sklep/kategoria/${group.handle}`)}
                    className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden sm:col-span-2 lg:row-span-2"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[#0E1A2B]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A2B]/85 via-[#0E1A2B]/25 to-transparent" />

                    <div className="relative p-8 md:p-11">
                      <p className={shop.eyebrowLight}>
                        {group.productCount} {t.shopProducts}
                      </p>

                      <h3 className={`${shop.display} mt-4 text-4xl text-white md:text-5xl`}>
                        {group.label}
                      </h3>

                      {group.children.length ? (
                        <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                          {group.children.map((child) => child.label).join(" · ")}
                        </p>
                      ) : null}

                      <span className="mt-7 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-white">
                        {t.shopBrowseAll}
                        <span className="transition group-hover:translate-x-1">→</span>
                      </span>
                    </div>
                  </a>
                )
              }

              return (
                <a
                  key={group.handle}
                  href={href(`/sklep/kategoria/${group.handle}`)}
                  className="group flex flex-col"
                >
                  <div className="flex aspect-[5/4] items-center justify-center overflow-hidden bg-white p-10 transition duration-500 group-hover:shadow-[0_36px_70px_-52px_rgba(14,26,43,0.75)]">
                    {pack ? (
                      <img
                        src={pack}
                        alt=""
                        className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.07]"
                      />
                    ) : null}
                  </div>

                  <div className="mt-6 flex items-baseline justify-between gap-5 border-t border-[#0E1A2B]/10 pt-5">
                    <h3 className={`${shop.display} text-2xl md:text-[1.75rem]`}>{group.label}</h3>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
                      {group.productCount}
                    </span>
                  </div>

                  {group.children.length ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#0E1A2B]/45">
                      {group.children.map((child) => child.label).join(" · ")}
                    </p>
                  ) : null}
                </a>
              )
            })}
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

      {/* WYBRANE PRODUKTY — jeden produkt duży, obok szyna z pozostałymi */}
      <CartProvider>
        {featured.length ? (
          <section className="border-y border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-16 md:py-24`}>
              <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
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

              <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[1.35fr_1fr]">
                {featured[0] ? (
                  <a
                    href={href(`/sklep/produkt/${featured[0].handle}`)}
                    className="group flex flex-col"
                  >
                    <div className="flex aspect-[16/11] items-center justify-center overflow-hidden bg-white p-8 transition duration-500 group-hover:shadow-[0_40px_80px_-56px_rgba(14,26,43,0.75)] md:p-14">
                      {featured[0].thumbnail ? (
                        <img
                          src={featured[0].thumbnail}
                          alt={featured[0].title}
                          className="h-full w-full object-contain transition duration-[900ms] ease-out group-hover:scale-[1.05]"
                        />
                      ) : null}
                    </div>

                    <div className="mt-7 border-t border-[#0E1A2B]/10 pt-6">
                      {featured[0].categories[0] ? (
                        <p className={shop.eyebrow}>{featured[0].categories[0].name}</p>
                      ) : null}

                      <h3
                        className={`${shop.display} mt-4 text-2xl transition group-hover:text-[#2E64A8] md:text-[2rem]`}
                      >
                        {featured[0].title}
                      </h3>

                      <p className="mt-5 text-xl font-semibold tracking-[-0.02em]">
                        {formatPrice(featured[0].price)}
                      </p>
                    </div>
                  </a>
                ) : null}

                <div className="flex flex-col justify-center divide-y divide-[#0E1A2B]/10">
                  {featured.slice(1, 4).map((product) => (
                    <a
                      key={product.id}
                      href={href(`/sklep/produkt/${product.handle}`)}
                      className="group flex items-center gap-6 py-6 first:pt-0 last:pb-0"
                    >
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-white p-2 md:h-28 md:w-28">
                        {product.thumbnail ? (
                          <img
                            src={product.thumbnail}
                            alt={product.title}
                            loading="lazy"
                            className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.07]"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        {product.categories[0] ? (
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
                            {product.categories[0].name}
                          </p>
                        ) : null}

                        <h3 className="mt-2 line-clamp-2 text-[15px] font-medium leading-6 transition group-hover:text-[#2E64A8]">
                          {product.title}
                        </h3>

                        <p className="mt-2 text-base font-semibold tracking-[-0.01em]">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* NOWOŚCI */}
        {newest.products.length ? (
          <section className={`${shop.container} py-16 md:py-24`}>
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
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
