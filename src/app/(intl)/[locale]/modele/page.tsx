import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelFinder from "@/components/ModelFinder"
import { getBoatModelsPublic } from "@/lib/public-site-data"
import { getDictionary, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type ModelsPageProps = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    brand?: string
    series?: string
  }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Wszystkie modele łodzi',
    description: 'Pełna lista modeli łodzi z filtrami po marce i serii — długość, szerokość, liczba kabin i cena bazowa każdego modelu.',
    alternates: localeAlternates(locale, "/modele"),
  }
}

export default async function ModelsPage({ params: routeParams, searchParams }: ModelsPageProps) {
  const { locale } = await routeParams
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const params = await searchParams
  const brandFilter = params?.brand || ""
  const seriesFilter = params?.series || ""

  const models = await getBoatModelsPublic()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            {t.modelsTitle}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">
            {t.modelsLead}
          </p>
        </div>
      </section>

      <ModelFinder
        models={models}
        locale={current}
        brandFilter={brandFilter}
        seriesFilter={seriesFilter}
        basePath="/modele"
      />

      <Footer locale={current} />
    </main>
  )
}
