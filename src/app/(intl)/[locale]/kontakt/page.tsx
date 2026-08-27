import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ContactBand from "@/components/ContactBand"
import ContactForm from "@/components/ContactForm"
import { getFooterData } from "@/lib/directus"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params
  return {
    title: "Kontakt i serwis",
    description:
      "Telefony i adresy e-mail do zespołu Marinero — sprzedaż łodzi, sklep i autoryzowany serwis silników zaburtowych w Gdyni.",
    alternates: localeAlternates(locale, "/kontakt"),
  }
}


export default async function KontaktPage({ params }: PageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)
  const { settings } = await getFooterData()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <div className="mb-10 rounded-lg bg-white p-8 shadow-sm md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            {t.contactPageEyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {t.contactPageTitle}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
            {t.contactPageLead}
          </p>
        </div>

        <div className="mb-4" id="formularz">
          <ContactForm locale={current} />
        </div>

        {/* Ten sam baner co w stopce: Facebook, mapa i telefony do ludzi. */}
        <ContactBand settings={settings} locale={current} />

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{t.contactSalesTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              {t.contactSalesLead}
            </p>
            <a
              className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
              href="mailto:biuro@marinero.pl"
            >
              biuro@marinero.pl
            </a>
          </div>

          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{t.contactShopTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              {t.contactShopLead}
            </p>
            <a
              className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
              href={href("/sklep")}
            >
              {t.contactShopLink} →
            </a>
          </div>
        </div>

        <div
          id="serwis"
          className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            {t.contactServiceEyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t.contactServiceTitle}
          </h2>

          <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Zakres serwisu ze słownika — „tytuł|opis" w jednym wpisie,
                żeby nie mnożyć kluczy na każdą linijkę osobno. */}
            {t.contactServiceItems.map((entry) => {
              const [title, text] = entry.split("|")
              return (
                <div key={title}>
                  <p className="font-semibold leading-6">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#111827]/55">{text}</p>
                </div>
              )
            })}
          </div>

          <p className="mt-7 max-w-3xl text-sm leading-7 text-[#111827]/60">
            {t.contactServiceNote}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-5">
            <a
              className="inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F]"
              href="#formularz"
            >
              {t.contactTabService}
            </a>

            <a
              className="text-sm font-semibold text-[#2E64A8]"
              href="mailto:serwis@marinero.pl"
            >
              serwis@marinero.pl
            </a>
          </div>
        </div>
      </section>

      {/* Baner z mapą i kontaktami stoi wyżej na tej stronie — w stopce
          byłby drugi raz, jeden pod drugim. */}
      <Footer locale={current} settings={settings} hideContactBand />
    </main>
  )
}
