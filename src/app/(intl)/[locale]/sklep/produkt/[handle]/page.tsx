import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import AddToCart from "@/components/shop/AddToCart"
import LightboxGallery from "@/components/LightboxGallery"
import { CartProvider } from "@/components/shop/CartProvider"
import { notFound } from "next/navigation"
import { formatPrice, getShopProduct, getShopProducts } from "@/lib/medusa"
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
  const related = categoryId
    ? (await getShopProducts({ limit: 5, categoryId })).products
        .filter((item) => item.id !== product.id)
        .slice(0, 4)
    : []

  const gallery = product.images.map((image) => image.url)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <CartProvider>
        <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[#111827]/45">
            <a href={href("/sklep")} className="font-semibold transition hover:text-[#2E64A8]">
              {t.shopTitle}
            </a>
            {product.categories[0] ? (
              <>
                <span>/</span>
                <a
                  href={href(`/sklep/kategoria/${product.categories[0].handle}`)}
                  className="font-semibold transition hover:text-[#2E64A8]"
                >
                  {product.categories[0].name}
                </a>
              </>
            ) : null}
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-lg bg-white p-5 shadow-sm md:p-6">
              {gallery.length ? (
                <LightboxGallery images={gallery} alt={product.title} />
              ) : (
                <div className="flex h-80 items-center justify-center rounded-lg bg-[#f6f5f2] text-[#111827]/30">
                  —
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm md:p-8">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight">
                {product.title}
              </h1>

              {product.subtitle ? (
                <p className="mt-3 text-base text-[#111827]/55">{product.subtitle}</p>
              ) : null}

              <p className="mt-6 text-3xl font-bold text-[#2E64A8]">
                {formatPrice(product.price)}
              </p>

              <AddToCart variants={product.variants} locale={current} />

              {product.description ? (
                <div className="mt-8 border-t border-[#111827]/10 pt-6">
                  <h2 className="mb-3 text-lg font-semibold">{t.descriptionTitle}</h2>
                  <p className="whitespace-pre-line text-sm leading-7 text-[#111827]/65">
                    {product.description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </CartProvider>

      {related.length ? (
        <section className="mx-auto max-w-[1500px] px-5 pb-16 md:px-8">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight md:text-3xl">
            {product.categories[0]?.name}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} locale={current} />
            ))}
          </div>
        </section>
      ) : null}

      <Footer locale={current} />
    </main>
  )
}
