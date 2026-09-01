import { redirect } from "next/navigation"
import Footer from "@/components/Footer"
import ShopHeader from "@/components/shop/ShopHeader"
import KontoPanel from "@/components/shop/KontoPanel"
import { ShopAnnouncement, ShopPageHeader, ShopTrust } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { zalogowanyKlient, zamowieniaKlienta } from "@/lib/klient"

// Konto zależy od ciasteczka logowania, więc strona nie może być prerenderowana.
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string }> }

export default async function KontoPage({ params }: Props) {
  const { locale } = await params
  const current = normalizeLocale(locale)

  const klient = await zalogowanyKlient()
  if (!klient) redirect(localeHref(current, "/sklep/konto/logowanie"))

  const [categories, zamowienia] = await Promise.all([
    getShopCategories(),
    zamowieniaKlienta(klient.email),
  ])

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />
      <ShopPageHeader
        locale={current}
        title="Moje konto"
        meta={klient.imie ? `Cześć, ${klient.imie}` : undefined}
      />

      <section className={`${shop.container} py-12 md:py-16`}>
        <KontoPanel
          klient={klient}
          zamowienia={zamowienia}
          prefiks={localeHref(current, "/").replace(/\/$/, "")}
        />
      </section>

      <ShopTrust locale={current} />
      <Footer locale={current} />
    </main>
  )
}
