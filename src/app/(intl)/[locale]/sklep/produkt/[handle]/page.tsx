import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import AddToCart from "@/components/shop/AddToCart"
import QuickAdd from "@/components/shop/QuickAdd"
import StickyBuyBar from "@/components/shop/StickyBuyBar"
import ProductGallery from "@/components/shop/ProductGallery"
import FamilyPicker from "@/components/shop/FamilyPicker"
import ShopHeader from "@/components/shop/ShopHeader"
import { CartProvider } from "@/components/shop/CartProvider"
import CartFlyout from "@/components/shop/CartFlyout"
import { ShopAnnouncement, ShopContactBand, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { notFound } from "next/navigation"
import { getAllShopProducts, getShopCategories, getShopProduct, getShopProducts } from "@/lib/medusa"
import { buildFamilySelectors, parseProduct } from "@/lib/product-family"
import { formatDescription, isHeading } from "@/lib/product-description"
import { availabilityDotClass, getAvailability } from "@/lib/availability"
import { formatDeliveryDay, getDeliveryEstimate } from "@/lib/delivery"
import { getMapCompatibility } from "@/lib/map-compatibility"
import { findCompatible } from "@/lib/compatibility"
import { addonHandles, findEngineAddons } from "@/lib/engine-addons"
import { getSiteSettings } from "@/lib/directus"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { getContentTranslations, translate } from "@/lib/content-translations"
import {
  breadcrumbJsonLd,
  clampDescription,
  jsonLdProps,
  localeAlternates,
  productJsonLd,
} from "@/lib/seo"

export const revalidate = 300

type ProductPageProps = {
  params: Promise<{ locale: string; handle: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { locale, handle } = await params
  const product = await getShopProduct(handle)
  if (!product) return {}

  return {
    title: product.title,
    description: clampDescription(product.subtitle || product.description),
    alternates: localeAlternates(locale, `/sklep/produkt/${handle}`),
    openGraph: {
      type: "website",
      title: product.title,
      description: clampDescription(product.subtitle || product.description),
      ...(product.thumbnail ? { images: [{ url: product.thumbnail, alt: product.title }] } : {}),
    },
  }
}

export default async function ShopProductPage({ params }: ProductPageProps) {
  const { locale, handle } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const product = await getShopProduct(handle)
  if (!product) {
    notFound()
  }

  const categories = await getShopCategories()

  // Rodzeństwa szukamy w najwęższej kategorii produktu („Suzuki", nie „Silniki") —
  // szeroka kategoria nie zmieściłaby się w jednej stronie wyników.
  const countByHandle = new Map(
    categories.map((category) => [category.handle, category.productCount || 0])
  )
  const narrowest = [...product.categories]
    .sort(
      (a, b) => (countByHandle.get(a.handle) ?? 1e9) - (countByHandle.get(b.handle) ?? 1e9)
    )
    .find((category) => (countByHandle.get(category.handle) ?? 0) > 0)

  const sameCategory = narrowest
    ? await getShopProducts({ limit: 100, categoryId: narrowest.id })
    : null

  // Do silnika warto od razu pokazać części serwisowe tej samej marki.
  const brand = ["Suzuki", "Mercury", "Torqeedo", "Garmin", "Quicksilver", "Lowrance"].find(
    (name) => product.title.toLowerCase().includes(name.toLowerCase())
  )

  // „Zaplanuj serwis" ma sens tylko przy silnikach spalinowych i ich osprzęcie.
  // Wcześniej sekcja wchodziła na każdy produkt — przy ploterze Garmina
  // wyświetlała filtry oleju do Suzuki.
  const COMBUSTION_BRANDS = ["Suzuki", "Mercury", "Quicksilver"]
  const serviceBrand = brand && COMBUSTION_BRANDS.includes(brand) ? brand : null
  const serviceFits =
    Boolean(serviceBrand) ||
    (!brand && product.categories.some((category) => /silnik|serwis|olej/i.test(category.handle)))

  const serviceCategory = categories.find((category) => category.handle === "czesci-serwisowe")
  const service =
    serviceCategory && serviceFits
      ? (await getShopProducts({ limit: 100, categoryId: serviceCategory.id })).products
          .filter((item) => item.id !== product.id)
          .filter(
            (item) => !serviceBrand || item.title.toLowerCase().includes(serviceBrand.toLowerCase())
          )
          .slice(0, 4)
      : []

  const pool = (sameCategory?.products || []).filter((item) => item.id !== product.id)

  // Wersje tego samego modelu — kolumna, sterowanie, kolor, przekątna ekranu
  const selectors = buildFamilySelectors(product, [product, ...pool])
  const parsed = parseProduct(product.title)

  const family = parsed
    ? pool.filter((item) => parseProduct(item.title)?.family === parsed.family)
    : []

  const related = pool.filter((item) => !family.includes(item)).slice(0, 4)
  const gallery = product.images.map((image) => image.url)

  // Tłumaczenia treści z panelu. Robimy to **po** rozpoznaniu rodziny, mocy
  // i dostępności — te liczą się z polskiego tytułu (patrz `titleDisplay`).
  const tresc = await getContentTranslations(current)
  const nazwa = translate(tresc, product.title)
  const described = formatDescription(translate(tresc, product.description))

  // Dostępność ustawia sprzedawca w panelu Medusy (metadane produktu).
  const availability = getAvailability(product.metadata, product.title)

  // Termin liczony przy odświeżeniu ISR (co 5 minut), więc data jest aktualna.
  const delivery = getDeliveryEstimate(availability.code)

  // Przy mapach kluczowe jest, w jakim sprzęcie karta w ogóle zadziała.
  const maps = getMapCompatibility(
    product.title,
    product.metadata,
    product.categories.map((category) => category.handle)
  )

  // „Dokup do silnika" — śruba i zestaw instalacyjny, jak na starym sklepie.
  // Idą przed „Pasuje do", bo to decyzja podejmowana przy zakupie silnika,
  // a nie luźna podpowiedź. Z ogólnych dopasowań je wycinamy, żeby ta sama
  // śruba nie wyszła dwa razy na jednej stronie.
  const catalogue = await getAllShopProducts()
  const addons = findEngineAddons(product, catalogue)
  const wDokupieniu = addonHandles(addons)

  // „Pasuje do" — dopasowania liczone z całego katalogu.
  const compatibility = findCompatible(product, catalogue)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !wDokupieniu.has(item.handle)),
    }))
    .filter((group) => group.items.length)

  // Tekst gwarancji edytuje sprzedawca w Directusie (`site_settings.shop_warranty`);
  // słownik zostaje jako wartość zapasowa i wersja obcojęzyczna.
  const settings = await getSiteSettings()

  const highlights = [
    { label: t.shopDelivery, value: t.shopShippingFast },
    { label: t.shopWarranty, value: settings?.shop_warranty || t.shopWarrantyValue },
  ]

  // Dane strukturalne produktu — cena w sklepie jest brutto w złotych,
  // więc tu (w odróżnieniu od łodzi) `offers` można podać uczciwie.
  const stockState =
    availability.code === "niedostepny"
      ? "OutOfStock"
      : availability.code === "na-zamowienie"
        ? "PreOrder"
        : "InStock"

  return (
    <main className={shop.page}>
      <script
        {...jsonLdProps([
          productJsonLd({
            name: product.title,
            description: clampDescription(product.subtitle || product.description, 400),
            image: gallery.slice(0, 4),
            sku: product.variants[0]?.sku,
            gtin: typeof product.metadata?.ean === "string" ? product.metadata.ean : undefined,
            url: href(`/sklep/produkt/${product.handle}`),
            price: product.price,
            currency: "PLN",
            availability: stockState,
          }),
          breadcrumbJsonLd([
            { name: t.navShop, path: href("/sklep") },
            ...(product.categories[0]
              ? [
                  {
                    name: product.categories[0].name,
                    path: href(`/sklep/kategoria/${product.categories[0].handle}`),
                  },
                ]
              : []),
            { name: product.title, path: href(`/sklep/produkt/${product.handle}`) },
          ]),
        ])}
      />

      <ShopAnnouncement locale={current} />
      <ShopHeader
        locale={current}
        categories={categories}
        activeHandle={product.categories[0]?.handle}
      />

      <CartProvider>
        <CartFlyout locale={current} />
        {/* Cała góra strony produktu na bieli — zdjęcia są pakshotami
            na białym tle i nie mogą leżeć na piaskowym polu. */}
        <section className="border-b border-[#0E1A2B]/10 bg-white">
          <div className={`${shop.container} py-7 md:py-10`}>
            <div className="mb-7 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
              <a href={href("/sklep")} className="transition hover:text-[#2E64A8]">
                {t.shopTitle}
              </a>
              {product.categories[0] ? (
                <>
                  <span>/</span>
                  <a
                    href={href(`/sklep/kategoria/${product.categories[0].handle}`)}
                    className="transition hover:text-[#2E64A8]"
                  >
                    {product.categories[0].name}
                  </a>
                </>
              ) : null}
            </div>

            {/* Na telefonie kolejność to zdjęcia → zakup → opis; wcześniej
                przycisk zakupu wypadał dopiero pod tabelą specyfikacji,
                czyli kilka ekranów niżej. */}
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
              <div className="order-1 lg:col-start-1 lg:row-start-1">
                <ProductGallery images={gallery} alt={nazwa} />
              </div>

              <div className="order-3 space-y-10 lg:col-start-1 lg:row-start-2">

                {described.intro.length ? (
                  <div className="border-t border-[#0E1A2B]/10 pt-10">
                    <p className={shop.eyebrow}>{t.shopDescriptionTitle}</p>
                    <div className="mt-6 max-w-2xl space-y-4 text-base leading-8 text-[#0E1A2B]/70">
                      {/* Nagłówki sekcji producent pisze wersalikami — u nas
                          dostają własny wiersz i wagę, zamiast kleić się
                          z pierwszym zdaniem akapitu. */}
                      {described.intro.map((paragraph, index) =>
                        isHeading(paragraph) ? (
                          <p
                            key={index}
                            className="pt-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#0E1A2B]"
                          >
                            {paragraph}
                          </p>
                        ) : (
                          <p key={index}>{paragraph}</p>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                {described.specs.length ? (
                  <div className="border-t border-[#0E1A2B]/10 pt-10">
                    <p className={shop.eyebrow}>{t.shopSpecsTitle}</p>

                    <dl className="mt-6 divide-y divide-[#0E1A2B]/8 border-y border-[#0E1A2B]/8">
                      {described.specs.map((spec, index) => (
                        <div
                          key={`${spec.label}-${index}`}
                          className="grid gap-1 py-3.5 sm:grid-cols-[260px_minmax(0,1fr)] sm:gap-6"
                        >
                          <dt className="text-sm text-[#0E1A2B]/45">{spec.label}</dt>
                          <dd className="text-sm text-[#0E1A2B]/80">{spec.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </div>

              {/* Kolumna zakupu */}
              <div className="order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
                {product.categories[0] ? (
                  <p className={shop.eyebrow}>{product.categories[0].name}</p>
                ) : null}

                <h1 className={`${shop.display} mt-4 text-3xl md:text-4xl`}>{nazwa}</h1>

                {/* Dostępność — pierwsza rzecz, o którą pyta kupujący */}
                <p className="mt-5 flex flex-wrap items-center gap-2.5 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${availabilityDotClass(
                      availability.tone
                    )}`}
                  />
                  <span className="font-medium text-[#0E1A2B]">{availability.label}</span>
                  {availability.quantity > 0 ? (
                    <span className="text-[#0E1A2B]/45">
                      · {t.shopInStockCount.replace("{n}", String(availability.quantity))}
                    </span>
                  ) : null}
                </p>

                {/* Konkretna data zamiast „2–3 dni" — to najmocniejszy element
                    karty produktu na x-kom.pl. Terminy pomijają weekendy i święta. */}
                {delivery ? (
                  <dl className="mt-5 space-y-2 border-l-2 border-[#2E64A8]/25 pl-4 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-[#0E1A2B]/45">{t.shopDispatch}:</dt>
                      <dd className="font-semibold text-[#0E1A2B]">
                        {formatDeliveryDay(delivery.dispatch, delivery.dispatchOffset, current, {
                          today: t.shopToday,
                          tomorrow: t.shopTomorrow,
                        })}
                      </dd>
                      {delivery.hoursLeft && delivery.hoursLeft > 0 ? (
                        <dd className="text-[#2E64A8]">
                          ({t.shopOrderWithin.replace("{h}", String(delivery.hoursLeft))})
                        </dd>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-[#0E1A2B]/45">{t.shopDeliveryEstimate}:</dt>
                      <dd className="font-semibold text-[#0E1A2B]">
                        {formatDeliveryDay(delivery.delivery, delivery.deliveryOffset, current, {
                          today: t.shopToday,
                          tomorrow: t.shopTomorrow,
                        })}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {maps ? (
                  <div className="mt-5 border border-[#2E64A8]/25 bg-[#2E64A8]/5 px-4 py-3.5 text-sm">
                    <p className="font-semibold text-[#0E1A2B]">
                      {t.shopMapCompatibility}: {maps.label}
                    </p>
                    <p className="mt-1.5 leading-6 text-[#0E1A2B]/60">{maps.detail}</p>
                    <p className="mt-2 text-[12px] text-[#0E1A2B]/45">
                      {t.shopMapWorksWith}: {maps.brands.join(" · ")}
                    </p>
                  </div>
                ) : null}

                {/* Skrót cech z nazwy modelu — od razu wiadomo, co to za wersja */}
                {parsed?.traits.length ? (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {parsed.traits
                      // sam kod generacji („A") nic klientowi nie mówi
                      .filter((item) => item.display !== item.value || item.key !== "wersja")
                      .map((item) => (
                        <li
                          key={item.key}
                          className="rounded-sm bg-[#F4F1EC] px-3 py-1.5 text-[12px] text-[#0E1A2B]/65"
                        >
                          {item.display}
                        </li>
                      ))}
                  </ul>
                ) : null}

                {/* Wszystkie wybory w jednym bloku, przycisk zakupu na końcu.
                    `id` obserwuje przyklejony pasek zakupu — pilnujemy samego
                    przycisku, nie całej kolumny, bo ta na telefonie ciągnie się
                    przez kilka ekranów. */}
                <div id="zakup" className="scroll-mt-28">
                  <AddToCart variants={product.variants} price={product.price} locale={current}>
                    <FamilyPicker selectors={selectors} locale={current} />
                  </AddToCart>
                </div>

                <dl className="mt-10 divide-y divide-[#0E1A2B]/10 border-y border-[#0E1A2B]/10 text-sm">
                  {highlights.map((item) => (
                    <div key={item.label} className="flex gap-4 py-4">
                      <dt className="w-40 shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/35">
                        {item.label}
                      </dt>
                      <dd className="text-[#0E1A2B]/70">{item.value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-6 text-sm leading-7 text-[#0E1A2B]/50">{t.shopTrust3Lead}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pozostałe wersje tego modelu */}
        {family.length ? (
          <section className="border-b border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-14 md:py-16`}>
              <p className={shop.eyebrow}>{t.shopFamilyEyebrow}</p>
              <h2 className={`${shop.display} mt-4 text-2xl md:text-3xl`}>{t.shopFamilyTitle}</h2>

              <div className={`mt-9 ${shop.grid}`}>
                {family.slice(0, 4).map((item) => (
                  <ProductCard key={item.id} product={item} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* DOKUP DO SILNIKA — śruba napędowa i zestaw instalacyjny.
            Na starym sklepie były to pola dodatkowe przy silniku; u nas
            produkty są osobnymi wpisami, więc dokłada się je do koszyka
            jako własne pozycje. */}
        {addons.length ? (
          <section className="border-b border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-14 md:py-16`}>
              <p className={shop.eyebrow}>{t.shopAddonsEyebrow}</p>
              <h2 className={`${shop.display} mt-4 text-2xl md:text-3xl`}>{t.shopAddonsTitle}</h2>

              {addons.map((group) => (
                <div key={group.key} className="mt-10 first:mt-9">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0E1A2B]/70">
                    {group.key === "propeller" ? t.shopAddonsPropeller : t.shopAddonsInstallation}
                  </h3>

                  <div className={`mt-5 ${shop.grid}`}>
                    {group.items.map((item) => (
                      <ProductCard key={item.id} product={item} locale={current} quickAdd />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* PASUJE DO — dopasowania z nazw (zakresy mocy, rodziny Torqeedo)
            albo z ręcznych powiązań w metadanych produktu. */}
        {compatibility.map((group) => (
          <section key={group.label} className="border-b border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-12 md:py-14`}>
              <p className={shop.eyebrow}>{t.shopFitsWith}</p>
              <h2 className={`${shop.display} mt-4 text-2xl md:text-3xl`}>{group.label}</h2>
              <p className="mt-3 text-sm text-[#0E1A2B]/50">{group.reason}</p>

              <div className={`mt-9 ${shop.grid}`}>
                {group.items.map((item) => (
                  <ProductCard key={item.id} product={item} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ))}

        {service.length ? (
          <section className="border-b border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-14 md:py-16`}>
              <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className={shop.eyebrow}>{t.shopServiceEyebrow}</p>
                  <h2 className={`${shop.display} mt-4 text-2xl md:text-3xl`}>
                    {t.shopServiceTitle}
                  </h2>
                </div>

                <a href={href("/sklep/kategoria/czesci-serwisowe")} className={shop.link}>
                  {t.shopViewCategory} →
                </a>
              </div>

              <div className={shop.grid}>
                {service.map((item) => (
                  <ProductCard key={item.id} product={item} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {related.length ? (
          <section className="border-b border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-14 md:py-16`}>
              <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
                <h2 className={`${shop.display} text-2xl md:text-3xl`}>
                  {product.categories[0]?.name}
                </h2>
                <a
                  href={href(`/sklep/kategoria/${product.categories[0]?.handle || ""}`)}
                  className={shop.link}
                >
                  {t.shopViewCategory} →
                </a>
              </div>

              <div className={shop.grid}>
                {related.map((item) => (
                  <ProductCard key={item.id} product={item} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      {/* Pasek zakupu przyklejony do dołu — po opisie i tabeli specyfikacji
          przycisk zakupu zostawał kilka ekranów wyżej. Przy jednym wariancie
          dodaje od razu, przy kilku odsyła do wyboru wersji, żeby nie wrzucać
          do koszyka czegoś, czego klient nie wybrał. */}
      <StickyBuyBar
        watchId="zakup"
        title={product.title}
        price={product.price}
        image={product.thumbnail || undefined}
        note={
          delivery
            ? `${t.shopDispatch}: ${formatDeliveryDay(
                delivery.dispatch,
                delivery.dispatchOffset,
                current,
                { today: t.shopToday, tomorrow: t.shopTomorrow }
              )}`
            : availability.short
        }
      >
        {product.variants.length === 1 && product.variants[0]?.id ? (
          <QuickAdd variantId={product.variants[0].id} locale={current} />
        ) : (
          <a
            href="#zakup"
            className="flex w-full items-center justify-center rounded-sm bg-[#0E1A2B] px-5 py-3 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8]"
          >
            {t.shopChooseVersion}
          </a>
        )}
      </StickyBuyBar>
      </CartProvider>


      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
