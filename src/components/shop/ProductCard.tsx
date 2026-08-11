import QuickAdd from "@/components/shop/QuickAdd"
import { formatPrice } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import { localeHref, normalizeLocale } from "@/lib/i18n"

type ProductCardProps = {
  product: ShopProduct
  locale?: string
  quickAdd?: boolean
}

// Karta produktu: duży kwadratowy kadr, mocna cena i dodawanie do koszyka
// wprost z listy. Przycisk jest poza linkiem — zagnieżdżanie byłoby błędem HTML.
export default function ProductCard({ product, locale = "pl", quickAdd }: ProductCardProps) {
  const current = normalizeLocale(locale)

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <a
        href={localeHref(current, `/sklep/produkt/${product.handle}`)}
        className="flex flex-1 flex-col"
      >
        <div className="flex aspect-square items-center justify-center overflow-hidden bg-white p-5">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.title}
              className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="h-full w-full rounded bg-[#f6f5f2]" />
          )}
        </div>

        <div className="flex flex-1 flex-col border-t border-[#111827]/8 p-5">
          {product.categories[0] ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/40">
              {product.categories[0].name}
            </p>
          ) : null}

          <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6">{product.title}</h3>

          <p className="mt-auto pt-4 text-xl font-bold tracking-tight text-[#111827]">
            {formatPrice(product.price)}
          </p>
        </div>
      </a>

      {quickAdd && product.variants[0]?.id ? (
        <div className="px-5 pb-5">
          <QuickAdd variantId={product.variants[0].id} locale={current} />
        </div>
      ) : null}
    </div>
  )
}
