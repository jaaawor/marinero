"use client"

import { useEffect, useRef, useState } from "react"
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

// Pasek sklepu: przyklejony do góry przy przewijaniu i celowo inny od nagłówka
// strony (ciemny znacznik „Sklep", wyszukiwarka produktów, koszyk z licznikiem),
// żeby było jasne, że jest się w sklepie, a nie w części z łodziami.
// Działy z `shop-taxonomy` — kategorie z Medusy są płaską listą po imporcie.
export default function ShopNav({ locale = "pl", categories, activeHandle }: ShopNavProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const menu = buildShopMenu(categories)
  const [count, setCount] = useState(0)
  // Logo w pasku ma się pojawić dopiero, gdy nagłówek serwisu zjedzie w górę —
  // inaczej po wejściu na stronę widać dwa loga jedno pod drugim.
  const [stuck, setStuck] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = sentinel.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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
      {/* Znacznik pozycji paska — po jego zniknięciu pasek jest przyklejony */}
      <div ref={sentinel} aria-hidden className="h-px w-full" />

    <div className="sticky top-0 z-50 border-b border-[#0E1A2B]/12 bg-white shadow-[0_6px_24px_-18px_rgba(14,26,43,0.7)]">
      <div className="mx-auto flex max-w-[1500px] items-stretch gap-3 px-5 md:gap-5 md:px-8">
        {/* Nagłówek serwisu odjeżdża przy przewijaniu, więc marka i wyjście
            na stronę główną muszą być tutaj. */}
        <a
          href={href("/")}
          aria-hidden={!stuck}
          className={`hidden shrink-0 items-center overflow-hidden transition-all duration-200 lg:flex ${
            stuck ? "w-[150px] pr-4 opacity-100" : "w-0 pr-0 opacity-0"
          }`}
        >
          <img src="/logo-marinero.png" alt="Marinero" className="h-6 w-auto object-contain" />
        </a>

        {/* Znacznik sklepu — od razu widać, w której części serwisu się jest */}
        <a
          href={href("/sklep")}
          className="my-2.5 flex shrink-0 items-center gap-2 rounded-sm bg-[#0E1A2B] px-3.5 text-[12px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-[#2E64A8] md:px-4"
        >
          {t.shopTitle}
        </a>

        {/* Przewijanie tylko na wąskich ekranach; od `md` overflow musi być
            widoczny, inaczej kontener przycina rozwijane menu (i pokazuje suwak). */}
        <nav
          className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:gap-1 md:overflow-visible [&::-webkit-scrollbar]:hidden"
          aria-label={t.shopCategories}
        >
          {menu.map((group) => {
            const isActive =
              group.handle === activeHandle ||
              group.children.some((child) => child.handle === activeHandle)

            return (
              <div key={group.handle} className="group relative shrink-0">
                <a
                  href={href(`/sklep/kategoria/${group.handle}`)}
                  className={`flex items-center gap-1.5 px-3 py-4 text-[15px] font-semibold tracking-[-0.01em] transition ${
                    isActive ? "text-[#0E1A2B]" : "text-[#0E1A2B]/70 group-hover:text-[#0E1A2B]"
                  }`}
                >
                  {group.label}
                  {group.children.length ? (
                    <span className="text-[10px] text-[#0E1A2B]/30 transition group-hover:text-[#2E64A8]">
                      ▾
                    </span>
                  ) : null}
                </a>

                <span
                  className={`pointer-events-none absolute inset-x-2 bottom-0 h-[3px] transition ${
                    isActive ? "bg-[#2E64A8]" : "bg-transparent group-hover:bg-[#2E64A8]/40"
                  }`}
                />

                {group.children.length ? (
                  <div className="invisible absolute left-0 top-full z-50 min-w-[300px] translate-y-1 border border-[#0E1A2B]/10 bg-white p-2 opacity-0 shadow-[0_24px_70px_-30px_rgba(14,26,43,0.55)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
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

        {/* Wyszukiwarka produktów — inna niż wyszukiwarka modeli w nagłówku */}
        <form
          action={href("/sklep/produkty")}
          className="my-2.5 hidden shrink-0 items-center lg:flex"
        >
          <input
            type="search"
            name="q"
            placeholder={t.shopSearchPlaceholder}
            aria-label={t.shopSearchPlaceholder}
            className="w-52 rounded-sm border border-[#0E1A2B]/15 bg-[#F4F1EC] px-4 py-2.5 text-sm outline-none transition focus:border-[#0E1A2B] focus:bg-white xl:w-64"
          />
        </form>

        <a
          href={href("/sklep/koszyk")}
          className="flex shrink-0 items-center gap-2 border-l border-[#0E1A2B]/10 pl-4 text-[15px] font-semibold text-[#0E1A2B] transition hover:text-[#2E64A8] md:pl-5"
        >
          <span className="hidden sm:inline">{t.shopCart}</span>
          <span aria-hidden className="sm:hidden">
            🛒
          </span>
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
    </>
  )
}
