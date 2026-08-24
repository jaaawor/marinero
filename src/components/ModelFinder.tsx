import ModelCard from "@/components/ModelCard"
import {
  getBrandNameFromAny,
  getBrandSlugFromAny,
  getSeriesFromAny,
  getSeriesSlugFromAny,
} from "@/lib/model-taxonomy"
import { getDictionary, localeHref, pluralModels, type Locale } from "@/lib/i18n"

// Wyszukiwarka modeli z filtrami marki i serii plus siatka wyników.
//
// Ten sam blok stoi na `/lodzie` (pod kafelkami marek) i na `/modele`.
// Wcześniej był wpisany na sztywno w stronie `/modele`, więc przeniesienie go
// pod łodzie znaczyłoby duplikat — a duplikat po pierwszej poprawce filtrów
// rozjechałby się z oryginałem.
//
// Filtry działają na linkach (`?brand=`, `?series=`), więc każdy stan ma
// własny adres i całość działa bez JavaScriptu.

type Props = {
  models: any[]
  locale: Locale
  brandFilter?: string
  seriesFilter?: string
  /** Adres, pod który wraca formularz — `/lodzie` albo `/modele`. */
  basePath: string
}

export default function ModelFinder({
  models,
  locale,
  brandFilter = "",
  seriesFilter = "",
  basePath,
}: Props) {
  const t = getDictionary(locale)
  const href = (path: string) => localeHref(locale, path)

  const filtered = models.filter((model: any) => {
    if (brandFilter && getBrandSlugFromAny(model) !== brandFilter) return false
    if (seriesFilter && getSeriesSlugFromAny(model) !== seriesFilter) return false
    return true
  })

  const brands = new Map<string, string>()
  for (const model of models) {
    const slug = getBrandSlugFromAny(model)
    const name = getBrandNameFromAny(model)
    if (slug && name && !brands.has(slug)) brands.set(slug, name)
  }

  // Lista serii zawęża się do wybranej marki — inaczej w rozwijanym menu
  // stoją serie z marek, których i tak nie widać w wynikach.
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
    <>
      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8" id="modele">
        <form
          className="rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm md:p-6"
          action={href(basePath)}
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
              {filtered.length} {pluralModels(locale, filtered.length)} {t.inCatalog}
            </h2>
          </div>

          {brandFilter || seriesFilter ? (
            <a
              href={href(basePath)}
              className="rounded-md border border-[#111827]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
            >
              {t.clearFilter}
            </a>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((model: any) => (
            <ModelCard key={model.slug} model={model} locale={locale} />
          ))}
        </div>
      </section>
    </>
  )
}
