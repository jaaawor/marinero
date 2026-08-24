import { notFound } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { formatOfferPrice, getTrailersPublic } from "@/lib/public-site-data"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 300

type Props = { params: Promise<{ locale: string; slug: string }> }

async function findTrailer(slug: string) {
  const trailers = await getTrailersPublic()
  return trailers.find((trailer) => trailer.slug === slug) || null
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const trailer = await findTrailer(slug)
  if (!trailer) return { title: "Nie znaleziono — Marinero" }

  return {
    title: `${trailer.name} — przyczepa podłodziowa | Marinero`,
    description:
      trailer.shortDescription ||
      `${trailer.name}${trailer.capacityKg ? ` — do ${trailer.capacityKg} kg` : ""}.`,
    alternates: localeAlternates(locale, `/przyczepy/${slug}`),
  }
}

export default async function TrailerPage({ params }: Props) {
  const { locale, slug } = await params
  const current = normalizeLocale(locale)
  const trailer = await findTrailer(slug)

  if (!trailer) notFound()

  const specs = [
    ["Producent", trailer.brand],
    ["Dopuszczalna masa łodzi", trailer.capacityKg ? `${trailer.capacityKg} kg` : ""],
    ["DMC przyczepy", trailer.grossWeightKg ? `${trailer.grossWeightKg} kg` : ""],
    ["Maksymalna długość łodzi", trailer.boatLengthM ? `${trailer.boatLengthM} m` : ""],
  ].filter(([, value]) => value)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-14">
          <div className="overflow-hidden rounded-lg bg-[#f6f5f2]">
            {trailer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trailer.image}
                alt={trailer.name}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : null}
          </div>

          <div>
            <a
              href={localeHref(current, "/przyczepy")}
              className="text-sm font-semibold text-[#2E64A8] hover:underline"
            >
              ← Przyczepy
            </a>

            {trailer.brand ? (
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/35">
                {trailer.brand}
              </p>
            ) : null}

            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {trailer.name}
            </h1>

            {trailer.shortDescription ? (
              <p className="mt-5 text-lg leading-8 text-[#111827]/65">
                {trailer.shortDescription}
              </p>
            ) : null}

            <p className="mt-7 text-3xl font-bold text-[#2E64A8]">
              {trailer.price ? formatOfferPrice(trailer.price, "PLN") : "Cena na zapytanie"}
            </p>

            <a
              href={localeHref(current, "/kontakt")}
              className="mt-8 inline-flex rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
            >
              Zapytaj o tę przyczepę
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 py-12 pb-16 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {trailer.description ? (
            <div
              className="legal-content rounded-lg bg-white p-7 md:p-9"
              dangerouslySetInnerHTML={{ __html: trailer.description }}
            />
          ) : (
            <div />
          )}

          {specs.length ? (
            <div className="h-fit rounded-lg bg-white p-7 md:p-9">
              <h2 className="text-xl font-semibold tracking-tight">Dane techniczne</h2>
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
