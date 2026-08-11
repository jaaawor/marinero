import { LOCALE_TAGS, localeHref, normalizeLocale } from "@/lib/i18n"

type NewsCardProps = {
  item: any
  locale?: string
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

// Karta aktualności w tym samym układzie co karty modeli.
export default function NewsCard({ item, locale = "pl" }: NewsCardProps) {
  const current = normalizeLocale(locale)
  const date = formatDate(item?.date, LOCALE_TAGS[current])

  return (
    <a
      href={localeHref(current, `/aktualnosci/${item.slug}`)}
      className="block overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-56 bg-[#ddd7ca]">
        {item.image ? (
          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="p-5">
        {date ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/40">
            {date}
          </p>
        ) : null}

        <h3 className="mt-3 text-lg font-semibold leading-6">{item.title}</h3>

        {item.excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#111827]/50">{item.excerpt}</p>
        ) : null}
      </div>
    </a>
  )
}
