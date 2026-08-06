import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelCard from "@/components/ModelCard"
import NewsCard from "@/components/NewsCard"
import { getBoatModelsPublic, getBrandsPublic, getNewsPublic } from "@/lib/public-site-data"
import { getBrandSlugFromAny, getModelImage } from "@/lib/model-taxonomy"
import { getDictionary, localeHref, normalizeLocale, pluralModels } from "@/lib/i18n"

export const revalidate = 60

type HomePageProps = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const [brands, models, news] = await Promise.all([
    getBrandsPublic(),
    getBoatModelsPublic(),
    getNewsPublic(3),
  ])

  const aquila42 = models.find((model: any) => model.slug === "aquila-42-coupe")
  const heroModel = aquila42 || models[0]
  const heroImage = heroModel ? getModelImage(heroModel) : ""

  // „Wybrane modele" ustawia się w panelu admina polem `featured` (kolejność: `sort`).
  // Bez zaznaczonych modeli pokazujemy po jednym największym z każdej marki.
  const flagged = models
    .filter((model: any) => model.featured)
    .sort((a: any, b: any) => (a.sort || 0) - (b.sort || 0))

  const fallbackFeatured = brands
    .map((brand: any) =>
      models
        .filter((model: any) => getBrandSlugFromAny(model) === brand.slug)
        .sort((a: any, b: any) => Number(b.loa || 0) - Number(a.loa || 0))[0]
    )
    .filter(Boolean)

  const featured = (flagged.length ? flagged : fallbackFeatured).slice(0, 6)

  // Kafelek marki: zdjęcie największej łodzi tej marki jako tło.
  const brandTiles = brands
    .map((brand: any) => {
      const brandModels = models.filter((model: any) => getBrandSlugFromAny(model) === brand.slug)
      const showcase = [...brandModels].sort(
        (a: any, b: any) => Number(b.loa || 0) - Number(a.loa || 0)
      )[0]

      return {
        ...brand,
        count: brandModels.length,
        image: showcase ? getModelImage(showcase) : brand.image,
      }
    })
    .filter((brand: any) => brand.count > 0)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header models={models} locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
          <div className="rounded-lg bg-white p-6 shadow-sm md:p-10">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] md:text-6xl">
              {t.homeHeroTitle}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[#111827]/58">
              {t.homeHeroLead}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={href("/modele")} className="inline-flex justify-center rounded-full bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white">
                {t.homeSeeModels}
              </a>
              <a href={href("/kontakt")} className="inline-flex justify-center rounded-full border border-[#111827]/12 px-6 py-3 text-sm font-bold text-[#111827]/65">
                {t.navContact}
              </a>
            </div>
          </div>

          <a href={heroModel ? href(`/modele/${heroModel.slug}`) : href("/modele")} className="group overflow-hidden rounded-lg bg-[#ddd7ca] shadow-sm">
            <div className="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[440px]">
              {heroImage ? (
                <img src={heroImage} alt={heroModel?.name || "Marinero"} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              ) : null}
            </div>
          </a>
        </div>

        <section id="brands" className="mt-12 scroll-mt-28">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
                {t.homeDealerLabel}
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{t.homeBrandsTitle}</h2>
            </div>

            <a
              href={href("/lodzie")}
              className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
            >
              {t.homeAllBrands}
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {brandTiles.map((brand: any) => (
              <a
                key={brand.slug}
                href={href(`/marki/${brand.slug}`)}
                className="group relative block overflow-hidden rounded-lg bg-[#ddd7ca] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="aspect-[4/3] xl:aspect-[3/4]">
                  {brand.image ? (
                    <img
                      src={brand.image}
                      alt={brand.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : null}
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#111827]/85 via-[#111827]/35 to-transparent p-4 pt-14">
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="mb-2 h-7 w-auto max-w-[70%] object-contain object-left brightness-0 invert"
                    />
                  ) : (
                    <p className="text-base font-semibold leading-tight text-white">{brand.name}</p>
                  )}

                  <p className="text-xs text-white/70">
                    {brand.count} {pluralModels(current, brand.count)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
                {t.homeFeaturedLabel}
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{t.homeFeaturedTitle}</h2>
            </div>

            <a
              href={href("/modele")}
              className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
            >
              {t.homeAllModels}
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((model: any) => (
              <ModelCard key={model.slug} model={model} locale={current} />
            ))}
          </div>
        </section>

        {news.length ? (
          <section className="mt-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
                  {t.homeNewsLabel}
                </p>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{t.homeNewsTitle}</h2>
              </div>

              <a
                href={href("/aktualnosci")}
                className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
              >
                {t.homeAllNews}
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {news.map((item: any) => (
                <NewsCard key={item.id} item={item} locale={current} />
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <Footer locale={current} />
    </main>
  )
}
