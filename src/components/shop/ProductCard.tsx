import QuickAdd from "@/components/shop/QuickAdd"
import { formatPrice } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { availabilityDotClass, getAvailability } from "@/lib/availability"

type ProductCardProps = {
  product: ShopProduct
  locale?: string
  quickAdd?: boolean
}

// Kafelek produktu: duży kadr na piaskowym tle, bez ramek i cieni,
// z przyciskiem odsłanianym przy najechaniu (na dotyku zawsze widoczny).
export default function ProductCard({ product, locale = "pl", quickAdd }: ProductCardProps) {
  const current = normalizeLocale(locale)
  const availability = getAvailability(product.metadata, product.title)

  return (
    <div className="group relative flex flex-col">
      <a href={localeHref(current, `/sklep/produkt/${product.handle}`)} className="flex flex-col">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-white p-8">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.title}
              className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="h-full w-full bg-[#F4F1EC]" />
          )}

          {quickAdd && product.variants[0]?.id ? (
            <div className="absolute inset-x-4 bottom-4 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100">
              <QuickAdd variantId={product.variants[0].id} locale={current} />
            </div>
          ) : null}
        </div>

        <div className="pt-5">
          {product.categories[0] ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
              {product.categories[0].name}
            </p>
          ) : null}

          <h3 className="mt-2.5 line-clamp-2 text-[15px] font-medium leading-6 text-[#0E1A2B]">
            {product.title}
          </h3>

          <p className="mt-3 text-base font-semibold tracking-[-0.01em] text-[#0E1A2B]">
            {formatPrice(product.price)}
          </p>

          <p className="mt-2 flex items-center gap-2 text-[12px] text-[#0E1A2B]/45">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${availabilityDotClass(
                availability.tone
              )}`}
            />
            {availability.short}
          </p>
        </div>
      </a>
    </div>
  )
}
