import Header from "@/components/Header"
import Footer from "@/components/Footer"
import NewsCard from "@/components/NewsCard"
import { notFound } from "next/navigation"
import { getNewsBySlugPublic, getNewsPublic } from "@/lib/public-site-data"
import { formatPrice, getShopProduct } from "@/lib/medusa"
import { guessNewsKind } from "@/lib/news-kind"
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
  const kind = guessNewsKind(item)

  // Produkt z wpisu pokazujemy WEWNĄTRZ artykułu — pod kafelkiem na liście
  // przycisk „Zobacz produkt" wisiał bez kontekstu, a klient i tak najpierw
  // czyta tekst.
  const product = item.productHandle
    ? await getShopProduct(item.productHandle).catch(() => null)
    : null

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
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${kind.className}`}
            >
              {kind.label}
            </span>

            {date ? (
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2E64A8]">
                {date}
              </p>
            ) : null}
          </div>

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

          {product ? (
            <aside className="mt-10 flex flex-col gap-5 rounded-lg border border-[#111827]/10 bg-[#f6f5f2] p-5 sm:flex-row sm:items-center md:p-6">
              <a
                href={localeHref(current, `/sklep/produkt/${product.handle}`)}
                className="flex h-28 w-28 shrink-0 items-center justify-center rounded-md bg-white p-2"
              >
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </a>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111827]/40">
                  {t.navShop}
                </p>

                <h2 className="mt-2 text-lg font-semibold leading-6">
                  <a
                    href={localeHref(current, `/sklep/produkt/${product.handle}`)}
                    className="transition hover:text-[#2E64A8]"
                  >
                    {product.title}
                  </a>
                </h2>

                {typeof product.price === "number" ? (
                  <p className="mt-2 text-base font-semibold">{formatPrice(product.price)}</p>
                ) : null}
              </div>

              <a
                href={localeHref(current, `/sklep/produkt/${product.handle}`)}
                className="shrink-0 rounded-md bg-[#2E64A8] px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-[#28588F]"
              >
                {t.shopSeeProduct}
              </a>
            </aside>
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
