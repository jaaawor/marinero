import Header from "@/components/Header"
import Footer from "@/components/Footer"
import Checkout from "@/components/shop/Checkout"
import ShopNav from "@/components/shop/ShopNav"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopCheckoutHeader,
  ShopContactBand,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const categories = await getShopCategories()

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} variant="shop" />
      <ShopNav locale={current} categories={categories} />
      <ShopCheckoutHeader locale={current} step={2} />

      <section className={`${shop.container} py-12 md:py-16`}>
        <CartProvider>
          <Checkout locale={current} />
        </CartProvider>
      </section>

      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
