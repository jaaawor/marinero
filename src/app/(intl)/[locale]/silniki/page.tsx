import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { getEngineModels } from "@/lib/directus"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Silniki zaburtowe Suzuki i Mercury',
    description: 'Silniki zaburtowe Suzuki (DF 6A–300AP) i Mercury (F 5–150, Verado 250/300). Autoryzowany dealer i serwis w Gdyni.',
    alternates: localeAlternates(locale, "/silniki"),
  }
}

export default async function SilnikiPage({ params }: PageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const engines = await getEngineModels()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <div className="mb-10 rounded-lg bg-white p-8 shadow-sm md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            {t.enginesEyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {t.enginesTitle}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
            {t.enginesLead}
          </p>
        </div>

        {/* Zamiast licznika wpisów w CMS (to była notatka z budowy strony)
            wyjście do sklepu — tam silnik da się kupić od ręki. */}
        <div className="mb-6">
          <a
            href={localeHref(current, "/sklep/kategoria/silniki")}
            className="text-sm font-semibold text-[#2E64A8] hover:underline"
          >
            {t.enginesShopLink} →
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {engines.map((engine: any) => (
            <article
              key={engine.slug}
              className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#2E64A8]">
                {engine.brand?.name || t.engineFallbackBrand}
              </p>
              <h2 className="text-xl font-semibold">{engine.name}</h2>
              <p className="mt-3 text-sm leading-6 text-[#111827]/55">
                {engine.short_description || t.engineFallbackLead}
              </p>
            </article>
          ))}
        </div>
      </section>

      <Footer locale={current} />
    </main>
  )
}
