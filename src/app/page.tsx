import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getBoatModelsPublic, getBrandsPublic } from "@/lib/public-site-data"
import { getBrandNameFromAny, getModelImage, getSeriesFromAny } from "@/lib/model-taxonomy"

export const revalidate = 60

export default async function HomePage() {
  const [brands, models] = await Promise.all([
    getBrandsPublic(),
    getBoatModelsPublic(),
  ])

  const aquila42 = models.find((model: any) => model.slug === "aquila-42-coupe")
  const heroModel = aquila42 || models[0]
  const heroImage = heroModel ? getModelImage(heroModel) : ""
  const featured = models.slice(0, 6)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm md:p-10">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] md:text-6xl">
              Łodzie, silniki i konfiguracje ofertowe.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[#111827]/58">
              Marinero prezentuje modele łodzi, umożliwia wybór wyposażenia i przygotowanie oferty dla klienta.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/modele" className="inline-flex justify-center rounded-full bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white">
                Zobacz modele
              </a>
              <a href="/kontakt" className="inline-flex justify-center rounded-full border border-[#111827]/12 px-6 py-3 text-sm font-bold text-[#111827]/65">
                Kontakt
              </a>
            </div>
          </div>

          <a href={heroModel ? `/modele/${heroModel.slug}` : "/modele"} className="group overflow-hidden rounded-[1.5rem] bg-[#ddd7ca] shadow-sm">
            <div className="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[440px]">
              {heroImage ? (
                <img src={heroImage} alt={heroModel?.name || "Marinero"} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              ) : null}
            </div>
          </a>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">Marki</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {brands.slice(0, 5).map((brand: any) => (
              <a key={brand.slug} href={`/marki/${brand.slug}`} className="rounded-[1.25rem] bg-white p-5 shadow-sm hover:text-[#2E64A8]">
                <p className="text-lg font-semibold">{brand.name}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">Wybrane modele</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((model: any) => {
              const image = getModelImage(model)

              return (
                <a key={model.slug} href={`/modele/${model.slug}`} className="group overflow-hidden rounded-[1.5rem] bg-white shadow-sm transition hover:-translate-y-0.5">
                  <div className="aspect-[16/10] bg-[#ddd7ca]">
                    {image ? (
                      <img src={image} alt={model.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <p className="text-xl font-semibold">{model.name}</p>
                    <p className="mt-2 text-sm text-[#111827]/45">
                      {[getBrandNameFromAny(model), getSeriesFromAny(model)].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        </section>
      </section>

      <Footer />
    </main>
  )
}
