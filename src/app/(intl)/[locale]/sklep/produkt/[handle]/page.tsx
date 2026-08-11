import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import AddToCart from "@/components/shop/AddToCart"
import ProductGallery from "@/components/shop/ProductGallery"
import ShopNav from "@/components/shop/ShopNav"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopContactBand, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { notFound } from "next/navigation"
import { getShopCategories, getShopProduct, getShopProducts } from "@/lib/medusa"
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

  const categoryId = product.categories[0]?.id
  const [categories, relatedResult] = await Promise.all([
    getShopCategories(),
    categoryId ? getShopProducts({ limit: 5, categoryId }) : Promise.resolve(null),
  ])

  const related = (relatedResult?.products || [])
    .filter((item) => item.id !== product.id)
    .slice(0, 4)

  const gallery = product.images.map((image) => image.url)

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} />
      <ShopNav
        locale={current}
        categories={categories}
        activeHandle={product.categories[0]?.handle}
      />

      <CartProvider>
        <section className={`${shop.container} py-8 md:py-12`}>
          <div className="mb-8 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
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

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            {/* Zdjęcia, a pod nimi opis */}
            <div className="space-y-10">
              <ProductGallery images={gallery} alt={product.title} />

              {product.description ? (
                <div className="border-t border-[#0E1A2B]/10 pt-10">
                  <p className={shop.eyebrow}>{t.shopDescriptionTitle}</p>
                  <p className="mt-6 max-w-2xl whitespace-pre-line text-base leading-8 text-[#0E1A2B]/70">
                    {product.description}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Zakup */}
            <div className="lg:sticky lg:top-24">
              {product.categories[0] ? (
                <p className={shop.eyebrow}>{product.categories[0].name}</p>
              ) : null}

              <h1 className={`${shop.display} mt-5 text-3xl md:text-4xl`}>{product.title}</h1>

              <AddToCart
                variants={product.variants}
                price={product.price}
                locale={current}
              />

              <dl className="mt-10 space-y-4 border-t border-[#0E1A2B]/10 pt-8 text-sm">
                <div className="flex gap-4">
                  <dt className="w-32 shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/35">
                    {t.shopDelivery}
                  </dt>
                  <dd className="text-[#0E1A2B]/65">{t.shopTrust2Lead}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-32 shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/35">
                    {t.shopTrust1}
                  </dt>
                  <dd className="text-[#0E1A2B]/65">{t.shopTrust1Lead}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-32 shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/35">
                    {t.shopTrust3}
                  </dt>
                  <dd className="text-[#0E1A2B]/65">{t.shopTrust3Lead}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {related.length ? (
          <section className="border-t border-[#0E1A2B]/10 bg-white">
            <div className={`${shop.container} py-16 md:py-20`}>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                <h2 className={`${shop.display} text-2xl md:text-4xl`}>
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
