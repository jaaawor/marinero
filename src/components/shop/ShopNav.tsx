"use client"

import { useEffect, useState } from "react"
import { CART_COUNT_EVENT, CART_STORAGE_KEY } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type NavCategory = { id: string; name: string; handle: string }

type ShopNavProps = {
  locale?: string
  categories: NavCategory[]
  activeHandle?: string
}

// Pasek sklepu pod nagłówkiem: kategorie + koszyk z licznikiem.
// Licznik żyje poza CartProvider (pasek jest na każdej stronie sklepu),
// więc czyta koszyk sam i nasłuchuje zdarzenia z providera.
export default function ShopNav({ locale = "pl", categories, activeHandle }: ShopNavProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const [count, setCount] = useState(0)

  useEffect(() => {
    const id = window.localStorage.getItem(CART_STORAGE_KEY)
    if (id) {
      fetch(`${MEDUSA_URL}/store/carts/${id}`, {
        headers: { "x-publishable-api-key": MEDUSA_KEY },
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          const items = data?.cart?.items || []
          setCount(items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0))
        })
        .catch(() => setCount(0))
    }

    const onCount = (event: Event) => setCount(Number((event as CustomEvent).detail) || 0)
    window.addEventListener(CART_COUNT_EVENT, onCount)
    return () => window.removeEventListener(CART_COUNT_EVENT, onCount)
  }, [])

  return (
    <div className="sticky top-0 z-40 border-b border-[#0E1A2B]/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-5 py-4 md:px-8">
        <a
          href={href("/sklep")}
          className="shrink-0 text-[12px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B] transition hover:text-[#2E64A8]"
        >
          {t.shopTitle}
        </a>

        <nav className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto">
          {categories.slice(0, 12).map((category) => (
            <a
              key={category.id}
              href={href(`/sklep/kategoria/${category.handle}`)}
              className={`whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.16em] transition ${
                category.handle === activeHandle
                  ? "text-[#0E1A2B] underline underline-offset-8"
                  : "text-[#0E1A2B]/40 hover:text-[#2E64A8]"
              }`}
            >
              {category.name}
            </a>
          ))}
        </nav>

        <a
          href={href("/sklep/koszyk")}
          className="flex shrink-0 items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B] transition hover:text-[#2E64A8]"
        >
          {t.shopCart}
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] ${
              count ? "bg-[#0E1A2B] text-white" : "bg-[#0E1A2B]/10 text-[#0E1A2B]/45"
            }`}
          >
            {count}
          </span>
        </a>
      </div>
    </div>
  )
}
