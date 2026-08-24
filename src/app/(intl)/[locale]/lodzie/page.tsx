import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelFinder from "@/components/ModelFinder"
import { getBoatModelsPublic, getBrandsPublic } from "@/lib/public-site-data"
import { getBrandSlugFromAny, getModelImage } from "@/lib/model-taxonomy"
import { getDictionary, localeHref, normalizeLocale, pluralModels } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type BoatsPageProps = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ brand?: string; series?: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Łodzie motorowe i katamarany',
    description: 'Łodzie motorowe, katamarany i RIB-y w ofercie Marinero: Jeanneau, Nordkapp, Sting, XO Boats i Aquila. Autoryzowany dealer, Gdynia.',
    alternates: localeAlternates(locale, "/lodzie"),
  }
}

export default async function BoatsPage({ params, searchParams }: BoatsPageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const query = await searchParams
  const brandFilter = query?.brand || ""
  const seriesFilter = query?.series || ""
  const [brands, models] = await Promise.all([
    getBrandsPublic(),
    getBoatModelsPublic(),
  ])

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-8 rounded-lg bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">{t.boatsTitle}</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand: any) => {
            const brandModels = models.filter((model: any) => getBrandSlugFromAny(model) === brand.slug)
            const image = brandModels[0] ? getModelImage(brandModels[0]) : ""

            return (
              <a
                key={brand.slug}
                href={localeHref(current, `/marki/${brand.slug}`)}
                className="block overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="h-56 bg-[#ddd7ca]">
                  {image ? (
                    <img src={image} alt={brand.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/40">
                    {t.brandLabel}
                  </p>
                  <p className="mt-3 text-xl font-semibold">{brand.name}</p>
                  <p className="mt-2 text-sm text-[#111827]/50">
                    {brandModels.length} {pluralModels(current, brandModels.length)}
                  </p>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      <ModelFinder
        models={models}
        locale={current}
        brandFilter={brandFilter}
        seriesFilter={seriesFilter}
        basePath="/lodzie"
      />

      <Footer locale={current} />
    </main>
  )
}
