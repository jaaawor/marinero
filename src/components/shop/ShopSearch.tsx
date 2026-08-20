"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { formatPrice } from "@/lib/medusa"
import { buildIndex, searchIndex } from "@/lib/shop-search"
import type { SearchItem } from "@/lib/shop-search"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

type Suggestion = { label: string; href: string }

type ShopSearchProps = {
  locale?: string
  action: string
  /** Podpowiedzi pod polem — działy sklepu, żeby nakładka nie była pusta. */
  suggestions?: Suggestion[]
  /** Indeks produktów — ta sama lista co w wyszukiwarce na stronie sklepu. */
  items?: SearchItem[]
  /** Adres strony produktu, `{handle}` podmieniamy na uchwyt. */
  productPath?: string
}

// Wyszukiwarka jako ikona + nakładka na pełną szerokość (wzorzec: pantuniestal,
// leferment, flextail, pak-in). Wklejone pole w pasku albo w osobnym wierszu
// zawsze wyglądało jak doklejone i nachodziło na linki działów.
export default function ShopSearch({
  locale = "pl",
  action,
  suggestions = [],
  items = [],
  productPath = "/sklep/produkt/{handle}",
}: ShopSearchProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const input = useRef<HTMLInputElement>(null)

  // Ta sama podpowiadaczka co na stronie sklepu — wcześniej nakładka tylko
  // wysyłała do katalogu, więc trzeba było przeładować stronę, żeby cokolwiek
  // zobaczyć.
  const index = useMemo(() => buildIndex(items), [items])
  const results = useMemo(() => searchIndex(index, query, 6), [index, query])

  useEffect(() => {
    if (!open) return

    input.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    // Strona pod nakładką nie może się przewijać.
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.shopSearchPlaceholder}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-bold text-[#111827] transition hover:text-[#4854A7]"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>
        <span className="hidden xl:inline">{t.shopSearch}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.shopSearchClose}
            className="absolute inset-0 h-full w-full cursor-default bg-[#0E1A2B]/40 backdrop-blur-[2px]"
          />

          <div className="relative border-b border-[#0E1A2B]/10 bg-white">
            <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
              <div className="flex items-start justify-between gap-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0E1A2B]/40">
                  {t.shopSearch}
                </p>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/45 transition hover:text-[#0E1A2B]"
                >
                  {t.shopSearchClose}
                </button>
              </div>

              {/* Pole bez ramki — sama linia pod spodem, jak w nagłówkach sekcji */}
              <form action={action} className="mt-8 flex items-center gap-4 border-b-2 border-[#0E1A2B] pb-4">
                <input
                  ref={input}
                  type="search"
                  name="q"
                  value={query}
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.shopSearchHint}
                  aria-label={t.shopSearchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent font-serif text-3xl font-normal tracking-[-0.015em] outline-none placeholder:text-[#0E1A2B]/25 md:text-[2.75rem]"
                />

                <button
                  type="submit"
                  className="shrink-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B] transition hover:text-[#2E64A8]"
                >
                  {t.shopSearch}
                </button>
              </form>

              {results.length ? (
                <ul className="mt-6 max-h-[50vh] overflow-y-auto">
                  {results.map((item) => (
                    <li key={item.handle}>
                      <a
                        href={productPath.replace("{handle}", item.handle)}
                        className="flex items-center gap-4 border-b border-[#0E1A2B]/8 py-3 transition last:border-0 hover:bg-[#F4F1EC]"
                      >
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-white">
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
                          <span className="block truncate text-base text-[#0E1A2B]">
                            {item.title}
                          </span>
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

              {query.trim().length >= 2 && !results.length ? (
                <p className="mt-6 text-sm text-[#0E1A2B]/50">{t.shopNoResults}</p>
              ) : null}

              {suggestions.length > 0 && !results.length ? (
                <div className="mt-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
                    {t.shopSearchPopular}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {suggestions.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className="border border-[#0E1A2B]/12 px-4 py-2.5 text-sm text-[#0E1A2B]/70 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
