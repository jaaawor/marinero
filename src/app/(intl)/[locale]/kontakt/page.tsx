import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ContactBand from "@/components/ContactBand"
import { getFooterData } from "@/lib/directus"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params
  return {
    title: "Kontakt i serwis",
    description:
      "Telefony i adresy e-mail do zespołu Marinero — sprzedaż łodzi, sklep i autoryzowany serwis silników zaburtowych w Gdyni.",
    alternates: localeAlternates(locale, "/kontakt"),
  }
}

// Serwis to drugi powód, dla którego ludzie dzwonią — a na stronie nie było
// o nim ani słowa. Treść z marinero.pl/serwis, żeby nikt nie musiał wracać
// na starą stronę po informację, co właściwie robimy.
const SERVICE = [
  {
    title: "Przeglądy i naprawy silników zaburtowych",
    text: "Autoryzowany serwis — specjalizujemy się w Suzuki i Mercury.",
  },
  {
    title: "Serwis i naprawy łodzi motorowych",
    text: "Naprawy laminatów, instalacji elektrycznej i osprzętu.",
  },
  {
    title: "Montaż wyposażenia i elektroniki",
    text: "Autoryzowany dealer m.in. Garmina i Fusion.",
  },
  {
    title: "Obsługa łodzi",
    text: "Mycie, utrzymanie w gotowości, wodowanie, zimowanie, transport.",
  },
  {
    title: "Prace konserwacyjne",
    text: "Malowanie farbą antyporostową, polerowanie laminatów.",
  },
]

export default async function KontaktPage({ params }: PageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const href = (path: string) => localeHref(current, path)
  const { settings } = await getFooterData()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <div className="mb-10 rounded-lg bg-white p-8 shadow-sm md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Kontakt
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Skontaktuj się z Marinero
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
            Napisz, jakiej łodzi, silnika lub części szukasz. Przygotujemy
            odpowiedź, ofertę albo pomożemy dobrać właściwe rozwiązanie.
          </p>
        </div>

        {/* Ten sam baner co w stopce: Facebook, mapa i telefony do ludzi. */}
        <ContactBand settings={settings} locale={current} />

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sprzedaż łodzi i silników</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              Doradztwo przy wyborze łodzi, silnika, wyposażenia i konfiguracji.
            </p>
            <a
              className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
              href="mailto:info@marinero.pl"
            >
              info@marinero.pl
            </a>
          </div>

          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sklep internetowy</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              Części, akcesoria, elektronika i produkty dostępne online.
            </p>
            <a
              className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
              href={href("/sklep")}
            >
              Przejdź do sklepu →
            </a>
          </div>
        </div>

        <div
          id="serwis"
          className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Serwis
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Autoryzowany serwis silników zaburtowych
          </h2>

          <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE.map((item) => (
              <div key={item.title}>
                <p className="font-semibold leading-6">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#111827]/55">{item.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-7 max-w-3xl text-sm leading-7 text-[#111827]/60">
            Dojeżdżamy do klienta albo przewozimy łódź do warsztatu. Serwis
            znajdziesz w gdyńskiej marinie, w hangarze Jacht Klubu Morskiego
            GRYF — pierwszy hangar od wjazdu do mariny.
          </p>

          <a
            className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
            href="mailto:serwis@marinero.pl"
          >
            serwis@marinero.pl
          </a>
        </div>
      </section>

      {/* Baner z mapą i kontaktami stoi wyżej na tej stronie — w stopce
          byłby drugi raz, jeden pod drugim. */}
      <Footer locale={current} settings={settings} hideContactBand />
    </main>
  )
}
