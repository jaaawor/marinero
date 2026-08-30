import { redirect } from "next/navigation"
import Footer from "@/components/Footer"
import ShopHeader from "@/components/shop/ShopHeader"
import KontoFormularz from "@/components/shop/KontoFormularz"
import { ShopAnnouncement, ShopPageHeader, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { zalogowanyKlient } from "@/lib/klient"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string }> }

export default async function RejestracjaPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)

  if (await zalogowanyKlient()) redirect(localeHref(current, "/sklep/konto"))

  const categories = await getShopCategories()

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />
      <ShopPageHeader
        locale={current}
        title="Załóż konto"
        lead="Zamówienia w jednym miejscu i dane wpisane raz. Zakupy bez konta działają tak samo jak dotąd."
      />

      <section className={`${shop.container} py-12 md:py-16`}>
        <KontoFormularz tryb="rejestracja" />
      </section>

      <ShopTrust locale={current} />
      <Footer locale={current} />
    </main>
  )
}
