import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getNewsPublic } from "@/lib/public-site-data"
import { guessNewsKind } from "@/lib/news-kind"
import { LOCALE_TAGS, getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

function formatDate(value: string, tag: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleDateString(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

type NewsPageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Aktualności',
    description: 'Nowości, testy łodzi, relacje z targów i porady serwisowe od zespołu Marinero.',
    alternates: localeAlternates(locale, "/aktualnosci"),
  }
}

export default async function AktualnosciPage({ params }: NewsPageProps) {
  const { locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const news = await getNewsPublic(50)

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <section className="bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8 lg:py-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            {t.newsLabel}
          </p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            {t.newsTitle}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#111827]/65">
            {t.newsLead}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
        {news.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {news.map((item) => {
              const date = formatDate(item.date, LOCALE_TAGS[current])
              // Ta sama flaga co w sklepie — wpisy mają być rozpoznawalne wszędzie.
              const kind = guessNewsKind(item)

              return (
                <a
                  key={item.id}
                  href={localeHref(current, `/aktualnosci/${item.slug}`)}
                  className="block overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative h-64 bg-[#ddd7ca]">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}

                    <span
                      className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${kind.className}`}
                    >
                      {kind.label}
                    </span>
                  </div>

                  <div className="p-6 md:p-7">
                    {date ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2E64A8]">
                        {date}
                      </p>
                    ) : null}

                    <h2 className="mt-3 text-xl font-semibold leading-7">{item.title}</h2>

                    {item.excerpt ? (
                      <p className="mt-4 text-sm leading-7 text-[#111827]/55">{item.excerpt}</p>
                    ) : null}
                    <p className="mt-5 text-sm font-bold text-[#2E64A8]">{t.newsReadMore} →</p>
                  </div>
                </a>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-[#111827]/10 bg-white p-8 text-center shadow-sm">
            <p className="text-[#111827]/55">
              {t.newsEmpty}
            </p>
          </div>
        )}
      </section>

      <Footer locale={current} />
    </main>
  )
}
