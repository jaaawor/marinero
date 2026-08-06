import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BoatConfigurator from "@/components/BoatConfigurator"
import LightboxGallery from "@/components/LightboxGallery"
import ModelCard from "@/components/ModelCard"
import { notFound } from "next/navigation"
import { getBoatModelBySlug } from "@/lib/directus"
import { getBoatModelsPublic, getTeamPublic } from "@/lib/public-site-data"
import { getConfiguratorData, getCurrencyForBrand } from "@/lib/configurator-data"
import { getStandardEquipment } from "@/lib/standard-equipment-data"
import { getOfficialModelData } from "@/lib/official-model-data"
import { getDictionary, localeHref, normalizeLocale, translateSpecLabel } from "@/lib/i18n"
import {
  formatNumberPl,
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
    locale: string
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
  }

  const withUnit = (value: any, unit: string) => {
    const cleaned = clean(value)
    if (!cleaned) return ""
    if (/[a-ząęóśłżźćń]/i.test(cleaned)) return cleaned
    const pretty = formatNumberPl(cleaned)
    return pretty ? `${pretty} ${unit}` : ""
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
  const { slug, locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)
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
  const currency = config?.currency || model?.currency || getCurrencyForBrand(brandName)
  const showConfigurator = Boolean(config) && !isArchived

  const [allModels, offerContacts] = await Promise.all([
    getBoatModelsPublic(),
    getTeamPublic(),
  ])
  const otherModels = allModels
    .filter((item: any) => item.brandSlug === brandSlug && item.slug !== slug)
    .slice(0, 3)

  const contactHref = href(`/kontakt?subject=${encodeURIComponent(`${model.name}`)}`)

  const lengthPl = formatNumberPl(model?.loa)
  const beamPl = formatNumberPl(model?.beam)
  const cabins = clean(model?.cabins)
  const people = clean(model?.max_people)

  const quickFacts = [
    { label: t.fieldBrand, value: brandName, href: href(`/modele?brand=${brandSlug}`) },
    { label: t.seriesLabel, value: seriesName, href: href(`/modele?brand=${brandSlug}&series=${seriesSlug}`) },
    { label: t.cardLength, value: lengthPl ? `${lengthPl} m` : "" },
    { label: t.cardBeam, value: beamPl ? `${beamPl} m` : "" },
    cabins
      ? { label: t.cardCabins, value: cabins }
      : { label: t.cardPersons, value: people },
    basePrice
      ? { label: t.basePriceLabel, value: formatMoney(basePrice, currency) }
      : { label: t.cardPersons, value: cabins ? people : "" },
  ].filter((item) => item.value)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      {/* Hero: zdjęcie + nazwa, opis, kafelki marki/serii i CTA */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-10 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
          <div className="overflow-hidden rounded-lg bg-[#ddd7ca] shadow-sm">
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

          <div className="flex flex-col justify-center">
            {isArchived ? (
              <p className="mb-4 inline-flex w-fit rounded-full bg-[#111827]/6 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111827]/55">
                Model archiwalny — wycofany z produkcji
              </p>
            ) : null}

            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight md:text-4xl">
              {model.name}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-[#111827]/65 md:text-lg md:leading-8">
              {description}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {brandName ? (
                <a
                  href={href(`/modele?brand=${brandSlug}`)}
                  className="rounded-lg border border-[#111827]/10 bg-[#f6f5f2] p-5 transition hover:border-[#2E64A8]/40"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/35">
                    {t.fieldBrand}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-[#111827]">{brandName}</p>
                </a>
              ) : null}

              {seriesName ? (
                <a
                  href={href(`/modele?brand=${brandSlug}&series=${seriesSlug}`)}
                  className="rounded-lg border border-[#111827]/10 bg-[#f6f5f2] p-5 transition hover:border-[#2E64A8]/40"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/35">
                    {t.seriesLabel}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-[#111827]">{seriesName}</p>
                </a>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={contactHref}
                className="rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
              >
                {t.askOffer}
              </a>

              {showConfigurator ? (
                <a
                  href="#konfigurator"
                  className="rounded-md border border-[#2E64A8]/30 bg-white px-6 py-3 text-sm font-bold text-[#2E64A8] transition hover:bg-[#2E64A8]/5"
                >
                  {t.configuratorTitle}
                </a>
              ) : null}

              <a
                href={href(`/modele?brand=${brandSlug}`)}
                className="rounded-md border border-[#111827]/15 bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
              >
                {t.homeAllModels}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Pasek najważniejszych danych */}
      {quickFacts.length ? (
        <section className="mx-auto max-w-[1500px] px-5 py-12 md:px-8">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {quickFacts.map((fact: any) =>
              fact.href ? (
                <a
                  key={fact.label}
                  href={fact.href}
                  className="rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm transition hover:border-[#2E64A8]/40"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/35">
                    {fact.label}
                  </p>
                  <p className="mt-3 text-xl font-semibold text-[#2E64A8]">{fact.value}</p>
                </a>
              ) : (
                <div
                  key={fact.label}
                  className="rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/35">
                    {fact.label}
                  </p>
                  <p className="mt-3 text-xl font-semibold text-[#111827]">{fact.value}</p>
                </div>
              )
            )}
          </div>
        </section>
      ) : null}

      {/* Galeria */}
      {gallery.length ? (
        <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
          <div className="mb-5 flex items-end justify-between gap-6">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.galleryTitle}</h2>
            <p className="hidden text-sm font-semibold text-[#111827]/45 md:block">
              {gallery.length} {t.photosWord}
            </p>
          </div>

          <LightboxGallery images={gallery} alt={model.name} />
        </section>
      ) : null}

      {/* Opis + specyfikacja */}
      <section className="mx-auto grid max-w-[1500px] gap-8 px-5 py-8 md:px-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg bg-white p-8 shadow-sm md:p-10">
          <h2 className="text-3xl font-semibold tracking-tight">{model.name}</h2>

          <div className="mt-6 grid gap-4 text-base leading-8 text-[#111827]/65">
            <p>{description}</p>

            {!isArchived ? (
              <p>
                Dokładna konfiguracja, dostępność jednostek, opcje wyposażenia oraz warunki
                zakupu przygotowujemy indywidualnie na zapytanie.
              </p>
            ) : (
              <p>
                Model wycofany z produkcji — zapytaj nas o dostępność egzemplarzy używanych
                oraz modele, które zastąpiły go w ofercie producenta.
              </p>
            )}

          </div>
        </div>

        {specs.length ? (
          <div className="rounded-lg bg-white p-8 shadow-sm md:p-10">
            <div className="grid gap-0">
              {specs.slice(0, 14).map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex items-center justify-between gap-6 border-b border-[#111827]/10 py-5 last:border-b-0"
                >
                  <span className="text-[#111827]/55">{translateSpecLabel(current, item.label)}</span>
                  <span className="text-right font-semibold text-[#111827]">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={contactHref}
                className="rounded-md bg-[#111827] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111827]/85"
              >
                {t.requestSpec}
              </a>
            </div>
          </div>
        ) : null}
      </section>

      {/* Konfigurator */}
      {showConfigurator ? (
        <section
          id="konfigurator"
          className="mx-auto max-w-[1500px] scroll-mt-28 px-5 py-8 md:px-8"
        >
          <BoatConfigurator
            modelName={model.name}
            slug={model.slug}
            brandName={brandName}
            config={config}
            standardEquipment={standardEquipment}
            offerContacts={offerContacts}
            locale={current}
          />
        </section>
      ) : null}

      {/* Inne modele */}
      {otherModels.length ? (
        <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
          <div className="mb-8 flex items-end justify-between gap-6">
            <h2 className="text-3xl font-semibold tracking-tight">{t.otherModels}</h2>
            <a
              href={href(`/modele?brand=${brandSlug}`)}
              className="hidden rounded-md border border-[#111827]/15 px-5 py-2.5 text-sm font-semibold transition hover:border-[#2E64A8] hover:text-[#2E64A8] md:block"
            >
              {t.homeAllModels}
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {otherModels.map((item: any) => (
              <ModelCard key={item.slug} model={item} locale={current} />
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="mx-auto max-w-[1500px] px-5 pb-16 md:px-8">
        <div className="grid gap-8 rounded-lg bg-white p-8 shadow-sm md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight">
              {t.modelCtaTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
              {t.modelCtaLead}
            </p>
          </div>
          <div className="flex items-center">
            <a
              href={contactHref}
              className="rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
            >
              {t.navContact}
            </a>
          </div>
        </div>
      </section>

      <Footer locale={current} />
    </main>
  )
}
