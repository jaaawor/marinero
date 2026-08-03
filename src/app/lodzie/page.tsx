import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getBoatModelsPublic, getBrandsPublic } from "@/lib/public-site-data"
import { getBrandSlugFromAny, getModelImage } from "@/lib/model-taxonomy"

export const revalidate = 60

export default async function BoatsPage() {
  const [brands, models] = await Promise.all([
    getBrandsPublic(),
    getBoatModelsPublic(),
  ])

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-8 rounded-[1.5rem] bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Łodzie</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#111827]/55">
            Modele dostępne w ofercie Marinero według marek i serii.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand: any) => {
            const brandModels = models.filter((model: any) => getBrandSlugFromAny(model) === brand.slug)
            const image = brandModels[0] ? getModelImage(brandModels[0]) : ""

            return (
              <a key={brand.slug} href={`/marki/${brand.slug}`} className="group overflow-hidden rounded-[1.5rem] bg-white shadow-sm transition hover:-translate-y-0.5">
                <div className="aspect-[16/10] bg-[#ddd7ca]">
                  {image ? (
                    <img src={image} alt={brand.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : null}
                </div>

                <div className="p-5">
                  <p className="text-2xl font-semibold">{brand.name}</p>
                  <p className="mt-2 text-sm text-[#111827]/45">
                    {brandModels.length} modeli
                  </p>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      <Footer />
    </main>
  )
}
