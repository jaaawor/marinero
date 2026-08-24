import { notFound } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import LightboxGallery from "@/components/LightboxGallery"
import PhotoPlaceholder from "@/components/PhotoPlaceholder"
import { CONDITION_LABELS } from "@/components/OfferCard"
import { formatOfferPrice, getUsedBoatsPublic } from "@/lib/public-site-data"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type Props = { params: Promise<{ locale: string; slug: string }> }

async function findOffer(slug: string) {
  const offers = await getUsedBoatsPublic()
  return offers.find((offer) => offer.slug === slug) || null
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const offer = await findOffer(slug)
  if (!offer) return { title: "Nie znaleziono — Marinero" }

  const bits = [
    offer.year ? `rocznik ${offer.year}` : "",
    offer.engines,
    offer.price ? formatOfferPrice(offer.price, offer.currency) : "cena na zapytanie",
  ].filter(Boolean)

  return {
    title: `${offer.name} — ${CONDITION_LABELS[offer.condition] || ""} | Marinero`.replace(" —  |", " |"),
    description: offer.shortDescription || `${offer.name}: ${bits.join(", ")}.`,
    alternates: localeAlternates(locale, `/gielda/${slug}`),
  }
}

export default async function OfferPage({ params }: Props) {
  const { locale, slug } = await params
  const current = normalizeLocale(locale)
  const offer = await findOffer(slug)

  if (!offer) notFound()

  const specs = [
    ["Stan", CONDITION_LABELS[offer.condition] || ""],
    ["Marka", offer.brand],
    ["Rocznik", offer.year ? String(offer.year) : ""],
    ["Długość", offer.lengthM ? `${offer.lengthM} m` : ""],
    ["Silniki", offer.engines],
    ["Przebieg silnika", offer.engineHours ? `${offer.engineHours} mth` : ""],
    ["Lokalizacja", offer.location],
    ["Status VAT", offer.vatStatus],
  ].filter(([, value]) => value)

  const gallery = [offer.image, ...offer.images].filter(Boolean)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-14">
          <div className="overflow-hidden rounded-lg bg-[#f6f5f2]">
            {offer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={offer.image}
                alt={offer.name}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <PhotoPlaceholder className="aspect-[16/10] w-full" />
            )}
          </div>

          <div>
            <a
              href={localeHref(current, "/gielda")}
              className="text-sm font-semibold text-[#2E64A8] hover:underline"
            >
              ← Łodzie na sprzedaż
            </a>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/35">
              {[offer.brand, CONDITION_LABELS[offer.condition]].filter(Boolean).join(" · ")}
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {offer.name}
            </h1>

            {offer.shortDescription ? (
              <p className="mt-5 text-lg leading-8 text-[#111827]/65">{offer.shortDescription}</p>
            ) : null}

            <p className="mt-7 text-3xl font-bold text-[#2E64A8]">
              {offer.price ? formatOfferPrice(offer.price, offer.currency) : "Cena na zapytanie"}
            </p>
            {offer.price && offer.vatStatus ? (
              <p className="mt-1 text-sm text-[#111827]/45">{offer.vatStatus}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={localeHref(current, "/kontakt")}
                className="rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
              >
                Zapytaj o tę łódź
              </a>
              {offer.brochure ? (
                <a
                  href={offer.brochure}
                  target="_blank"
                  rel="noopener"
                  className="rounded-md border border-[#111827]/15 px-6 py-3 text-sm font-bold text-[#111827]/70 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
                >
                  Pobierz specyfikację
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {gallery.length > 1 ? (
        <div className="mx-auto max-w-[1500px] px-5 py-12 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Galeria</h2>
          <div className="mt-6">
            <LightboxGallery images={gallery} alt={offer.name} />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1500px] px-5 pb-16 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {offer.description ? (
            <div
              className="legal-content rounded-lg bg-white p-7 md:p-9"
              dangerouslySetInnerHTML={{ __html: offer.description }}
            />
          ) : (
            <div />
          )}

          {specs.length ? (
            <div className="h-fit rounded-lg bg-white p-7 md:p-9">
              <h2 className="text-xl font-semibold tracking-tight">Dane egzemplarza</h2>
              <dl className="mt-5 grid gap-3 text-sm">
                {specs.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 border-b border-[#111827]/8 pb-3 last:border-b-0"
                  >
                    <dt className="text-[#111827]/50">{label}</dt>
                    <dd className="text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      <Footer locale={current} />
    </main>
  )
}
