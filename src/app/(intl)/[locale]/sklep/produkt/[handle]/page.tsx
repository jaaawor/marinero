import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import AddToCart from "@/components/shop/AddToCart"
import ProductGallery from "@/components/shop/ProductGallery"
import FamilyPicker from "@/components/shop/FamilyPicker"
import ShopHeader from "@/components/shop/ShopHeader"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopContactBand, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { notFound } from "next/navigation"
import { getShopCategories, getShopProduct, getShopProducts } from "@/lib/medusa"
import { buildFamilySelectors, parseProduct } from "@/lib/product-family"
import { formatDescription } from "@/lib/product-description"
import { availabilityDotClass, getAvailability } from "@/lib/availability"
import { formatDeliveryDay, getDeliveryEstimate } from "@/lib/delivery"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type ProductPageProps = {
  params: Promise<{ locale: string; handle: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { handle } = await params
  const product = await getShopProduct(handle)
  if (!product) return {}

  return {
    title: product.title,
    description: product.subtitle || product.description.slice(0, 160),
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

  const serviceCategory = categories.find((category) => category.handle === "czesci-serwisowe")
  const service = serviceCategory
    ? (await getShopProducts({ limit: 100, categoryId: serviceCategory.id })).products
        .filter((item) => item.id !== product.id)
        .filter((item) => !brand || item.title.toLowerCase().includes(brand.toLowerCase()))
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
  const described = formatDescription(product.description)

  // Dostępność ustawia sprzedawca w panelu Medusy (metadane produktu).
  const availability = getAvailability(product.metadata, product.title)

  // Termin liczony przy odświeżeniu ISR (co 5 minut), więc data jest aktualna.
  const delivery = getDeliveryEstimate(availability.code)

  const highlights = [
    { label: t.shopDelivery, value: t.shopShippingFast },
    { label: t.shopWarranty, value: t.shopWarrantyValue },
  ]

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader
        locale={current}
        categories={categories}
        activeHandle={product.categories[0]?.handle}
      />

      <CartProvider>
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

            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
              <div className="space-y-10">
                <ProductGallery images={gallery} alt={product.title} />

                {described.intro.length ? (
                  <div className="border-t border-[#0E1A2B]/10 pt-10">
                    <p className={shop.eyebrow}>{t.shopDescriptionTitle}</p>
                    <div className="mt-6 max-w-2xl space-y-4 text-base leading-8 text-[#0E1A2B]/70">
                      {described.intro.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
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
              <div className="lg:sticky lg:top-24">
                {product.categories[0] ? (
                  <p className={shop.eyebrow}>{product.categories[0].name}</p>
                ) : null}

                <h1 className={`${shop.display} mt-4 text-3xl md:text-4xl`}>{product.title}</h1>

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

                {/* Wszystkie wybory w jednym bloku, przycisk zakupu na końcu */}
                <AddToCart variants={product.variants} price={product.price} locale={current}>
                  <FamilyPicker selectors={selectors} locale={current} />
                </AddToCart>

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

              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
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

              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.id} product={item} locale={current} quickAdd />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </CartProvider>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
