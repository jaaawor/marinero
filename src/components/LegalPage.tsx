import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { notFound } from "next/navigation"
import { getPageBySlug } from "@/lib/directus"
import { normalizeLocale } from "@/lib/i18n"

type LegalPageProps = {
  slug: string
  locale?: string
  /** Tytuł, gdy strony nie ma jeszcze w Directusie. */
  fallbackTitle: string
}

// Regulamin i polityka prywatności. Treść mieszka w kolekcji `pages`
// w Directusie (slug = adres), więc klient poprawia ją sam, bez wdrożenia.
export default async function LegalPage({ slug, locale = "pl", fallbackTitle }: LegalPageProps) {
  const current = normalizeLocale(locale)
  const page = await getPageBySlug(slug)

  if (!page) notFound()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <article className="mx-auto max-w-[900px] px-5 py-8 md:px-8 md:py-12">
        <div className="rounded-lg bg-white p-6 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {page.title || fallbackTitle}
          </h1>

          {page.excerpt ? (
            <p className="mt-4 text-base leading-8 text-[#111827]/55">{page.excerpt}</p>
          ) : null}

          {page.content ? (
            <div
              className="legal-content mt-8 text-base leading-8 text-[#111827]/75"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          ) : null}
        </div>
      </article>

      <Footer locale={current} />
    </main>
  )
}

export async function legalMetadata(slug: string, fallbackTitle: string) {
  const page = await getPageBySlug(slug)

  return {
    title: page?.seo_title || page?.title || fallbackTitle,
    description: page?.seo_description || page?.excerpt || undefined,
  }
}
