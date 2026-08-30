import Footer from "@/components/Footer"
import Checkout from "@/components/shop/Checkout"
import ShopHeader from "@/components/shop/ShopHeader"
import { CartProvider } from "@/components/shop/CartProvider"
import { ShopAnnouncement, ShopCheckoutHeader } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { getSiteSettings } from "@/lib/directus"
import { normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const categories = await getShopCategories()
  const settings = await getSiteSettings()

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />
      <ShopCheckoutHeader locale={current} step={2} />

      <section className={`${shop.container} py-12 md:py-16`}>
        <CartProvider>
          <Checkout locale={current} konwersjaAds={settings?.google_ads_conversion || ""} />
        </CartProvider>
      </section>

      {/* Bez banera „Doradztwo serwisu" — jego przycisk „Skontaktuj się
          z serwisem" wyglądał tak samo jak „Złóż zamówienie" i ludzie klikali
          w niego zamiast kupować. Na stronie zamówienia ma być jedno wyjście. */}
      <Footer locale={current} />
    </main>
  )
}
