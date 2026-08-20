"use client"

import { useMemo, useRef, useState } from "react"
import { formatPrice } from "@/lib/medusa"
import { buildIndex, searchIndex } from "@/lib/shop-search"
import type { SearchItem } from "@/lib/shop-search"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export type { SearchItem }

type ShopLiveSearchProps = {
  locale?: string
  items: SearchItem[]
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

  const index = useMemo(() => buildIndex(items), [items])
  const results = useMemo(() => searchIndex(index, query), [index, query])

  return (
    <div ref={box} className="relative" onBlur={(event) => {
      if (!box.current?.contains(event.relatedTarget as Node)) setOpen(false)
    }}>
      {/* Ramka jest na obudowie, nie na polu — wcześniej pole miało `border-2`,
          a przycisk nie, więc były różnej wysokości i pigułka się rozjeżdżała.
          `items-stretch` pilnuje, żeby przycisk zawsze sięgał krawędzi. */}
      <form
        action={localeHref(current, "/sklep/produkty")}
        className="flex items-stretch overflow-hidden rounded-full border-2 border-[#0E1A2B] bg-white shadow-[0_18px_40px_-28px_rgba(14,26,43,0.8)]"
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
            className="h-14 w-full bg-transparent pl-14 pr-4 text-[16px] outline-none placeholder:text-[#0E1A2B]/35 md:h-16"
          />
        </div>

        <button
          type="submit"
          className="shrink-0 bg-[#0E1A2B] px-6 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8] md:px-9"
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
