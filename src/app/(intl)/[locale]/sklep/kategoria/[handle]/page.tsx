import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopHeader from "@/components/shop/ShopHeader"
import ShopFilters, { ActiveFilterChips } from "@/components/shop/ShopFilters"
import { notFound } from "next/navigation"
import { CartProvider } from "@/components/shop/CartProvider"
import CartFlyout from "@/components/shop/CartFlyout"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopPageHeader,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories, getShopCategory, getShopProducts } from "@/lib/medusa"
import { HIDDEN_SHOP_CATEGORIES, buildShopMenu, findMenuGroup, getDepartmentSources } from "@/lib/shop-taxonomy"
import ShopSubnav from "@/components/shop/ShopSubnav"
import CategoryTiles from "@/components/shop/CategoryTiles"
import DepartmentOverview from "@/components/shop/DepartmentOverview"
import ProductRail from "@/components/shop/ProductRail"
import ShopSection from "@/components/shop/ShopSection"
import FiltersDrawer from "@/components/shop/FiltersDrawer"
import {
  applyFilters,
  availabilityCounts,
  brandCounts,
  parseFilters,
  technicalFacets,
} from "@/lib/shop-filters"
import { getShopLifestyle, pickLifestyle } from "@/lib/shop-lifestyle"
import { getAvailability } from "@/lib/availability"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { clampDescription, localeAlternates } from "@/lib/seo"
import { getContentTranslations, translate, translateProducts } from "@/lib/content-translations"

export const revalidate = 300

const PAGE_SIZE = 24

type CategoryPageProps = {
  params: Promise<{ locale: string; handle: string }>
  searchParams?: Promise<Record<string, string | undefined>>
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { locale, handle } = await params
  const category = await getShopCategory(handle)
  if (!category) return {}

  const lead =
    (typeof category.metadata?.opis === "string" ? category.metadata.opis : "") ||
    category.description ||
    `${category.name} w sklepie Marinero — części, akcesoria i elektronika do łodzi. Wysyłka i odbiór osobisty w Gdyni.`

  return {
    title: `${category.name} — sklep`,
    description: clampDescription(lead),
    alternates: localeAlternates(locale, `/sklep/kategoria/${handle}`),
  }
}

export default async function ShopCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, handle } = await params
  const search = (await searchParams) || {}
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  // Kategorie schowane (duplikaty i worki po imporcie z WooCommerce) nie mają
  // własnej strony — inaczej zostawałyby dostępne z wyszukiwarki Google.
  if (HIDDEN_SHOP_CATEGORIES.has(handle)) notFound()

  const category = await getShopCategory(handle)
  if (!category) {
    notFound()
  }

  const page = Math.max(1, Number(search.strona) || 1)
  const filters = parseFilters(search)

  const [categories, lifestyle] = await Promise.all([getShopCategories(), getShopLifestyle()])

  // „Elektronika" nie ma w Medusie własnego worka na towar — leży on
  // w `garmin`, `lowrance` i `mapy`. Dział zbieramy więc z kilku kategorii
  // naraz, zamiast (jak wcześniej) podszywać dział pod uchwyt marki.
  const sources = getDepartmentSources(category.handle)
  const categoryIds = sources
    ? categories.filter((item) => sources.includes(item.handle)).map((item) => item.id)
    : [category.id]

  // Kategoria może mieć więcej niż stronę wyników (Silniki: 170), a filtry
  // liczymy na pełnej liście — dociągamy resztę stronami po 100.
  const listing = await getShopProducts({ limit: 100, categoryIds })

  const all = [...listing.products]
  for (let offset = 100; offset < Math.min(listing.count, 400); offset += 100) {
    const chunk = await getShopProducts({ limit: 100, offset, categoryIds })
    all.push(...chunk.products)
  }
  const filtered = applyFilters(all, filters)

  // Sortowanie po naszej stronie — listę i tak trzymamy w całości, żeby liczyć
  // filtry, więc nie ma po co pytać Medusy drugi raz.
  const sorted = [...filtered].sort((a, b) => {
    if (filters.sort === "cena-rosnaco") return (a.price ?? 1e12) - (b.price ?? 1e12)
    if (filters.sort === "cena-malejaco") return (b.price ?? -1) - (a.price ?? -1)
    return 0
  })

  // Tłumaczenia treści z paneli. Wchodzą **po** filtrach i sortowaniu:
  // filtry techniczne czytają polski tytuł produktu (moc, kolumna, sterowanie).
  const tresc = await getContentTranslations(current)
  const products = translateProducts(tresc, sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))

  // Dział, w którym mieści się ta kategoria — jego pozycje idą do filtrów.
  const menu = buildShopMenu(categories)
  const group = findMenuGroup(menu, category.handle) || undefined

  const prices = all.map((item) => item.price).filter((price): price is number => price !== null)

  // Szyna „wysyłamy od ręki" — konkret zamiast wymyślonych bestsellerów.
  // Pokazujemy ją tylko przy dużych kategoriach, żeby nie powielać siatki.
  const inStock =
    all.length > 12
      ? all
          .filter((item) => item.thumbnail && typeof item.price === "number")
          .filter((item) => getAvailability(item.metadata, item.title).code === "od-reki")
          .slice(0, 10)
      : []
  const inStockDisplay = translateProducts(tresc, inStock)

  // Opis kategorii redaguje sprzedawca w panelu Medusy.
  const lead = translate(
    tresc,
    (typeof category.metadata?.opis === "string" ? category.metadata.opis : "") ||
      category.description ||
      ""
  )
  const categoryName = translate(tresc, category.name)

  const basePath = `/sklep/kategoria/${category.handle}`

  // Przegląd działu ma sens tylko na wejściu: gdy stoimy na dziale, mamy
  // z czego zbudować bloki i nikt jeszcze nie sięgnął po filtry ani sortowanie.
  const untouched = !Object.entries(search).some(([key, value]) => value && key !== "strona")
  const overview = Boolean(
    group &&
      group.handle === category.handle &&
      untouched &&
      page === 1 &&
      group.children.filter((child) => !child.section).length >= 2 &&
      all.length > 24
  )

  const pageHref = (target: number) => {
    const merged: Record<string, string> = {}
    for (const [key, value] of Object.entries(search)) {
      if (value && key !== "strona") merged[key] = value
    }
    if (target > 1) merged.strona = String(target)
    const query = new URLSearchParams(merged).toString()
    return href(`${basePath}${query ? `?${query}` : ""}`)
  }

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} activeHandle={category.handle} />

      <ShopPageHeader
        locale={current}
        title={categoryName}
        meta={`${filtered.length} ${t.shopProducts}`}
        lead={lead}
        image={pickLifestyle(lifestyle, category.handle)?.image}
      />

      {/* Podkategorie działu — bez nich „Elektronika" wysypywała wszystkie
          marki naraz i Garmina trzeba było szukać ręcznie. */}
      {/* Na wejściu w dział pokazujemy kafelki z ikonami — widać od razu,
          co jest w środku. Wewnątrz podkategorii zostają chipsy do skakania
          na boki, bo tam liczy się szybka zmiana, nie przegląd struktury. */}
      {group && group.handle === category.handle ? (
        <CategoryTiles
          title={t.shopCategories}
          items={group.children.map((child) => ({
            label: child.label,
            href: href(`/sklep/kategoria/${child.handle}`),
            handle: child.handle,
            count: child.productCount,
            section: child.section,
          }))}
        />
      ) : null}

      {group && group.handle !== category.handle ? (
        <ShopSubnav
          title={group.label}
          items={[
            {
              label: t.shopBrowseAll,
              href: href(`/sklep/kategoria/${group.handle}`),
              count: group.productCount,
              active: group.handle === category.handle,
            },
            ...group.children.map((child) => ({
              label: child.label,
              href: href(`/sklep/kategoria/${child.handle}`),
              count: child.productCount,
              active: child.handle === category.handle,
              section: child.section,
            })),
          ]}
        />
      ) : null}

      {/* Konkret nad listą: co wyjedzie z magazynu tego samego dnia. */}
      {inStock.length >= 4 ? (
        <CartProvider>
          <ShopSection compact banded eyebrow={t.shopAvailability} title={t.shopInStock}>
            <ProductRail compact products={inStockDisplay} locale={current} />
          </ShopSection>
        </CartProvider>
      ) : null}

      {/* Przegląd działu zamiast ściany produktów — ale tylko dopóki nikt
          nie sięgnął po filtry. Włączony filtr znaczy „chcę listę", więc
          wtedy wraca zwykła siatka z lewą szyną. */}
      {overview && group ? (
        <CartProvider>
          <CartFlyout locale={current} />
          <DepartmentOverview
            group={group}
            products={translateProducts(tresc, all)}
            locale={current}
            href={href}
            labels={{ browseAll: t.shopBrowseAll, products: t.shopProducts }}
          />
        </CartProvider>
      ) : (
      <section className={`${shop.container} py-10 md:py-14`}>
        <div className="grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
          {/* Na telefonie filtry to jeden przycisk (`FiltersDrawer`), więc
              mogą stać nad produktami — panel wysuwa się dopiero po kliknięciu. */}
          <div className="lg:order-none">
          <FiltersDrawer
            locale={current}
            total={filtered.length}
            active={Object.keys(search).filter((key) => key !== "strona" && search[key]).length}
          >
          <ShopFilters
            locale={current}
            basePath={basePath}
            params={search}
            filters={filters}
            brands={brandCounts(all)}
            availability={availabilityCounts(all)}
            group={group}
            activeHandle={category.handle}
            priceRange={
              prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined
            }
            technical={technicalFacets(all, filters)}
            total={filtered.length}
          />
          </FiltersDrawer>
          </div>

          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <ActiveFilterChips locale={current} basePath={basePath} params={search} />

              <form action={href(basePath)} className="ml-auto flex items-center gap-2">
                {Object.entries(search)
                  .filter(([key, value]) => value && !["sort", "strona"].includes(key))
                  .map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                  ))}

                <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/40">
                  {t.shopSort}
                </label>
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  className="rounded-sm border border-[#0E1A2B]/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0E1A2B]"
                >
                  <option value="">{t.shopSortNewest}</option>
                  <option value="cena-rosnaco">{t.shopSortPriceAsc}</option>
                  <option value="cena-malejaco">{t.shopSortPriceDesc}</option>
                </select>
                <button
                  type="submit"
                  className="rounded-sm border border-[#0E1A2B]/15 px-3 py-2 text-sm text-[#0E1A2B]/60 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                >
                  →
                </button>
              </form>
            </div>

            {products.length ? (
              <CartProvider>
        <CartFlyout locale={current} />
                <div className={shop.gridNarrow}>
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} locale={current} quickAdd />
                  ))}
                </div>
              </CartProvider>
            ) : (
              <p className="py-16 text-center text-[#0E1A2B]/45">{t.shopNoResults}</p>
            )}

            {pages > 1 ? (
              <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
                {Array.from({ length: pages }, (_, index) => index + 1)
                  .filter((item) => item === 1 || item === pages || Math.abs(item - page) <= 2)
                  .map((item) => (
                    <a
                      key={item}
                      href={pageHref(item)}
                      className={`min-w-[44px] rounded-sm px-3 py-2.5 text-center text-sm font-bold transition ${
                        item === page
                          ? "bg-[#0E1A2B] text-white"
                          : "border border-[#0E1A2B]/15 text-[#0E1A2B]/60 hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                      }`}
                    >
                      {item}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      )}

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
