import Header from "@/components/Header"
import Footer from "@/components/Footer"
import OfferCard, { CONDITION_LABELS } from "@/components/OfferCard"
import { getUsedBoatsPublic } from "@/lib/public-site-data"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

// Kolejność ma znaczenie sprzedażowo: najpierw to, co klient może mieć
// najszybciej.
const ORDER = ["od-reki", "demo", "w-produkcji", "uzywana"] as const

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: "Łodzie na sprzedaż — giełda Marinero",
    description:
      "Konkretne egzemplarze: łodzie nowe dostępne od ręki, jednostki demo, " +
      "zamówienia w produkcji i łodzie używane. Rocznik, silniki, przebieg i cena.",
    alternates: localeAlternates(locale, "/gielda"),
  }
}

export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const offers = await getUsedBoatsPublic()

  const groups = ORDER.map((condition) => ({
    condition,
    label: CONDITION_LABELS[condition],
    items: offers.filter((offer) => offer.condition === condition),
  })).filter((group) => group.items.length)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            Łodzie na sprzedaż
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">
            Konkretne egzemplarze z naszej oferty — te dostępne od ręki, jednostki
            demo, zamówienia w produkcji i łodzie używane. Szukasz modelu, a nie
            konkretnej sztuki?{" "}
            <a href={localeHref(current, "/modele")} className="text-[#2E64A8] underline">
              Zobacz katalog modeli
            </a>
            .
          </p>

          {groups.length > 1 ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {groups.map((group) => (
                <a
                  key={group.condition}
                  href={`#${group.condition}`}
                  className="rounded-full border border-[#111827]/15 px-4 py-2 text-sm text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
                >
                  {group.label} ({group.items.length})
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {groups.length ? (
        <div className="mx-auto max-w-[1500px] px-5 py-12 md:px-8 lg:py-16">
          <div className="grid gap-14">
            {groups.map((group) => (
              <section key={group.condition} id={group.condition} className="scroll-mt-24">
                <h2 className="text-2xl font-semibold tracking-tight">{group.label}</h2>

                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      href={localeHref(current, `/gielda/${offer.slug}`)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        // Pusta giełda to normalny stan (wszystko sprzedane) — nie zostawiamy
        // po sobie samego nagłówka.
        <div className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
          <div className="rounded-lg border border-[#111827]/10 bg-white p-10 text-center">
            <p className="text-lg text-[#111827]/60">
              W tej chwili nie mamy wolnych egzemplarzy na stanie.
            </p>
            <a
              href={localeHref(current, "/kontakt")}
              className="mt-6 inline-flex rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
            >
              Napisz, czego szukasz
            </a>
          </div>
        </div>
      )}

      <Footer locale={current} />
    </main>
  )
}
