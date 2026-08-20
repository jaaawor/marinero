"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

type FiltersDrawerProps = {
  locale?: string
  /** Ile pozycji zostaje po aktualnych filtrach — na przycisku. */
  total: number
  /** Ile filtrów jest zaznaczonych — kropka przy przycisku. */
  active?: number
  children: ReactNode
}

// Na telefonie filtry chowają się pod przyciskiem i wysuwają jako panel.
// Wcześniej cała szyna filtrów stała nad produktami (albo pod nimi) i zajmowała
// pół ekranu. Od `lg` panel jest zwykłą kolumną, bez przycisku i bez tła.
export default function FiltersDrawer({
  locale = "pl",
  total,
  active = 0,
  children,
}: FiltersDrawerProps) {
  const t = getDictionary(normalizeLocale(locale))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

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
        className="flex w-full items-center justify-between gap-3 border border-[#0E1A2B]/15 px-4 py-3 text-[13px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B] transition hover:border-[#0E1A2B] lg:hidden"
      >
        <span className="flex items-center gap-2">
          {t.shopFilters}
          {active > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2E64A8] px-1.5 text-[11px] text-white">
              {active}
            </span>
          ) : null}
        </span>

        <span className="text-[12px] font-normal normal-case tracking-normal text-[#0E1A2B]/45">
          {total} {t.shopProducts}
        </span>
      </button>

      {/* Tło panelu — tylko na telefonie */}
      {open ? (
        <button
          type="button"
          aria-label={t.shopSearchClose}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] cursor-default bg-[#0E1A2B]/40 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <div
        className={`${
          open
            ? "fixed inset-x-0 bottom-0 z-[95] max-h-[85vh] overflow-y-auto rounded-t-xl bg-white p-5 shadow-[0_-20px_60px_-30px_rgba(14,26,43,0.7)]"
            : "hidden"
        } lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:p-0 lg:shadow-none`}
      >
        {open ? (
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em]">{t.shopFilters}</p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-[#0E1A2B]/15 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.16em]"
            >
              {t.shopSearchClose}
            </button>
          </div>
        ) : null}

        {children}

        {open ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-6 w-full rounded-sm bg-[#0E1A2B] px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white lg:hidden"
          >
            {t.shopShowResults.replace("{n}", String(total))}
          </button>
        ) : null}
      </div>
    </>
  )
}
