"use client"

import { useEffect, useRef, useState } from "react"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

type Suggestion = { label: string; href: string }

type ShopSearchProps = {
  locale?: string
  action: string
  /** Podpowiedzi pod polem — działy sklepu, żeby nakładka nie była pusta. */
  suggestions?: Suggestion[]
}

// Wyszukiwarka jako ikona + nakładka na pełną szerokość (wzorzec: pantuniestal,
// leferment, flextail, pak-in). Wklejone pole w pasku albo w osobnym wierszu
// zawsze wyglądało jak doklejone i nachodziło na linki działów.
export default function ShopSearch({ locale = "pl", action, suggestions = [] }: ShopSearchProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

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

              {suggestions.length ? (
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
