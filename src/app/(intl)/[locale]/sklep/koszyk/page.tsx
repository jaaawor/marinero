import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CartView from "@/components/shop/CartView"
import ShopNav from "@/components/shop/ShopNav"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopCheckoutHeader,
  ShopContactBand,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export default async function CartPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const categories = await getShopCategories()

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} variant="shop" />
      <ShopNav locale={current} categories={categories} />
      <ShopCheckoutHeader locale={current} step={1} />

      <section className={`${shop.container} py-12 md:py-16`}>
        <CartProvider>
          <CartView locale={current} />
        </CartProvider>
      </section>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
