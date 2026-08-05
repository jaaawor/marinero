import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelCard from "@/components/ModelCard"
import { notFound } from "next/navigation"
import { getBoatModelsPublic, getBrandPublic } from "@/lib/public-site-data"
import { getBrandSlugFromAny } from "@/lib/model-taxonomy"

export const revalidate = 60

type BrandPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params
  const [brand, allModels] = await Promise.all([
    getBrandPublic(slug),
    getBoatModelsPublic(),
  ])

  if (!brand) {
    notFound()
  }

  const models = allModels.filter((model: any) => getBrandSlugFromAny(model) === slug)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-8 rounded-lg bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">{brand.name}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#111827]/55">
            {brand.description || "Modele dostępne w ofercie Marinero."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model: any) => (
            <ModelCard key={model.slug} model={model} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}
