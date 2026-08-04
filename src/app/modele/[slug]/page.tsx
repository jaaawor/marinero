import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BoatConfigurator from "@/components/BoatConfigurator"
import LightboxGallery from "@/components/LightboxGallery"
import { notFound } from "next/navigation"
import { getBoatModelBySlug } from "@/lib/directus"
import { getBoatModelsPublic } from "@/lib/public-site-data"
import { getModelImage } from "@/lib/model-taxonomy"
import { getConfiguratorData } from "@/lib/configurator-data"
import { getStandardEquipment } from "@/lib/standard-equipment-data"
import { getOfficialModelData } from "@/lib/official-model-data"
import {
  getBrandNameFromAny,
  getBrandSlugFromAny,
  getModelGallery,
  getSeriesFromAny,
  getSeriesSlugFromAny,
} from "@/lib/model-taxonomy"

export const revalidate = 60

type ModelPageProps = {
  params: Promise<{
    slug: string
  }>
}

type Spec = {
  label: string
  value: string
}

function clean(value: any) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function formatNumber(value: number) {
  return String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function formatMoney(value: any, currency = "USD") {
  if (!value) return ""
  return `${formatNumber(Number(value))} ${currency}`
}

function getDescription(model: any, official: any) {
  return (
    clean(official?.description) ||
    clean(model?.short_description) ||
    clean(model?.description) ||
    `${clean(model?.name)} marki ${getBrandNameFromAny(model) || "Marinero"}.`
  )
}

function getSpecs(model: any, official: any): Spec[] {
  const specs: Spec[] = []
  const officialSpecs = official?.specs

  if (Array.isArray(officialSpecs)) {
    for (const item of officialSpecs) {
      const label = clean(item?.label || item?.title || item?.name)
      const value = clean(item?.value)

      if (
        label &&
        value &&
        !["status vat", "opis", "źródło danych", "zrodlo danych"].includes(label.toLowerCase())
      ) {
        specs.push({ label, value })
      }
    }
  } else if (officialSpecs && typeof officialSpecs === "object") {
    for (const [key, valueRaw] of Object.entries(officialSpecs)) {
      const label = clean(key)
      const value = clean(valueRaw)

      if (
        label &&
        value &&
        !["status vat", "opis", "źródło danych", "zrodlo danych"].includes(label.toLowerCase())
      ) {
        specs.push({ label, value })
      }
    }
  }

  const withUnit = (value: any, unit: string) => {
    const cleaned = clean(value)
    if (!cleaned) return ""
    return /[a-ząęóśłżźćń]/i.test(cleaned) ? cleaned : `${cleaned} ${unit}`
  }

  const fallback: Spec[] = [
    { label: "Długość", value: withUnit(model?.loa, "m") },
    { label: "Szerokość", value: withUnit(model?.beam, "m") },
    { label: "Zanurzenie", value: withUnit(model?.draft, "m") },
    { label: "Masa", value: withUnit(model?.weight, "kg") },
    { label: "Kabiny", value: clean(model?.cabins) },
    { label: "Łazienki", value: clean(model?.bathrooms) },
    { label: "Liczba osób", value: clean(model?.max_people) },
    { label: "Silnik", value: clean(model?.engine_recommendation) },
    {
      label: "Napęd i osiągi",
      // pomijamy, gdy powiela wiersz "Silnik"
      value:
        clean(model?.engines) &&
        !clean(model?.engine_recommendation).startsWith(clean(model?.engines).slice(0, 8))
          ? clean(model?.engines)
          : "",
    },
    { label: "Zbiornik paliwa", value: withUnit(model?.fuel_capacity, "l") },
    { label: "Zbiornik wody", value: withUnit(model?.water_capacity, "l") },
    { label: "Kategoria CE", value: clean(model?.ce_category) },
  ].filter((item) => item.value)

  const existing = new Set(specs.map((item) => item.label.toLowerCase()))

  for (const item of fallback) {
    if (!existing.has(item.label.toLowerCase())) {
      specs.push(item)
    }
  }

  return specs
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { slug } = await params
  const model: any = await getBoatModelBySlug(slug)

  if (!model) {
    notFound()
  }

  const config = getConfiguratorData(slug)
  const standardEquipment = getStandardEquipment(slug)
  const official: any = getOfficialModelData(slug)

  const brandName = getBrandNameFromAny(model)
  const brandSlug = getBrandSlugFromAny(model)
  const seriesName = getSeriesFromAny(model)
  const seriesSlug = getSeriesSlugFromAny(model)
  const description = getDescription(model, official)
  const gallery = getModelGallery(slug, model, official)
  const hero = gallery[0] || ""
  const specs = getSpecs(model, official)

  const isArchived = model?.status === "archived"
  const basePrice = isArchived ? null : config?.basePrice || model?.base_price || model?.price
  const currency = config?.currency || model?.currency || "USD"
  const showConfigurator = Boolean(config) && !isArchived

  const allModels = await getBoatModelsPublic()
  const otherModels = allModels
    .filter((item: any) => item.brandSlug === brandSlug && item.slug !== slug)
    .slice(0, 3)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="overflow-hidden rounded-[1.5rem] bg-[#ddd7ca] shadow-sm">
            {hero ? (
              <img
                src={hero}
                alt={model.name}
                className="h-full min-h-[360px] w-full object-cover lg:min-h-[520px]"
              />
            ) : (
              <div className="min-h-[360px] lg:min-h-[520px]" />
            )}
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm md:p-8 lg:p-10">
            {isArchived ? (
              <p className="mb-3 inline-flex rounded-full bg-[#111827]/6 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111827]/55">
                Model archiwalny — wycofany z produkcji
              </p>
            ) : null}

            <h1 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              {model.name}
            </h1>

            <p className="mt-5 text-base leading-8 text-[#111827]/58">
              {description}
            </p>

            <div className="mt-7 grid gap-3">
              {brandName ? (
                <a
                  href={`/modele?brand=${brandSlug}`}
                  className="rounded-[1rem] bg-[#f6f5f2] p-4 transition hover:bg-[#eef2f8]"
                >
                  <p className="text-xs text-[#111827]/42">Marka</p>
                  <p className="mt-1 text-base font-semibold text-[#2E64A8]">{brandName}</p>
                </a>
              ) : null}

              {seriesName ? (
                <a
                  href={`/modele?brand=${brandSlug}&series=${seriesSlug}`}
                  className="rounded-[1rem] bg-[#f6f5f2] p-4 transition hover:bg-[#eef2f8]"
                >
                  <p className="text-xs text-[#111827]/42">Seria</p>
                  <p className="mt-1 text-base font-semibold text-[#2E64A8]">{seriesName}</p>
                </a>
              ) : null}

              {basePrice ? (
                <div className="rounded-[1rem] bg-[#f6f5f2] p-4">
                  <p className="text-xs text-[#111827]/42">Cena bazowa netto</p>
                  <p className="mt-1 text-xl font-semibold">{formatMoney(basePrice, currency)}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {showConfigurator ? (
                <a
                  href="#konfigurator"
                  className="inline-flex justify-center rounded-full bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
                >
                  Konfigurator
                </a>
              ) : null}

              <a
                href="/kontakt"
                className="inline-flex justify-center rounded-full border border-[#111827]/12 px-6 py-3 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
              >
                Zapytaj o model
              </a>
            </div>
          </div>
        </div>

        {gallery.length ? (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              Zdjęcia
            </h2>

            <div className="mt-5">
              <LightboxGallery images={gallery} alt={model.name} />
            </div>
          </section>
        ) : null}

        {specs.length ? (
          <section className="mt-10 rounded-[1.5rem] bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              Specyfikacja techniczna
            </h2>

            <div className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-2">
              {specs.slice(0, 16).map((item) => (
                <div key={`${item.label}-${item.value}`} className="grid grid-cols-[0.9fr_1.1fr] gap-4 border-b border-[#111827]/8 pb-3">
                  <p className="text-sm text-[#111827]/45">{item.label}</p>
                  <p className="text-sm font-semibold text-[#111827]/82">{item.value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {showConfigurator ? (
          <section id="konfigurator" className="mt-10 scroll-mt-28">
            <BoatConfigurator
              modelName={model.name}
              slug={model.slug}
              brandName={brandName}
              config={config}
              standardEquipment={standardEquipment}
            />
          </section>
        ) : null}

        {otherModels.length ? (
          <section className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
                Inne modele marki {brandName}
              </h2>

              <a
                href={`/modele?brand=${brandSlug}`}
                className="text-sm font-bold text-[#2E64A8] hover:text-[#28588F]"
              >
                Wszystkie modele
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {otherModels.map((item: any) => {
                const image = getModelImage(item)

                return (
                  <article
                    key={item.slug}
                    className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm transition hover:-translate-y-0.5"
                  >
                    <a href={`/modele/${item.slug}`} className="block">
                      <div className="aspect-[16/10] bg-[#ddd7ca]">
                        {image ? (
                          <img src={image} alt={item.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                    </a>

                    <div className="p-5">
                      <a
                        href={`/modele/${item.slug}`}
                        className="text-lg font-semibold hover:text-[#2E64A8]"
                      >
                        {item.name}
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}
      </section>

      <Footer />
    </main>
  )
}
