"use client"

import { useMemo, useRef, useState } from "react"
import { formatPrice } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export type SearchItem = {
  title: string
  handle: string
  price: number | null
  category: string
  /** Miniatura na liście podpowiedzi — bez niej lista była samą ścianą tekstu. */
  thumbnail?: string
}

type ShopLiveSearchProps = {
  locale?: string
  items: SearchItem[]
}

/** Bez polskich znaków i wielkości liter — „śruba" ma się znaleźć po „sruba". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
}

// Wyszukiwarka podpowiadająca na żywo, na stronie sklepu pod etykietami działów.
// Ta w nagłówku otwiera nakładkę i wysyła do katalogu; ta pokazuje trafienia
// od razu, bez przeładowania — indeks jedzie z serwera razem ze stroną.
export default function ShopLiveSearch({ locale = "pl", items }: ShopLiveSearchProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const index = useMemo(
    () =>
      items.map((item) => ({
        item,
        title: normalize(item.title),
        key: normalize(`${item.title} ${item.category}`),
      })),
    [items]
  )

  const results = useMemo(() => {
    const needle = normalize(query.trim())
    if (needle.length < 2) return []

    // Wszystkie słowa zapytania muszą trafić — „suzuki 20" znajdzie DF 20.
    const words = needle.split(/\s+/)
    const hits = index.filter((entry) => words.every((word) => entry.key.includes(word)))

    // Bez punktacji „suzuki 20" wyrzucało filtry „200-350KM" przed silnik DF 20,
    // bo zwykłe `includes` nie odróżnia liczby od jej fragmentu.
    const score = (entry: { title: string; key: string }) => {
      let value = 0
      if (entry.title.startsWith(needle)) value += 100

      for (const word of words) {
        if (new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(entry.title)) value += 40
        else if (entry.title.includes(word)) value += 10
      }

      // Przy równej trafności krótsza nazwa jest zwykle tym właściwym modelem.
      return value - entry.title.length / 100
    }

    return hits
      .sort((a, b) => score(b) - score(a))
      .slice(0, 8)
      .map((entry) => entry.item)
  }, [index, query])

  return (
    <div ref={box} className="relative" onBlur={(event) => {
      if (!box.current?.contains(event.relatedTarget as Node)) setOpen(false)
    }}>
      <form
        action={localeHref(current, "/sklep/produkty")}
        className="flex items-center shadow-[0_18px_40px_-28px_rgba(14,26,43,0.8)]"
      >
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0E1A2B]/45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>

          <input
            type="search"
            name="q"
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={t.shopSearchHint}
            aria-label={t.shopSearchPlaceholder}
            className="w-full rounded-l-full border-2 border-[#0E1A2B] bg-white py-4 pl-14 pr-4 text-[16px] outline-none transition placeholder:text-[#0E1A2B]/35"
          />
        </div>

        <button
          type="submit"
          className="shrink-0 rounded-r-full bg-[#0E1A2B] px-7 py-4 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8]"
        >
          {t.shopSearch}
        </button>
      </form>

      {open && results.length ? (
        <ul className="absolute inset-x-0 top-full z-30 mt-2 max-h-[24rem] overflow-y-auto rounded-lg border border-[#0E1A2B]/12 bg-white shadow-[0_30px_70px_-35px_rgba(14,26,43,0.6)]">
          {results.map((item) => (
            <li key={item.handle}>
              <a
                href={localeHref(current, `/sklep/produkt/${item.handle}`)}
                className="flex items-center gap-4 border-b border-[#0E1A2B]/8 px-4 py-3 text-sm transition last:border-0 hover:bg-[#F4F1EC]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-white">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[#0E1A2B]">{item.title}</span>
                  {item.category ? (
                    <span className="block text-[11px] uppercase tracking-[0.16em] text-[#0E1A2B]/35">
                      {item.category}
                    </span>
                  ) : null}
                </span>

                <span className="shrink-0 font-semibold">{formatPrice(item.price)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.trim().length >= 2 && !results.length ? (
        <p className="absolute inset-x-0 top-full z-30 mt-2 border border-[#0E1A2B]/12 bg-white px-4 py-3 text-sm text-[#0E1A2B]/50 shadow-lg">
          {t.shopNoResults}
        </p>
      ) : null}
    </div>
  )
}
