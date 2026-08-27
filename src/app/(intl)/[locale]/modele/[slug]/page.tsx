import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BoatConfigurator from "@/components/BoatConfigurator"
import OfferCard from "@/components/OfferCard"
import LightboxGallery from "@/components/LightboxGallery"
import ModelCard from "@/components/ModelCard"
import { notFound } from "next/navigation"
import { getBoatModelBySlug } from "@/lib/directus"
import {
  getBoatModelsPublic,
  getOffersForModel,
  getTeamPublic,
} from "@/lib/public-site-data"
import {
  getContentTranslations,
  translate,
  translateConfigurator,
  translateEquipment,
} from "@/lib/content-translations"
import { getCurrencyForBrand } from "@/lib/configurator-data"
import { getConfigurator } from "@/lib/configurator-source"
import { getStandardEquipmentFor } from "@/lib/standard-equipment-source"
import { getOfficialModelData } from "@/lib/official-model-data"
import { getDictionary, localeHref, normalizeLocale, translateSpecLabel } from "@/lib/i18n"
import {
  absoluteUrl,
  breadcrumbJsonLd,
  clampDescription,
  jsonLdProps,
  localeAlternates,
  productJsonLd,
} from "@/lib/seo"
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

// Nazwy modeli bywają zapisane z marką („Aquila 42 Coupe"), a bywają bez
// („Merry Fisher 895"). Doklejanie marki w ciemno dawało w tytule
// „Aquila Aquila 42 Coupe".
function fullModelName(name: string, brand: string) {
  const clean = String(name || "").trim()
  const label = String(brand || "").trim()
  if (!label) return clean
  if (clean.toLowerCase().startsWith(label.toLowerCase())) return clean
  return `${label} ${clean}`
}

/**
 * Pełny opis do sekcji „Opis" — najpierw `description`, bo to jest miejsce na
 * cały tekst producenta, a `short_description` bywa tylko jego pierwszym
 * akapitem. Wcześniej oba pola dawały ten sam napis i sekcja „Opis" była
 * powtórzoną zajawką z kadru otwierającego.
 */
function getDescription(model: any, official: any) {
  return (
    clean(official?.description) ||
    clean(model?.description) ||
    clean(model?.short_description) ||
    `${clean(model?.name)} marki ${getBrandNameFromAny(model) || "Marinero"}.`
  )
}

/** Źródło zajawki: najpierw krótkie pole, bo po to jest. */
function getTeaserSource(model: any, official: any) {
  return (
    clean(model?.short_description) ||
    clean(official?.description) ||
    clean(model?.description) ||
    `${clean(model?.name)} marki ${getBrandNameFromAny(model) || "Marinero"}.`
  )
}

/**
 * Zajawka pod tytułem w kadrze otwierającym.
 *
 * Cały opis stoi niżej, w sekcji „Opis", i powtarzanie go przy zdjęciu robiło
 * z hero ścianę tekstu — a to jest miejsce na jedno zdanie, które zachęca do
 * przewinięcia dalej. Tniemy na granicy zdania, nie w połowie słowa.
 */
function getTeaser(text: string, limit = 170) {
  const czysty = clean(text)
  if (czysty.length <= limit) return czysty

  const zdania = czysty.match(/[^.!?]+[.!?]+/g) || []
  let wynik = ""
  for (const zdanie of zdania) {
    if (wynik && (wynik + zdanie).trim().length > limit) break
    wynik += zdanie
  }

  if (wynik.trim()) return wynik.trim()
  // Zdanie dłuższe niż cały limit — ucinamy na ostatniej spacji.
  const ciecie = czysty.slice(0, limit)
  return `${ciecie.slice(0, ciecie.lastIndexOf(" ")).trim()}…`
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

// Bez tego wszystkie 79 modeli miały w wynikach jeden tytuł z layoutu
// i konkurowały ze sobą o to samo zapytanie. Tytuł to marka + nazwa +
// najkrótsza cecha, po której ludzie szukają („9.38 m").
export async function generateMetadata({ params }: ModelPageProps) {
  const { slug, locale } = await params
  const model: any = await getBoatModelBySlug(slug)
  if (!model) return {}

  const official = getOfficialModelData(slug)
  const brand = getBrandNameFromAny(model)
  const series = getSeriesFromAny(model)
  const length = model?.loa ? `${formatNumberPl(model.loa)} m` : ""

  const title = fullModelName(model.name, brand)
  const details = [series, length].filter(Boolean).join(", ")

  const description = clampDescription(
    getDescription(model, official) ||
      `${title}${details ? ` — ${details}` : ""}. Autoryzowany dealer Marinero, Gdynia.`
  )

  const image = getModelGallery(slug, model, official)[0] || ""

  return {
    title: details ? `${title} — ${details}` : title,
    description,
    alternates: localeAlternates(locale, `/modele/${slug}`),
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(localeHref(normalizeLocale(locale), `/modele/${slug}`)),
      ...(image ? { images: [{ url: image, alt: model.name }] } : {}),
    },
  }
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

  const rawConfig = await getConfigurator(slug)
  const rawEquipment = await getStandardEquipmentFor(slug)
  const modelOffers = await getOffersForModel(slug)
  const official: any = getOfficialModelData(slug)

  // Treści z panelu (opis, konfigurator, wyposażenie) w języku strony —
  // słownik po polskim tekście, patrz `content-translations.ts`.
  const tresc = await getContentTranslations(current)
  const config = translateConfigurator(tresc, rawConfig)
  const standardEquipment = translateEquipment(tresc, rawEquipment)

  const brandName = getBrandNameFromAny(model)
  const brandSlug = getBrandSlugFromAny(model)
  const seriesName = getSeriesFromAny(model)
  const seriesSlug = getSeriesSlugFromAny(model)
  const description = translate(tresc, getDescription(model, official))
  const teaser = getTeaser(translate(tresc, getTeaserSource(model, official)))

  // Opis producenta bywa kilkuakapitowy — trzymamy go z pustymi wierszami
  // i rysujemy akapit po akapicie, zamiast zlewać w jedną ścianę tekstu.
  const akapity = description.split(/\n{2,}/).map((tekst) => tekst.trim()).filter(Boolean)
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
    { label: t.fieldBrand, value: brandName, href: href(`/lodzie?brand=${brandSlug}#modele`) },
    { label: t.seriesLabel, value: seriesName, href: href(`/lodzie?brand=${brandSlug}&series=${seriesSlug}#modele`) },
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
      {/* Dane strukturalne — bez nich wyszukiwarka widzi tylko akapit tekstu
          i nie wie, że to konkretny model łodzi konkretnej marki. Ceny łodzi
          świadomie NIE trafiają do `offers`: na stronie są netto, w euro albo
          dolarach, a w wyniku wyszukiwania wyglądałyby na cenę końcową. */}
      <script
        {...jsonLdProps([
          productJsonLd({
            name: fullModelName(model.name, brandName),
            description,
            image: gallery.slice(0, 3),
            brand: brandName,
            url: href(`/modele/${slug}`),
          }),
          breadcrumbJsonLd([
            { name: t.navBoats, path: href("/lodzie") },
            { name: t.navModels, path: `${href("/lodzie")}#modele` },
            ...(brandName ? [{ name: brandName, path: href(`/marki/${brandSlug}`) }] : []),
            { name: model.name, path: href(`/modele/${slug}`) },
          ]),
        ])}
      />

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
              {teaser}
            </p>

            {teaser !== description ? (
              <a
                href="#opis"
                className="mt-3 w-fit text-sm font-semibold text-[#2E64A8] transition hover:text-[#28588F]"
              >
                {t.readMore} →
              </a>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {brandName ? (
                <a
                  href={href(`/lodzie?brand=${brandSlug}#modele`)}
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
                  href={href(`/lodzie?brand=${brandSlug}&series=${seriesSlug}#modele`)}
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
                href={href(`/lodzie?brand=${brandSlug}#modele`)}
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

          <LightboxGallery images={gallery} alt={model.name} locale={current} />
        </section>
      ) : null}

      {/* Opis + specyfikacja */}
      <section
        id="opis"
        className="mx-auto grid max-w-[1500px] gap-8 px-5 py-8 md:px-8 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="rounded-lg bg-white p-8 shadow-sm md:p-10">
          <h2 className="text-3xl font-semibold tracking-tight">{model.name}</h2>

          <div className="mt-6 grid gap-4 text-base leading-8 text-[#111827]/65">
            {akapity.map((tekst) => (
              <p key={tekst.slice(0, 40)}>{tekst}</p>
            ))}

            {!isArchived ? (
              <p>
                {t.modelIndividualNote}
              </p>
            ) : (
              <p>
                {t.modelArchivedNote}
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

      {/* Wyposażenie standardowe bez konfiguratora. Zwykle pokazuje je
          kalkulator, ale przy łodziach, dla których producent nie podał
          jeszcze cen (Sting 470 Pro, 725 Pro T-Top), kalkulatora nie ma —
          i lista wyposażenia, którą mamy w bazie, nie miałaby gdzie stanąć. */}
      {!showConfigurator && standardEquipment.length ? (
        <section className="bg-white">
          <div className="mx-auto max-w-[1500px] px-5 py-14 md:px-8">
            <h2 className="mb-8 text-3xl font-semibold tracking-tight">
              {t.cfgStandardEquipment}
            </h2>

            <div className="xl:columns-2 xl:gap-10">
              {standardEquipment.map((group) => (
                <div key={group.title} className="mb-6 break-inside-avoid last:mb-0">
                  <h3 className="mb-3 text-sm font-semibold text-[#111827]/80">
                    {group.title}
                  </h3>

                  <ul className="space-y-2 text-sm leading-6 text-[#111827]/60">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-[#2E64A8]">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Egzemplarze tego modelu dostępne na sprzedaż. Stoi PRZED „Inne modele
          w ofercie": kto ogląda Nordkappa 830, chce najpierw wiedzieć, czy
          mamy go na stanie, a dopiero potem co jeszcze mamy. Bez wolnych
          sztuk sekcja w ogóle się nie pokazuje. */}
      {modelOffers.length ? (
        <section className="bg-white">
          <div className="mx-auto max-w-[1500px] px-5 py-14 md:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#111827]/40">
                  {t.modelInStockEyebrow}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  {modelOffers.length === 1
                    ? "Ten model mamy na stanie"
                    : `Egzemplarze tego modelu (${modelOffers.length})`}
                </h2>
              </div>

              <a
                href={localeHref(current, "/gielda")}
                className="text-sm font-semibold text-[#2E64A8] transition hover:underline"
              >
                {t.modelInStockAll} →
              </a>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {modelOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  href={localeHref(current, `/gielda/${offer.slug}`)}
                  locale={current}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Inne modele */}
      {otherModels.length ? (
        <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
          <div className="mb-8 flex items-end justify-between gap-6">
            <h2 className="text-3xl font-semibold tracking-tight">{t.otherModels}</h2>
            <a
              href={href(`/lodzie?brand=${brandSlug}#modele`)}
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
