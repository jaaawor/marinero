"use client"

import CartMenu from "@/components/shop/CartMenu"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type NavCategory = { id: string; name: string; handle: string; productCount?: number }

type ShopHeaderNavProps = {
  locale?: string
  categories: NavCategory[]
  activeHandle?: string
}

// Środek nagłówka sklepu: działy z rozwijanym menu i koszyk (`CartMenu`,
// z panelem wysuwanym po najechaniu).
export default function ShopHeaderNav({
  locale = "pl",
  categories,
  activeHandle,
}: ShopHeaderNavProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const menu = buildShopMenu(categories)

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

      {/* Konto — zwykły odnośnik, nie stan zalogowania. Sprawdzenie ciasteczka
          w nagłówku wyłączyłoby ISR na wszystkich stronach sklepu, a nagłówek
          stoi nad każdą z nich. Kto nie jest zalogowany, ląduje na logowaniu. */}
      <a
        href={href("/sklep/konto")}
        className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-[#111827]/60 transition hover:text-[#4854A7] xl:flex"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4.8 20c.7-3.5 3.6-5.6 7.2-5.6s6.5 2.1 7.2 5.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        Moje konto
      </a>

      <CartMenu locale={current} />
    </>
  )
}
