"use client"

import { useEffect, useState } from "react"
import { CART_COUNT_EVENT, CART_STORAGE_KEY } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL } from "@/lib/medusa"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type NavCategory = { id: string; name: string; handle: string; productCount?: number }

type ShopHeaderNavProps = {
  locale?: string
  categories: NavCategory[]
  activeHandle?: string
}

// Środek nagłówka sklepu: działy z rozwijanym menu, wyszukiwarka produktów
// i koszyk z licznikiem. Licznik żyje poza CartProvider (nagłówek jest nad
// wszystkimi stronami), więc czyta koszyk sam i nasłuchuje zdarzenia.
export default function ShopHeaderNav({
  locale = "pl",
  categories,
  activeHandle,
}: ShopHeaderNavProps) {
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
    <>
      {/* Działy — od `xl`, dokładnie tak jak menu na stronie głównej.
          Niżej nawigacja sklepu siedzi w menu mobilnym. */}
      <nav className="hidden min-w-0 flex-1 items-center gap-1 xl:flex" aria-label={t.shopCategories}>
        {menu.map((group) => {
          const isActive =
            group.handle === activeHandle ||
            group.children.some((child) => child.handle === activeHandle)

          return (
            // Bez `shrink-0`: gdy na wąskim ekranie zabraknie miejsca, nazwa
            // działu ma się przyciąć, a nie wejść na sąsiedni link. Przycinamy
            // sam odnośnik — rozwijane menu jest jego rodzeństwem i zostaje widoczne.
            <div key={group.handle} className="group relative min-w-0">
              <a
                href={href(`/sklep/kategoria/${group.handle}`)}
                className={`flex items-center gap-1 overflow-hidden whitespace-nowrap px-2.5 py-2 text-[15px] font-bold transition 2xl:text-base ${
                  isActive ? "text-[#4854A7]" : "text-[#111827] group-hover:text-[#4854A7]"
                }`}
              >
                <span className="truncate">{group.short || group.label}</span>
                {group.children.length ? (
                  <span className="shrink-0 text-[9px] text-[#111827]/30">▾</span>
                ) : null}
              </a>

              {group.children.length ? (
                <div className="invisible absolute left-0 top-full z-50 min-w-[300px] translate-y-1 border border-[#111827]/10 bg-white p-2 opacity-0 shadow-[0_24px_70px_-30px_rgba(14,26,43,0.55)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  {group.lead ? (
                    <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/35">
                      {group.lead}
                    </p>
                  ) : null}

                  {group.children.map((child) => (
                    <a
                      key={child.handle}
                      href={href(`/sklep/kategoria/${child.handle}`)}
                      className={`flex items-center justify-between gap-6 py-2.5 pr-3 text-[14px] font-normal transition hover:bg-[#f6f5f2] ${
                        child.section
                          ? "mt-1 border-t border-[#111827]/10 pl-3 pt-4 font-semibold text-[#111827]"
                          : "pl-6 text-[#111827]/70 hover:text-[#111827]"
                      } ${child.handle === activeHandle ? "font-semibold text-[#111827]" : ""}`}
                    >
                      {child.label}
                      <span className="text-[11px] tabular-nums text-[#111827]/30">
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
        className="order-2 flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-bold text-[#111827] transition hover:text-[#4854A7] xl:order-4"
      >
        <span className="hidden sm:inline">{t.shopCart}</span>
        <span aria-hidden className="sm:hidden text-lg">
          🛒
        </span>
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
            count ? "bg-[#4854A7] text-white" : "bg-[#111827]/8 text-[#111827]/45"
          }`}
        >
          {count}
        </span>
      </a>
    </>
  )
}
