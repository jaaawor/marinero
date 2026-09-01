import { Suspense } from "react"
import Footer from "@/components/Footer"
import ShopHeader from "@/components/shop/ShopHeader"
import NoweHasloFormularz from "@/components/shop/NoweHasloFormularz"
import { ShopAnnouncement, ShopPageHeader, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { normalizeLocale } from "@/lib/i18n"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string }> }

export default async function NoweHasloPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const categories = await getShopCategories()

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />
      <ShopPageHeader locale={current} title="Nowe hasło" />

      <section className={`${shop.container} py-12 md:py-16`}>
        {/* `useSearchParams` wymaga granicy Suspense — bez niej build przewraca
            się na prerenderze całej gałęzi. */}
        <Suspense fallback={null}>
          <NoweHasloFormularz />
        </Suspense>
      </section>

      <ShopTrust locale={current} />
      <Footer locale={current} />
    </main>
  )
}
