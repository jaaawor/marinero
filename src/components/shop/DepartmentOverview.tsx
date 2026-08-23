import ProductRail from "@/components/shop/ProductRail"
import { shop } from "@/components/shop/theme"
import type { ShopProduct } from "@/lib/medusa"
import type { ShopMenuGroup } from "@/lib/shop-taxonomy"

type DepartmentOverviewProps = {
  group: ShopMenuGroup
  products: ShopProduct[]
  locale: string
  href: (path: string) => string
  labels: { browseAll: string; products: string }
}

const RAIL_SIZE = 8

/**
 * Przegląd działu zamiast ściany produktów.
 *
 * Wejście w „Silniki" wysypywało 170 pozycji z pięciu półek naraz — pontonowy
 * Suzuki 2,5 KM stał obok Verado 300 KM i klient sam musiał się w tym połapać.
 * Teraz dział pokazuje swoje kategorie: nazwa, jedno zdanie, kilka produktów
 * i wyjście do pełnej listy. Pełna siatka wraca, gdy tylko ktoś włączy filtr.
 */
export default function DepartmentOverview({
  group,
  products,
  locale,
  href,
  labels,
}: DepartmentOverviewProps) {
  const blocks: { section: string; items: typeof group.children }[] = []

  for (const child of group.children) {
    if (child.section) {
      blocks.push({ section: child.label, items: [] })
      continue
    }
    if (!blocks.length) blocks.push({ section: "", items: [] })
    blocks[blocks.length - 1].items.push(child)
  }

  const withProducts = blocks
    .map((block) => ({
      ...block,
      items: block.items.filter((item) =>
        products.some((product) =>
          product.categories.some((category) => category.handle === item.handle)
        )
      ),
    }))
    .filter((block) => block.items.length)

  if (!withProducts.length) return null

  return (
    <>
      {withProducts.map((block, blockIndex) => (
        <section
          key={block.section || blockIndex}
          className={blockIndex % 2 === 1 ? "bg-sand-dots" : "bg-white"}
        >
          <div className={`${shop.container} py-10 md:py-14`}>
            {block.section ? (
              <p className={shop.eyebrow}>{block.section}</p>
            ) : null}

            <div className="mt-6 grid gap-12">
              {block.items.map((item) => {
                const matching = products.filter((product) =>
                  product.categories.some((category) => category.handle === item.handle)
                )

                return (
                  <div key={item.handle}>
                    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
                      <div className="max-w-2xl">
                        <h2 className={`${shop.display} text-2xl md:text-[2rem]`}>
                          <a
                            href={href(`/sklep/kategoria/${item.handle}`)}
                            className="transition hover:text-[#2E64A8]"
                          >
                            {item.label}
                          </a>
                        </h2>

                        {item.lead ? (
                          <p className="mt-3 text-[15px] leading-7 text-[#0E1A2B]/55">
                            {item.lead}
                          </p>
                        ) : null}
                      </div>

                      <a href={href(`/sklep/kategoria/${item.handle}`)} className={shop.link}>
                        {labels.browseAll} ({matching.length}) →
                      </a>
                    </div>

                    <div className="mt-6">
                      <ProductRail
                        compact
                        products={matching.slice(0, RAIL_SIZE)}
                        locale={locale}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
