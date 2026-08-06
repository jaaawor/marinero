import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { normalizeLocale } from "@/lib/i18n"
import { getEngineModels } from "@/lib/directus"

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function SilnikiPage({ params }: PageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const engines = await getEngineModels()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <div className="mb-10 rounded-lg bg-white p-8 shadow-sm md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Silniki zaburtowe
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Mercury i Suzuki
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
            Lista silników jest pobierana z Directusa. W kolejnym etapie
            uzupełnimy moce, zdjęcia, opisy i parametry.
          </p>
        </div>

        <div className="mb-6 text-sm font-semibold text-[#111827]/50">
          Liczba silników w CMS: {engines.length}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {engines.map((engine: any) => (
            <article
              key={engine.slug}
              className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#2E64A8]">
                {engine.brand?.name || "Silnik zaburtowy"}
              </p>
              <h2 className="text-xl font-semibold">{engine.name}</h2>
              <p className="mt-3 text-sm leading-6 text-[#111827]/55">
                {engine.short_description ||
                  "Model silnika zaburtowego dostępny w ofercie Marinero."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <Footer locale={current} />
    </main>
  )
}
