import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopHeader from "@/components/shop/ShopHeader"
import ShopSection from "@/components/shop/ShopSection"
import ShopQuickLinks from "@/components/shop/ShopQuickLinks"
import ProductRail from "@/components/shop/ProductRail"
import CategoryIcon from "@/components/shop/CategoryIcon"
import BrandTeaser from "@/components/shop/BrandTeaser"
import { CartProvider } from "@/components/shop/CartProvider"
import CartFlyout from "@/components/shop/CartFlyout"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopStats,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getAllShopProducts, getShopCategories, getShopProducts } from "@/lib/medusa"
import { wybraneProdukty } from "@/lib/polecane"
import type { ShopProduct } from "@/lib/medusa"
import ShopStory from "@/components/shop/ShopStory"
import { getSearchIndex } from "@/lib/shop-search"
import { buildShopMenu, findMenuEntry, QUICK_LINK_HANDLES } from "@/lib/shop-taxonomy"
import { getShopLifestyle } from "@/lib/shop-lifestyle"
import { applyBrandMetadata, BRAND_TEASERS, SHOP_BRAND_LOGOS } from "@/lib/shop-brands"
import { getNewsPublic } from "@/lib/public-site-data"
import { guessNewsKind } from "@/lib/news-kind"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"
import { getContentTranslations, translateProducts } from "@/lib/content-translations"

export const revalidate = 300

type ShopHomeProps = {
  params: Promise<{ locale: string }>
}


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Sklep — części, akcesoria i elektronika',
    description: 'Części i akcesoria do łodzi, silniki zaburtowe, elektronika Garmin i Lowrance, oleje i chemia. Wysyłka w 24 h, odbiór osobisty w Gdyni.',
    alternates: localeAlternates(locale, "/sklep"),
  }
}

export default async function ShopHomePage({ params }: ShopHomeProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const [categories, newest, pool, lifestyle, news, searchItems] = await Promise.all([
    getShopCategories(),
    getShopProducts({ limit: 12, order: "-created_at" }),
    // **Cały katalog**, nie sto najnowszych: wyróżniony produkt bywa starym
    // produktem, a przy stu ostatnich w ogóle by się nie pokazał. Strona ma
    // ISR co 5 minut, więc te cztery strony pobierają się raz na pięć minut.
    getAllShopProducts(),
    getShopLifestyle(),
    getNewsPublic(8),
    getSearchIndex(),
  ])

  // Produkty do zajawek bierzemy z kategorii marki, nie z nazwy — plotery
  // Garmina nazywają się „GPSMAP 923xsv", więc szukanie słowa „garmin"
  // w tytule gubiło całą markę.
  const brandPools = await Promise.all(
    BRAND_TEASERS.map((brand) => {
      const category = categories.find((item) => item.handle === brand.categoryHandle)
      if (category) return getShopProducts({ limit: 12, categoryId: category.id })
      return getShopProducts({ limit: 24, query: brand.match })
    })
  )

  // Kategorie z Medusy są płaskie — na stronie pokazujemy działy z `shop-taxonomy`.
  const menu = buildShopMenu(categories)

  // Tłumaczenia treści z paneli — nazwy produktów, kategorii i aktualności.
  const tresc = await getContentTranslations(current)

  // Ręcznie wyróżnione, po kolejności z panelu; bez zaznaczeń wraca stara
  // reguła (najdroższe z dostępnych) — szczegóły w `polecane.ts`.
  const featured: ShopProduct[] = translateProducts(tresc, wybraneProdukty(pool))

  // Zajawki marek — po nazwie produktu, bo Medusa nie ma pola „marka”.
  const brandTeasers = BRAND_TEASERS.map((brand, index) => {
    const category = categories.find((item) => item.handle === brand.categoryHandle)
    const hasCategory = Boolean(category)
    const items = brandPools[index]?.products || []

    return {
      // Treść zajawki nadpisują metadane kategorii z panelu Medusy.
      brand: applyBrandMetadata(brand, category?.metadata),
      products: translateProducts(
        tresc,
        items
          // Bez kategorii zostaje szukanie po nazwie — wyszukiwarka Medusy
          // zagląda też w opisy, więc trafienia trzeba zawęzić do tytułu.
          .filter((product) => hasCategory || product.title.toLowerCase().includes(brand.match))
          .filter((product) => product.thumbnail)
          .slice(0, 8)
      ),
    }
  }).filter((teaser) => teaser.products.length >= 3)

  // Szybkie wejścia: najbogatsze pozycje z taksonomii, spłaszczone do jednego rzędu.
  const quickLinks = QUICK_LINK_HANDLES.map((handle) => {
    const entry = findMenuEntry(menu, handle)
    if (!entry) return null

    return {
      label: entry.label,
      href: href(`/sklep/kategoria/${handle}`),
      count: entry.productCount,
    }
  }).filter((item): item is { label: string; href: string; count: number } => Boolean(item))

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />

      {/* HERO — kadr z wody na pełny ekran, na nim krótka obietnica.
          Wzorem leferment.pl nagłówek jest hasłem, nie akapitem; opis zszedł
          niżej, do wstępu działów. */}
      <section className="relative">
        <div className="relative h-[72vh] min-h-[480px] w-full md:h-[80vh]">
          {lifestyle[0]?.image ? (
            <img
              src={lifestyle[0].image}
              alt={lifestyle[0].name || t.shopTitle}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[#0E1A2B]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A2B]/90 via-[#0E1A2B]/45 to-[#0E1A2B]/5" />

          <div className={`${shop.container} absolute inset-x-0 bottom-0 pb-12 md:pb-20`}>
            {/* Jaśniejsza niż `eyebrowLight` — na zdjęciu z jasnym niebem
                45% bieli po prostu ginęło. */}
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/75">
              {t.shopStatsEyebrow}
            </p>

            <h1
              className={`${shop.display} mt-5 max-w-4xl text-[2.5rem] text-white md:text-[4.25rem]`}
            >
              {t.shopHeroTitle}
            </h1>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={href("/sklep/produkty")} className={shop.btnOnDark}>
                {t.shopHeroCta}
              </a>
              <a href={href("/kontakt")} className={shop.btnLight}>
                {t.shopHeroSecondary}
              </a>
            </div>
          </div>
        </div>

        {/* Pasek obietnic tuż pod kadrem — wzorem pak-in.pl, gdzie konkret
            („Gwarancja 3 lata · Darmowa dostawa") stoi nad produktami. */}
        <div className="border-b border-[#0E1A2B]/10 bg-white">
          <ul
            className={`${shop.container} flex flex-wrap items-center justify-center gap-x-10 gap-y-2 py-5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/50`}
          >
            <li>{t.shopTrust1}</li>
            <li aria-hidden className="text-[#0E1A2B]/20">·</li>
            <li>{t.shopTrust2}</li>
            <li aria-hidden className="text-[#0E1A2B]/20">·</li>
            <li>{t.shopTrust3}</li>
          </ul>
        </div>
      </section>

      <ShopQuickLinks items={quickLinks} locale={current} searchItems={searchItems} />

      {/* Produkty od razu pod kadrem — tak robią pak-in.pl i flextail.com;
          wcześniej pierwszy produkt pojawiał się dopiero na trzecim ekranie. */}
      <CartProvider>
        <CartFlyout locale={current} />
        {featured.length ? (
          <ShopSection
            banded
            eyebrow={t.shopTitle}
            title={t.shopFeatured}
            linkLabel={t.shopBrowseAll}
            linkHref={href("/sklep/produkty")}
          >
            <ProductRail products={featured} locale={current} />
          </ShopSection>
        ) : null}

        {/* Nowości zaraz pod „Wybranymi produktami". Stały wcześniej na samym
            dole, za markami, działami i blokiem redakcyjnym — czyli tam, gdzie
            nikt nie dochodzi, choć to jest jedyna sekcja odpowiadająca na
            pytanie „co u was nowego". */}
        {newest.products.length ? (
          <ShopSection
            title={t.shopNewest}
            linkLabel={t.shopBrowseAll}
            linkHref={href("/sklep/produkty")}
          >
            <ProductRail
              products={translateProducts(tresc, newest.products.slice(0, 12))}
              locale={current}
            />
          </ShopSection>
        ) : null}

        {/* Zajawki marek — jak na garmin.com każda marka dostaje własny kadr,
            hasło i szynę produktów, zamiast tonąć we wspólnej liście. */}
        {brandTeasers.map((teaser, index) => (
          <BrandTeaser
            key={teaser.brand.name}
            brand={teaser.brand}
            products={teaser.products}
            locale={current}
            fallbackImage={lifestyle[index + 3]?.image || lifestyle[0]?.image}
            reverse={index % 2 === 1}
          />
        ))}

        {/* DZIAŁY — te same proporcje kadru i ta sama siatka co produkty. */}
        {menu.length ? (
          <ShopSection
            eyebrow={t.shopCollections}
            title={t.shopCategories}
            lead={t.shopHeroLead}
            linkLabel={t.shopBrowseAll}
            linkHref={href("/sklep/produkty")}
          >
            <div className={shop.grid}>
              {menu.map((group) => {
                return (
                  <a
                    key={group.handle}
                    href={href(`/sklep/kategoria/${group.handle}`)}
                    className="group flex flex-col"
                  >
                    {/* Ikona zamiast zdjęcia pierwszego produktu — „Serwis"
                        wyglądał wcześniej jak filtr oleju, a „Części" jak
                        przypadkowa śruba. */}
                    <div
                      className={`${shop.tile} bg-sand-dots p-10 transition duration-500 group-hover:shadow-[0_36px_70px_-50px_rgba(14,26,43,0.7)]`}
                    >
                      <CategoryIcon
                        handle={group.handle}
                        className="h-20 w-20 text-[#0E1A2B]/70 transition duration-500 group-hover:scale-[1.06] group-hover:text-[#2E64A8] sm:h-24 sm:w-24"
                      />
                    </div>

                    <div className="mt-5 border-t border-[#0E1A2B]/10 pt-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
                        {group.productCount} {t.shopProducts}
                      </p>

                      <h3
                        className={`${shop.display} mt-2.5 text-2xl transition group-hover:text-[#2E64A8]`}
                      >
                        {group.label}
                      </h3>

                      {group.children.length ? (
                        <p className="mt-3 line-clamp-2 min-h-[3rem] text-sm leading-6 text-[#0E1A2B]/45">
                          {group.children.map((child) => child.label).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </a>
                )
              })}
            </div>
          </ShopSection>
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

      </CartProvider>

      {/* MARKI — logotypy bez ramek, żeby nie konkurowały z kafelkami */}
      <section className="border-y border-[#0E1A2B]/10 bg-white">
        <div className={`${shop.container} py-14 md:py-16`}>
          <p className={shop.eyebrow}>{t.shopBrandsTitle}</p>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[#0E1A2B]/55">
            {t.shopBrandsLead}
          </p>

          <div className="mt-9 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {SHOP_BRAND_LOGOS.map((brand) => (
              <a
                key={brand.name}
                href={href(`/sklep/produkty?marki=${encodeURIComponent(brand.name)}`)}
                aria-label={brand.name}
                className="group flex h-20 items-center justify-center"
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-7 w-auto max-w-full object-contain opacity-55 transition group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* PORADY — 16 wpisów z Directusa było widocznych tylko poza sklepem */}
      {news.length ? (
        <ShopSection
          banded
          eyebrow={t.shopJournalEyebrow}
          title={t.shopJournalTitle}
          linkLabel={t.shopJournalCta}
          linkHref={href("/aktualnosci")}
        >
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {news.map((item) => {
              const kind = guessNewsKind(item)

              return (
                <div key={item.id} className="group flex flex-col">
                  <a href={href(`/aktualnosci/${item.slug}`)} className="flex flex-col">
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#F4F1EC]">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                        />
                      ) : null}

                      {/* Flaga rodzaju wpisu — news, test, szkolenie… */}
                      <span
                        className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${kind.className}`}
                      >
                        {kind.label}
                      </span>
                    </div>

                    <h3
                      className={`${shop.display} mt-5 text-xl transition group-hover:text-[#2E64A8]`}
                    >
                      {item.title}
                    </h3>

                    {item.excerpt ? (
                      <p className="mt-2.5 line-clamp-3 text-sm leading-6 text-[#0E1A2B]/55">
                        {item.excerpt.replace(/<[^>]+>/g, "").slice(0, 160)}
                      </p>
                    ) : null}
                  </a>
                </div>
              )
            })}
          </div>
        </ShopSection>
      ) : null}

      {/* Marinero od 2004 — tuż nad trzema powodami zakupu */}
      <ShopStats locale={current} productCount={pool.length} categoryCount={menu.length} />

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
