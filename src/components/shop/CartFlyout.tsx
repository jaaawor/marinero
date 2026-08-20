"use client"

import { useEffect, useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { formatPrice } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

// Dymek koszyka wysuwany po dodaniu produktu. Bez niego klient klikał
// „Do koszyka" i nie wiedział, czy cokolwiek się stało — licznik w nagłówku
// zmieniał się za cicho.
export default function CartFlyout({ locale = "pl" }: { locale?: string }) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const { cart, lastAdded } = useCart()

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!lastAdded) return

    setOpen(true)
    const timer = window.setTimeout(() => setOpen(false), 6000)
    return () => window.clearTimeout(timer)
  }, [lastAdded])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!lastAdded) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 top-24 z-[95] w-[min(22rem,calc(100vw-2rem))] border border-[#0E1A2B]/10 bg-white shadow-[0_30px_70px_-30px_rgba(14,26,43,0.55)] transition duration-300 ${
        open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#0E1A2B]/10 px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
          ✓ {t.shopAddedToCart}
        </p>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.shopSearchClose}
          className="text-[#0E1A2B]/35 transition hover:text-[#0E1A2B]"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-4 px-5 py-4">
        {lastAdded.thumbnail ? (
          <img
            src={lastAdded.thumbnail}
            alt=""
            className="h-16 w-16 shrink-0 object-contain"
          />
        ) : null}

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium leading-5 text-[#0E1A2B]">
            {lastAdded.title}
          </p>
          <p className="mt-1 text-sm font-semibold">{formatPrice(lastAdded.price)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#0E1A2B]/10 px-5 py-3 text-sm">
        <span className="text-[#0E1A2B]/50">
          {t.shopCart}: {cart?.itemCount || 0}
        </span>

        <a
          href={localeHref(current, "/sklep/koszyk")}
          className="rounded-sm bg-[#0E1A2B] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8]"
        >
          {t.shopGoToCart}
        </a>
      </div>
    </div>
  )
}
