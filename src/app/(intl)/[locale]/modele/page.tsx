import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelCard from "@/components/ModelCard"
import { getBoatModelsPublic } from "@/lib/public-site-data"
import {
  getBrandNameFromAny,
  getBrandSlugFromAny,
  getSeriesFromAny,
  getSeriesSlugFromAny,
} from "@/lib/model-taxonomy"
import { getDictionary, localeHref, normalizeLocale, pluralModels } from "@/lib/i18n"
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
  const href = (path: string) => localeHref(current, path)
  const params = await searchParams
  const brandFilter = params?.brand || ""
  const seriesFilter = params?.series || ""

  const models = await getBoatModelsPublic()

  const filtered = models.filter((model: any) => {
    const brandSlug = getBrandSlugFromAny(model)
    const seriesSlug = getSeriesSlugFromAny(model)

    if (brandFilter && brandSlug !== brandFilter) return false
    if (seriesFilter && seriesSlug !== seriesFilter) return false

    return true
  })

  const brands = new Map<string, string>()
  for (const model of models) {
    const slug = getBrandSlugFromAny(model)
    const name = getBrandNameFromAny(model)
    if (slug && name && !brands.has(slug)) brands.set(slug, name)
  }

  const seriesSource = brandFilter
    ? models.filter((model: any) => getBrandSlugFromAny(model) === brandFilter)
    : models
  const series = new Map<string, string>()
  for (const model of seriesSource) {
    const slug = getSeriesSlugFromAny(model)
    const name = getSeriesFromAny(model)
    if (slug && name && !series.has(slug)) series.set(slug, name)
  }

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

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
        <form
          className="rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm md:p-6"
          action={href("/modele")}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#111827]/40">
                {t.filtersLabel}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">{t.findModel}</h2>
            </div>

            <a
              href={href("/archiwum")}
              className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
            >
              {t.archiveLink}
            </a>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 rounded-md border border-[#111827]/10 p-4">
              <span className="text-xs text-[#111827]/45">{t.fieldBrand}</span>
              <select
                name="brand"
                defaultValue={brandFilter}
                className="bg-transparent text-sm font-semibold outline-none"
              >
                <option value="">{t.allBrandsOption}</option>
                {Array.from(brands.entries()).map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 rounded-md border border-[#111827]/10 p-4">
              <span className="text-xs text-[#111827]/45">{t.fieldSeries}</span>
              <select
                name="series"
                defaultValue={seriesFilter}
                className="bg-transparent text-sm font-semibold outline-none"
              >
                <option value="">{t.allSeriesOption}</option>
                {Array.from(series.entries()).map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="flex items-center justify-center rounded-md bg-[#2E64A8] p-4 text-center font-semibold text-white transition hover:bg-[#28588F]"
            >
              {t.searchButton}
            </button>
          </div>
        </form>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
              {t.resultsLabel}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {filtered.length} {pluralModels(current, filtered.length)} {t.inCatalog}
            </h2>
          </div>

          {brandFilter || seriesFilter ? (
            <a
              href={href("/modele")}
              className="rounded-md border border-[#111827]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
            >
              {t.clearFilter}
            </a>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((model: any) => (
            <ModelCard key={model.slug} model={model} locale={current} />
          ))}
        </div>
      </section>

      <Footer locale={current} />
    </main>
  )
}
