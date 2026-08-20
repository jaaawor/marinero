import { shop } from "@/components/shop/theme"
import ShopLiveSearch from "@/components/shop/ShopLiveSearch"
import type { SearchItem } from "@/components/shop/ShopLiveSearch"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

export type QuickLink = { label: string; href: string; count: number }

type ShopQuickLinksProps = {
  items: QuickLink[]
  locale?: string
  /** Indeks do wyszukiwarki podpowiadającej na żywo. */
  searchItems?: SearchItem[]
}

// Pas szybkich wejść tuż pod kadrem — wzorem x-kom.pl, gdzie nad treścią stoi
// rząd wejść do najczęściej szukanych działów. Pod nim wyszukiwarka
// podpowiadająca na żywo, bo ta w nagłówku jest schowana pod ikoną.
export default function ShopQuickLinks({
  items,
  locale = "pl",
  searchItems = [],
}: ShopQuickLinksProps) {
  const t = getDictionary(normalizeLocale(locale))
  const links = items.filter((item) => item.count > 0).slice(0, 6)

  if (links.length < 3) return null

  return (
    // Tło pod całym panelem — biała wyszukiwarka na bieli zlewała się z kadrem
    // nad nią. Pełny piaskowy blok był za ciężki, więc zostały same kropki.
    <section className="bg-sand-dots border-b border-[#0E1A2B]/10">
      <div className={`${shop.container} py-8 md:py-10`}>
        {searchItems.length ? (
          <div className="mx-auto mb-7 max-w-2xl">
            <ShopLiveSearch locale={locale} items={searchItems} />
          </div>
        ) : null}

        <p className="text-center text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/30">
          {t.shopPopular}
        </p>

        {/* Pigułki zamiast kafelków z ramką — lżejsze i bez zdjęć,
            żeby nie konkurowały z produktami tuż pod spodem. */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {links.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center gap-2 rounded-full border border-[#0E1A2B]/12 bg-white px-4 py-2 text-[14px] font-medium text-[#0E1A2B]/75 transition hover:border-[#0E1A2B] hover:bg-[#0E1A2B] hover:text-white"
            >
              {item.label}
              <span className="text-[11px] tabular-nums text-[#0E1A2B]/30 transition group-hover:text-white/55">
                {item.count}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
