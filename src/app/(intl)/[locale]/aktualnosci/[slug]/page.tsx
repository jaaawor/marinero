import Header from "@/components/Header"
import Footer from "@/components/Footer"
import NewsCard from "@/components/NewsCard"
import { notFound } from "next/navigation"
import { getNewsBySlugPublic, getNewsPublic } from "@/lib/public-site-data"
import { LOCALE_TAGS, getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 60

type NewsDetailProps = {
  params: Promise<{
    slug: string
    locale: string
  }>
}

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

export async function generateMetadata({ params }: NewsDetailProps) {
  const { slug } = await params
  const item = await getNewsBySlugPublic(slug)

  if (!item) return {}

  return {
    title: item.title,
    description: item.excerpt,
  }
}

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { slug, locale } = await params
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const item = await getNewsBySlugPublic(slug)

  if (!item) {
    notFound()
  }

  const all = await getNewsPublic(20)
  const others = all.filter((entry) => entry.slug !== slug).slice(0, 3)
  const date = formatDate(item.date, LOCALE_TAGS[current])

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header locale={current} />

      <article className="mx-auto max-w-[900px] px-5 py-8 md:px-8 md:py-12">
        <a
          href={localeHref(current, "/aktualnosci")}
          className="text-sm font-semibold text-[#111827]/45 transition hover:text-[#2E64A8]"
        >
          ← {t.newsTitle}
        </a>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm md:p-10">
          {date ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2E64A8]">
              {date}
            </p>
          ) : null}

          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {item.title}
          </h1>

          {item.image ? (
            <div className="mt-8 overflow-hidden rounded-lg bg-[#ddd7ca]">
              <img src={item.image} alt={item.title} className="w-full object-cover" />
            </div>
          ) : null}

          {item.content ? (
            <div
              className="news-content mt-8 text-base leading-8 text-[#111827]/75"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          ) : item.excerpt ? (
            <p className="mt-8 text-base leading-8 text-[#111827]/75">{item.excerpt}</p>
          ) : null}
        </div>
      </article>

      {others.length ? (
        <section className="mx-auto max-w-[1500px] px-5 pb-16 md:px-8">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight md:text-3xl">
            {t.homeAllNews}
          </h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map((entry) => (
              <NewsCard key={entry.id} item={entry} locale={current} />
            ))}
          </div>
        </section>
      ) : null}

      <Footer locale={current} />
    </main>
  )
}
