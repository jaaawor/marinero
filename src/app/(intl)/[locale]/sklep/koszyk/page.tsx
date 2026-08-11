import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CartView from "@/components/shop/CartView"
import { CartProvider } from "@/components/shop/CartProvider"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

type Props = { params: Promise<{ locale: string }> }

export default async function CartPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight md:text-4xl">{t.shopCart}</h1>

        <CartProvider>
          <CartView locale={current} />
        </CartProvider>
      </section>

      <Footer locale={current} />
    </main>
  )
}
