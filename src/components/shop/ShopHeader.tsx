import { getSiteSettings } from "@/lib/directus"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import MobileMenu from "@/components/MobileMenu"
import ShopHeaderNav from "@/components/shop/ShopHeaderNav"
import ShopSearch from "@/components/shop/ShopSearch"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getSearchIndex } from "@/lib/shop-search"

type NavCategory = { id: string; name: string; handle: string; productCount?: number }

type ShopHeaderProps = {
  locale?: string
  categories: NavCategory[]
  activeHandle?: string
  settings?: any
}

// JEDEN nagłówek dla sklepu — ta sama chrome co na stronie głównej
// (przyklejony, biały, pełne logo, języki, telefon), tylko odnośniki są
// sklepowe. Wcześniej były dwa paski (nagłówek serwisu + ShopNav) i po
// przewinięciu nachodziły na siebie.
export default async function ShopHeader({
  locale = "pl",
  categories,
  activeHandle,
  settings,
}: ShopHeaderProps) {
  const [siteSettings, searchItems] = await Promise.all([
    settings ? Promise.resolve(settings) : getSiteSettings(),
    // Indeks jest wspólny dla obu wyszukiwarek; odpowiedzi Medusy są
    // cache'owane (ISR 5 min), więc nagłówek nie dokłada zapytań.
    getSearchIndex().catch(() => []),
  ])

  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)
  const menu = buildShopMenu(categories)

  return (
    <header className="sticky top-0 z-50 border-b border-[#111827]/10 bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 py-4 md:px-8 xl:gap-5">
        {/* `min-w-0` jak w nagłówku serwisu — na wąskim ekranie logo ustępuje
            koszykowi i menu, zamiast rozpychać pasek poza ekran. */}
        <a href={href("/sklep")} className="flex min-w-0 items-center">
          <img
            src="/logo-marinero.png"
            alt="Marinero"
            className="h-10 w-auto object-contain md:h-11"
          />
        </a>

        <ShopHeaderNav locale={current} categories={categories} activeHandle={activeHandle} />

        {/* Wyszukiwarka: ikona w pasku, pole otwiera się nakładką na pełną
            szerokość — wklejone pole zawsze wyglądało jak doklejone. */}
        <div className="order-1 ml-auto shrink-0 xl:order-2 xl:ml-0">
          <ShopSearch
            locale={current}
            action={href("/sklep/produkty")}
            items={searchItems}
            productPath={href("/sklep/produkt/{handle}")}
            suggestions={menu.map((group) => ({
              label: group.label,
              href: href(`/sklep/kategoria/${group.handle}`),
            }))}
          />
        </div>

        {/* Koszyk zostaje skrajnie po prawej (order-4), więc te linki idą przed nim */}
        <div className="hidden shrink-0 items-center gap-3 xl:order-3 xl:flex xl:gap-4">
          {/* Jedyne wyjście do części z łodziami — celowo wyciszone. */}
          <a
            href={href("/")}
            className="whitespace-nowrap text-[13px] font-medium text-[#111827]/50 transition hover:text-[#4854A7]"
          >
            {t.navBoats}
          </a>

          <LanguageSwitcher locale={current} />

          <a
            href={`tel:${siteSettings?.phone || "+48"}`}
            className="hidden whitespace-nowrap rounded-md bg-[#4854A7] px-5 py-2.5 text-base font-bold text-white transition hover:bg-[#3C468C] min-[1400px]:inline-block"
          >
            {t.navCall}
          </a>
        </div>

        {/* Na wąskim ekranie działy i języki siedzą w menu — pasek zostawiamy
            logo i koszykowi, inaczej logo ściska się do nieczytelnego paska. */}
        <div className="order-3 flex shrink-0 items-center gap-2 xl:hidden">
          <MobileMenu
            phone={siteSettings?.phone}
            variant="shop"
            links={[
              { label: t.shopAllProducts, href: href("/sklep/produkty") },
              { label: t.shopCart, href: href("/sklep/koszyk") },
              { label: t.navBoats, href: href("/") },
              { label: t.navContact, href: href("/kontakt") },
              { label: t.footerPrivacy, href: href("/polityka-prywatnosci") },
            ]}
            groups={menu.map((group) => ({
              label: group.label,
              href: href(`/sklep/kategoria/${group.handle}`),
              children: group.children.map((child) => ({
                label: child.label,
                href: href(`/sklep/kategoria/${child.handle}`),
                count: child.productCount,
                section: child.section,
              })),
            }))}
            extra={<LanguageSwitcher locale={current} />}
          />
        </div>
      </div>
    </header>
  )
}
