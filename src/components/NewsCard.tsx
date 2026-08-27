import { LOCALE_TAGS, localeHref, normalizeLocale } from "@/lib/i18n"
import { guessNewsKind } from "@/lib/news-kind"
import PhotoPlaceholder from "@/components/PhotoPlaceholder"

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
  // Flaga rodzaju wpisu — ta sama co w sklepie, żeby lista aktualności
  // i sekcja porad wyglądały jak jedno.
  const kind = guessNewsKind(item || {})

  return (
    <a
      href={localeHref(current, `/aktualnosci/${item.slug}`)}
      className="block overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* `object-contain`, nie `cover`: zdjęcia z aktualności mają proporcje
          od kwadratu (1.00) po pas panoramiczny (2.35) — kadr wypełniany
          obcinał kwadratowym plakatom pół treści, a panoramom dziób i rufę.
          Tło jest w kolorze strony, więc marginesy czytają się jak oprawa,
          a nie jak dziura. */}
      <div className="relative aspect-[16/10] bg-[#f6f5f2]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <PhotoPlaceholder className="h-full w-full" />
        )}

        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${kind.className}`}
        >
          {kind.label}
        </span>
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
