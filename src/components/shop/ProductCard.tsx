import { formatPrice } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import { localeHref, normalizeLocale } from "@/lib/i18n"

type ProductCardProps = {
  product: ShopProduct
  locale?: string
}

// Karta produktu w tym samym idiomie co karty modeli łodzi.
export default function ProductCard({ product, locale = "pl" }: ProductCardProps) {
  const current = normalizeLocale(locale)

  return (
    <a
      href={localeHref(current, `/sklep/produkt/${product.handle}`)}
      className="flex flex-col overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex h-56 items-center justify-center bg-white p-4">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="h-full w-full object-contain"
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

        <p className="mt-auto pt-4 text-lg font-bold text-[#2E64A8]">
          {formatPrice(product.price)}
        </p>
      </div>
    </a>
  )
}
