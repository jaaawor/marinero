import ProductRail from "@/components/shop/ProductRail"
import { shop } from "@/components/shop/theme"
import type { ShopProduct } from "@/lib/medusa"
import type { ShopBrandTeaser } from "@/lib/shop-brands"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type BrandTeaserProps = {
  brand: ShopBrandTeaser
  products: ShopProduct[]
  locale?: string
  /** Kadr zastępczy, gdy nie mamy zdjęcia marki. */
  fallbackImage?: string
  /** Zdjęcie po prawej zamiast po lewej — bloki mają się przeplatać. */
  reverse?: boolean
}

// Zajawka marki: kadr, krótkie hasło i szyna produktów tej marki.
// Wzorzec: garmin.com, gdzie każda rodzina sprzętu dostaje własny blok,
// zamiast tonąć w jednej wspólnej liście.
export default function BrandTeaser({
  brand,
  products,
  locale = "pl",
  fallbackImage,
  reverse,
}: BrandTeaserProps) {
  if (!products.length) return null

  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const image = brand.image || fallbackImage || ""

  const allHref = brand.categoryHandle
    ? localeHref(current, `/sklep/kategoria/${brand.categoryHandle}`)
    : localeHref(current, `/sklep/produkty?marka=${encodeURIComponent(brand.name)}`)

  return (
    // Delikatne tło co drugi blok — inaczej cztery zajawki z rzędu zlewały się
    // w jedną białą płachtę. Kropki zamiast pełnego piasku, żeby blok nie ciążył.
    <section className={`${shop.section} ${reverse ? "bg-sand-dots" : "bg-white"}`}>
      <div className={shop.container}>
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className={`relative aspect-[16/10] overflow-hidden ${reverse ? "lg:order-2" : ""}`}>
            {image ? (
              <img src={image} alt={brand.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[#F4F1EC]" />
            )}
          </div>

          <div className={reverse ? "lg:order-1" : ""}>
            <img
              src={brand.logo}
              alt={brand.name}
              className="h-6 w-auto object-contain opacity-70"
            />

            <p className={`${shop.eyebrow} mt-6`}>{brand.eyebrow}</p>

            <h2 className={`${shop.display} mt-4 text-3xl md:text-[2.5rem]`}>{brand.title}</h2>

            <p className="mt-5 max-w-xl text-base leading-8 text-[#0E1A2B]/55">{brand.lead}</p>

            <div className="mt-8">
              <a href={allHref} className={shop.btnGhost}>
                {t.shopBrowseAll}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-9">
          <ProductRail products={products} locale={current} />
        </div>
      </div>
    </section>
  )
}
