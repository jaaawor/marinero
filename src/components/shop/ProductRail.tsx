import ProductCard from "@/components/shop/ProductCard"
import type { ShopProduct } from "@/lib/medusa"

type ProductRailProps = {
  products: ShopProduct[]
  locale?: string
}

// Szyna produktów przewijana w poziomie — mieści 10–12 pozycji na tej samej
// wysokości strony, na której siatka pokazywała cztery. Kadry są te same
// (`shop.tile`), więc rytm strony się nie psuje.
export default function ProductRail({ products, locale = "pl" }: ProductRailProps) {
  if (!products.length) return null

  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:thin] md:-mx-8 md:px-8">
      <div className="flex snap-x snap-mandatory gap-4 pb-2 sm:gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[43vw] shrink-0 snap-start sm:w-[30vw] lg:w-[calc((100%-4*1.5rem)/5)] lg:max-w-[280px]"
          >
            <ProductCard product={product} locale={locale} quickAdd />
          </div>
        ))}
      </div>
    </div>
  )
}
