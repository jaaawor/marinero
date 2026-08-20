"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Cart } from "@/components/shop/CartProvider"
import { CART_COUNT_EVENT, CART_STORAGE_KEY, mapCart } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL, formatPrice } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

// Koszyk w nagłówku: licznik + panel wysuwany po najechaniu, ten sam co dymek
// po dodaniu produktu. Licznik żyje poza `CartProvider` (nagłówek stoi nad
// wszystkimi stronami), więc czyta koszyk sam i nasłuchuje zdarzenia.
export default function CartMenu({ locale = "pl" }: { locale?: string }) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const [cart, setCart] = useState<Cart | null>(null)
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    const id = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!id) {
      setCart(null)
      setCount(0)
      return
    }

    try {
      const response = await fetch(`${MEDUSA_URL}/store/carts/${id}`, {
        headers: { "x-publishable-api-key": MEDUSA_KEY },
      })
      if (!response.ok) throw new Error(String(response.status))

      const data = await response.json()
      const mapped = mapCart(data.cart)
      setCart(mapped)
      setCount(mapped.itemCount)
    } catch {
      setCart(null)
      setCount(0)
    }
  }, [])

  useEffect(() => {
    load()

    // Po dodaniu produktu licznik ma się odświeżyć od razu, a panel pokazać
    // aktualną zawartość, gdy klient na niego najedzie.
    const onCount = (event: Event) => {
      setCount(Number((event as CustomEvent).detail) || 0)
      load()
    }

    window.addEventListener(CART_COUNT_EVENT, onCount)
    return () => window.removeEventListener(CART_COUNT_EVENT, onCount)
  }, [load])

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }, [])

  function show() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpen(true)
  }

  // Krótka zwłoka, żeby panel nie znikał przy przejściu myszą z ikony na listę.
  function hide() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 180)
  }

  const lines = cart?.lines || []

  return (
    <div
      className="relative order-2 shrink-0 xl:order-4"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <a
        href={localeHref(current, "/sklep/koszyk")}
        className="flex items-center gap-2 whitespace-nowrap py-2 text-base font-bold text-[#111827] transition hover:text-[#4854A7]"
      >
        <span className="hidden sm:inline">{t.shopCart}</span>
        <span aria-hidden className="text-lg sm:hidden">
          🛒
        </span>
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold transition ${
            count ? "bg-[#4854A7] text-white" : "bg-[#111827]/8 text-[#111827]/45"
          }`}
        >
          {count}
        </span>
      </a>

      {/* Panel tylko na wskaźniku — na dotyku odnośnik prowadzi do koszyka. */}
      <div
        className={`absolute right-0 top-full z-50 hidden w-[22rem] border border-[#0E1A2B]/10 bg-white shadow-[0_30px_70px_-30px_rgba(14,26,43,0.55)] transition duration-200 lg:block ${
          open
            ? "visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-2 opacity-0"
        }`}
      >
        <p className="border-b border-[#0E1A2B]/10 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/45">
          {t.shopCart}
        </p>

        {lines.length ? (
          <>
            <ul className="max-h-[22rem] overflow-y-auto">
              {lines.slice(0, 5).map((line) => (
                <li
                  key={line.id}
                  className="flex items-center gap-4 border-b border-[#0E1A2B]/8 px-5 py-3 last:border-0"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-white">
                    {line.thumbnail ? (
                      <img
                        src={line.thumbnail}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[13px] leading-5 text-[#0E1A2B]">
                      {line.title}
                    </span>
                    <span className="mt-1 block text-[12px] text-[#0E1A2B]/45">
                      {line.quantity} × {formatPrice(line.unitPrice)}
                    </span>
                  </span>

                  <span className="shrink-0 text-sm font-semibold">{formatPrice(line.total)}</span>
                </li>
              ))}
            </ul>

            {lines.length > 5 ? (
              <p className="px-5 pt-3 text-[12px] text-[#0E1A2B]/45">
                + {lines.length - 5}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-[#0E1A2B]/10 px-5 py-3">
              <span className="text-sm font-semibold">{formatPrice(cart?.total ?? null)}</span>

              <a
                href={localeHref(current, "/sklep/koszyk")}
                className="rounded-sm bg-[#0E1A2B] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8]"
              >
                {t.shopGoToCart}
              </a>
            </div>
          </>
        ) : (
          <p className="px-5 py-6 text-sm text-[#0E1A2B]/50">{t.shopCartEmpty}</p>
        )}
      </div>
    </div>
  )
}
