import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelCard from "@/components/ModelCard"
import { getArchivedBoatModelsPublic } from "@/lib/public-site-data"

export const revalidate = 60

export default async function ArchivePage() {
  const models = await getArchivedBoatModelsPublic()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            Archiwum modeli
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">
            Modele wycofane z produkcji przez producentów. Zachowujemy je jako źródło
            informacji — zapytaj nas o dostępność egzemplarzy używanych.
          </p>

          <a
            href="/modele"
            className="mt-7 inline-flex rounded-md border border-[#111827]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            Wróć do aktualnych modeli
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model: any) => (
            <ModelCard key={model.slug} model={model} badge="Wycofany z produkcji" />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}
