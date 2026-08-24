import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ModelCard from "@/components/ModelCard"
import { getArchivedBoatModelsPublic } from "@/lib/public-site-data"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type ArchivePageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Archiwum modeli',
    description: 'Modele wycofane z produkcji — dane techniczne i zdjęcia zostają dla właścicieli i kupujących na rynku wtórnym.',
    alternates: localeAlternates(locale, "/archiwum"),
  }
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const models = await getArchivedBoatModelsPublic()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            {t.archiveTitle}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">
            {t.archiveLead}
          </p>

          <a
            href={`${localeHref(current, "/lodzie")}#modele`}
            className="mt-7 inline-flex rounded-md border border-[#111827]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            {t.homeAllModels}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model: any) => (
            <ModelCard key={model.slug} locale={current} model={model} badge={t.archiveBadge} />
          ))}
        </div>
      </section>

      <Footer locale={current} />
    </main>
  )
}
