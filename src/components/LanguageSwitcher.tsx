"use client"

import { useEffect, useRef, useState } from "react"
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, DEFAULT_LOCALE } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n"

type LanguageSwitcherProps = {
  locale: Locale
}

// Przełącznik języka. Zapisuje wybór w ciasteczku (żeby zwykłe linki
// prowadziły do właściwej wersji) i przenosi na ten sam adres w nowym języku.
export default function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function switchTo(next: Locale) {
    document.cookie = `marinero_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`

    const path = window.location.pathname
    const segments = path.split("/")
    const hasLocale = LOCALES.includes(segments[1] as Locale)
    const bare = hasLocale ? "/" + segments.slice(2).join("/") : path
    const clean = bare === "/" || bare === "" ? "" : bare.replace(/\/$/, "")

    window.location.href =
      next === DEFAULT_LOCALE ? clean || "/" : `/${next}${clean}${window.location.search}`
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Język / Language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-[#111827]/12 px-3 py-2 text-sm font-bold text-[#111827]/70 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
      >
        <span>{LOCALE_SHORT[locale]}</span>
        <span aria-hidden className="text-[10px] text-[#111827]/40">
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[170px] overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-lg">
          {LOCALES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchTo(item)}
              className={`flex w-full items-center justify-between gap-3 border-t border-[#111827]/8 px-4 py-2.5 text-left text-sm transition first:border-t-0 hover:bg-[#f6f5f2] ${
                item === locale ? "font-bold text-[#2E64A8]" : "text-[#111827]/70"
              }`}
            >
              <span>{LOCALE_NAMES[item]}</span>
              <span className="text-xs text-[#111827]/35">{LOCALE_SHORT[item]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
