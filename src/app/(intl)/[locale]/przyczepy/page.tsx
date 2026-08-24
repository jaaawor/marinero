import Header from "@/components/Header"
import Footer from "@/components/Footer"
import PhotoPlaceholder from "@/components/PhotoPlaceholder"
import { formatOfferPrice, getTrailersPublic } from "@/lib/public-site-data"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: "Przyczepy podłodziowe — Marinero",
    description:
      "Przyczepy do transportu łodzi: dopuszczalna masa, długość jednostki i cena. " +
      "Dobierzemy przyczepę do Twojej łodzi.",
    alternates: localeAlternates(locale, "/przyczepy"),
  }
}

export default async function TrailersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const trailers = await getTrailersPublic()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            Przyczepy podłodziowe
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">
            Przyczepa musi pasować do łodzi masą i długością, nie „na oko" — dlatego
            przy każdej podajemy dopuszczalną masę i maksymalną długość jednostki.
            Nie wiesz, co wybrać? Napisz, jaką masz łódź, a dobierzemy.
          </p>
        </div>
      </section>

      {trailers.length ? (
        <div className="mx-auto max-w-[1500px] px-5 py-12 md:px-8 lg:py-16">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trailers.map((trailer) => {
              const specs = [
                trailer.capacityKg ? `do ${trailer.capacityKg} kg` : "",
                trailer.boatLengthM ? `łódź do ${trailer.boatLengthM} m` : "",
              ].filter(Boolean)

              return (
                <a
                  key={trailer.id}
                  href={localeHref(current, `/przyczepy/${trailer.slug}`)}
                  className="group flex flex-col overflow-hidden rounded-lg border border-[#111827]/10 bg-white transition hover:border-[#111827]/25"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-[#f6f5f2]">
                    {trailer.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trailer.image}
                        alt={trailer.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <PhotoPlaceholder className="h-full w-full" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    {trailer.brand ? (
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/35">
                        {trailer.brand}
                      </p>
                    ) : null}

                    <h2 className="mt-1.5 text-lg font-semibold leading-6 tracking-tight">
                      {trailer.name}
                    </h2>

                    {specs.length ? (
                      <p className="mt-2 text-sm text-[#111827]/50">{specs.join(" · ")}</p>
                    ) : null}

                    <p className="mt-auto pt-5 text-lg font-bold text-[#2E64A8]">
                      {trailer.price ? formatOfferPrice(trailer.price, "PLN") : "Cena na zapytanie"}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
          <div className="rounded-lg border border-[#111827]/10 bg-white p-10 text-center">
            <p className="text-lg text-[#111827]/60">
              Przyczepy sprowadzamy na zamówienie — napisz, jaką masz łódź.
            </p>
            <a
              href={localeHref(current, "/kontakt")}
              className="mt-6 inline-flex rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
            >
              Dobierzemy przyczepę
            </a>
          </div>
        </div>
      )}

      <Footer locale={current} />
    </main>
  )
}
