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

export default async function LogowaniePage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)

  // Zalogowanego nie ma po co pytać o hasło drugi raz.
  if (await zalogowanyKlient()) redirect(localeHref(current, "/sklep/konto"))

  const categories = await getShopCategories()

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />
      <ShopPageHeader
        locale={current}
        title="Zaloguj się"
        lead="Konto pokazuje historię zamówień i zapamiętuje dane do wysyłki. Do zakupów nie jest potrzebne."
      />

      <section className={`${shop.container} py-12 md:py-16`}>
        <KontoFormularz tryb="logowanie" />
      </section>

      <ShopTrust locale={current} />
      <Footer locale={current} />
    </main>
  )
}
