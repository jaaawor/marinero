import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BoatConfigurator from "@/components/BoatConfigurator"
import { notFound } from "next/navigation"
import { getBoatModelBySlug } from "@/lib/directus"
import { getConfiguratorData } from "@/lib/configurator-data"
import { getStandardEquipment } from "@/lib/standard-equipment-data"
import { getOfficialModelData } from "@/lib/official-model-data"

export const revalidate = 60

type ConfiguratorPageProps = {
  params: Promise<{
    slug: string
  }>
}

function formatNumber(value: number) {
  return String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function formatUsd(value: number) {
  return `${formatNumber(value)} USD`
}

export default async function ConfiguratorPage({ params }: ConfiguratorPageProps) {
  const { slug } = await params
  const model = await getBoatModelBySlug(slug)
  const config = getConfiguratorData(slug)
  const standardEquipment = getStandardEquipment(slug)
  const official = getOfficialModelData(slug)
  const heroImage = official?.gallery?.[0] || ""

  if (!model) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="mb-5 overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="p-6 md:p-7">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Skonfiguruj {model.name}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#111827]/55">
                Wybierz wyposażenie, wpisz dane klienta i przygotuj zapytanie ofertowe z PDF.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {config ? (
                  <div className="rounded-lg bg-[#f6f5f2] px-4 py-3">
                    <p className="text-xs text-[#111827]/45">Cena bazowa netto</p>
                    <p className="mt-1 text-xl font-semibold">{formatUsd(config.basePrice)}</p>
                  </div>
                ) : null}

                <a
                  href={`/modele/${model.slug}`}
                  className="inline-flex rounded-md border border-[#111827]/15 px-4 py-3 text-sm font-semibold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
                >
                  Wróć do modelu
                </a>
              </div>
            </div>

            {heroImage ? (
              <div className="min-h-[220px] bg-[#ddd7ca] lg:min-h-full">
                <img
                  src={heroImage}
                  alt={model.name}
                  className="h-full min-h-[220px] w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>

        <BoatConfigurator
          modelName={model.name}
          slug={model.slug}
          brandName={model.brand?.name}
          config={config}
          standardEquipment={standardEquipment}
        />
      </section>

      <Footer />
    </main>
  )
}
