"use client"

import { useEffect, useState } from "react"
import { CART_COUNT_EVENT, CART_STORAGE_KEY } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL } from "@/lib/medusa"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type NavCategory = { id: string; name: string; handle: string; productCount?: number }

type ShopNavProps = {
  locale?: string
  categories: NavCategory[]
  activeHandle?: string
}

// Pasek sklepu pod nagłówkiem: sześć działów z rozwijanymi podkategoriami
// (kategorie z Medusy są płaskie — porządek nakłada `shop-taxonomy`)
// oraz koszyk z licznikiem. Licznik żyje poza CartProvider, więc czyta
// koszyk sam i nasłuchuje zdarzenia z providera.
export default function ShopNav({ locale = "pl", categories, activeHandle }: ShopNavProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const menu = buildShopMenu(categories)
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
    <div className="relative z-40 border-b border-[#0E1A2B]/10 bg-white">
      <div className="mx-auto flex max-w-[1500px] items-stretch gap-2 px-5 md:px-8">
        {/* Przewijanie tylko na wąskich ekranach; od `md` overflow musi być
            widoczny, inaczej kontener przycina rozwijane menu (i pokazuje suwak). */}
        <nav
          className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:overflow-visible [&::-webkit-scrollbar]:hidden"
          aria-label={t.shopCategories}
        >
          <a
            href={href("/sklep/produkty")}
            className="flex shrink-0 items-center px-3 py-4 text-[15px] font-medium text-[#0E1A2B]/65 transition hover:text-[#2E64A8]"
          >
            {t.shopAllProducts}
          </a>

          {menu.map((group) => {
            const isActive =
              group.handle === activeHandle ||
              group.children.some((child) => child.handle === activeHandle)

            return (
              <div key={group.handle} className="group relative shrink-0">
                <a
                  href={href(`/sklep/kategoria/${group.handle}`)}
                  className={`flex items-center gap-1.5 px-3 py-4 text-[15px] font-medium transition ${
                    isActive
                      ? "text-[#0E1A2B]"
                      : "text-[#0E1A2B]/65 group-hover:text-[#0E1A2B]"
                  }`}
                >
                  {group.label}
                  {group.children.length ? (
                    <span className="text-[10px] text-[#0E1A2B]/30 transition group-hover:text-[#2E64A8]">
                      ▾
                    </span>
                  ) : null}
                </a>

                {/* Podkreślenie aktywnego działu */}
                <span
                  className={`pointer-events-none absolute inset-x-3 bottom-0 h-[2px] transition ${
                    isActive ? "bg-[#0E1A2B]" : "bg-transparent group-hover:bg-[#2E64A8]/40"
                  }`}
                />

                {group.children.length ? (
                  <div className="invisible absolute left-0 top-full z-50 min-w-[280px] translate-y-1 border border-[#0E1A2B]/10 bg-white p-2 opacity-0 shadow-[0_20px_60px_-30px_rgba(14,26,43,0.5)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    {group.lead ? (
                      <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/35">
                        {group.lead}
                      </p>
                    ) : null}

                    {group.children.map((child) => (
                      <a
                        key={child.handle}
                        href={href(`/sklep/kategoria/${child.handle}`)}
                        className={`flex items-center justify-between gap-6 py-2.5 pr-3 text-[14px] transition hover:bg-[#F4F1EC] ${
                          child.section
                            ? "mt-1 border-t border-[#0E1A2B]/10 pl-3 pt-4 font-semibold text-[#0E1A2B]"
                            : "pl-6 text-[#0E1A2B]/70 hover:text-[#0E1A2B]"
                        } ${child.handle === activeHandle ? "font-semibold text-[#0E1A2B]" : ""}`}
                      >
                        {child.label}
                        <span className="text-[11px] tabular-nums text-[#0E1A2B]/30">
                          {child.productCount}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        <a
          href={href("/sklep/koszyk")}
          className="flex shrink-0 items-center gap-2 border-l border-[#0E1A2B]/10 pl-5 text-[15px] font-medium text-[#0E1A2B] transition hover:text-[#2E64A8]"
        >
          {t.shopCart}
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
              count ? "bg-[#2E64A8] text-white" : "bg-[#0E1A2B]/8 text-[#0E1A2B]/45"
            }`}
          >
            {count}
          </span>
        </a>
      </div>
    </div>
  )
}
