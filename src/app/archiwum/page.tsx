import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getArchivedBoatModelsPublic } from "@/lib/public-site-data"
import { getBrandNameFromAny, getModelImage } from "@/lib/model-taxonomy"

export const revalidate = 60

export default async function ArchivePage() {
  const models = await getArchivedBoatModelsPublic()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-8 rounded-[1.5rem] bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
            Archiwum modeli
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[#111827]/55">
            Modele wycofane z produkcji przez producentów. Zachowujemy je jako
            źródło informacji — zapytaj nas o dostępność egzemplarzy używanych.
          </p>

          <a
            href="/modele"
            className="mt-5 inline-flex rounded-full border border-[#111827]/12 px-5 py-2.5 text-sm font-bold text-[#111827]/65 hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            Wróć do aktualnych modeli
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model: any) => {
            const image = getModelImage(model)
            const brandName = getBrandNameFromAny(model)

            return (
              <article
                key={model.slug}
                className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm transition hover:-translate-y-0.5"
              >
                <a href={`/modele/${model.slug}`} className="block">
                  <div className="aspect-[16/10] bg-[#ddd7ca]">
                    {image ? (
                      <img src={image} alt={model.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </a>

                <div className="p-5">
                  <a
                    href={`/modele/${model.slug}`}
                    className="text-xl font-semibold hover:text-[#2E64A8]"
                  >
                    {model.name}
                  </a>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {brandName ? (
                      <span className="rounded-full bg-[#f6f5f2] px-3 py-1 text-xs font-semibold text-[#111827]/60">
                        {brandName}
                      </span>
                    ) : null}

                    <span className="rounded-full bg-[#111827]/6 px-3 py-1 text-xs font-semibold text-[#111827]/55">
                      Wycofany z produkcji
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <Footer />
    </main>
  )
}
