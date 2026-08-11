import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductCard from "@/components/shop/ProductCard"
import ShopNav from "@/components/shop/ShopNav"
import { notFound } from "next/navigation"
import { CartProvider } from "@/components/shop/CartProvider"
import {
  ShopAnnouncement,
  ShopContactBand,
  ShopPageHeader,
  ShopTrust,
} from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories, getShopCategory, getShopProducts } from "@/lib/medusa"
import { buildShopMenu } from "@/lib/shop-taxonomy"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export const revalidate = 300

const PAGE_SIZE = 24

type CategoryPageProps = {
  params: Promise<{ locale: string; handle: string }>
  searchParams?: Promise<{ strona?: string }>
}

export default async function ShopCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, handle } = await params
  const search = (await searchParams) || {}
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const category = await getShopCategory(handle)
  if (!category) {
    notFound()
  }

  const page = Math.max(1, Number(search.strona) || 1)

  const [{ products, count }, categories] = await Promise.all([
    getShopProducts({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      categoryId: category.id,
    }),
    getShopCategories(),
  ])

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  // Dział, w którym mieści się ta kategoria — jego pozycje pokazujemy jako chipsy.
  const menu = buildShopMenu(categories)
  const group =
    menu.find((item) => item.children.some((child) => child.handle === category.handle)) ||
    menu.find((item) => item.handle === category.handle)

  const siblings = (group?.children || []).filter((child) => child.handle !== group?.handle)

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <Header locale={current} />
      <ShopNav locale={current} categories={categories} activeHandle={category.handle} />

      <ShopPageHeader
        locale={current}
        title={category.name}
        meta={`${count} ${t.shopProducts}`}
      />

      {/* Rodzeństwo w dziale — na dotyku nie ma najechania na menu */}
      {siblings.length ? (
        <div className="border-b border-[#0E1A2B]/10 bg-white">
          <div className={`${shop.container} flex flex-wrap gap-2 pb-6`}>
            {siblings.map((item) => (
              <a
                key={item.handle}
                href={href(`/sklep/kategoria/${item.handle}`)}
                className={`rounded-sm border px-4 py-2 text-[13px] transition ${
                  item.handle === category.handle
                    ? "border-[#0E1A2B] bg-[#0E1A2B] text-white"
                    : "border-[#0E1A2B]/15 text-[#0E1A2B]/65 hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                }`}
              >
                {item.label}
                <span className="ml-2 text-[11px] tabular-nums opacity-50">
                  {item.productCount}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <section className={`${shop.container} py-14 md:py-20`}>
        {products.length ? (
          <CartProvider>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  href={href(
                    `/sklep/kategoria/${category.handle}${item > 1 ? `?strona=${item}` : ""}`
                  )}
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
      </section>

      <ShopTrust locale={current} />
      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
