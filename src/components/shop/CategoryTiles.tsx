import CategoryIcon from "@/components/shop/CategoryIcon"
import { shop } from "@/components/shop/theme"

export type CategoryTile = {
  label: string
  href: string
  handle: string
  count: number
  /** Nagłówek sekcji w taksonomii — nie jest osobną kategorią do klikania. */
  section?: boolean
}

type CategoryTilesProps = {
  title: string
  items: CategoryTile[]
}

// Wejście w dział („Elektronika") pokazuje najpierw, co jest w środku —
// kafelki z ikoną i liczbą pozycji, a dopiero pod nimi lista produktów.
// Sama lista 34 rzeczy z różnych półek nie mówiła klientowi nic o strukturze.
export default function CategoryTiles({ title, items }: CategoryTilesProps) {
  const tiles = items.filter((item) => !item.section && item.count > 0)
  if (tiles.length < 2) return null

  return (
    <section className="bg-sand-dots border-b border-[#0E1A2B]/10">
      <div className={`${shop.container} py-9 md:py-11`}>
        <p className={shop.eyebrow}>{title}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {tiles.map((tile) => (
            <a
              key={tile.href}
              href={tile.href}
              className="group flex items-center gap-3 rounded-sm border border-[#0E1A2B]/10 bg-white px-3.5 py-3 transition hover:border-[#0E1A2B]/35 hover:shadow-[0_18px_40px_-30px_rgba(14,26,43,0.8)]"
            >
              <CategoryIcon
                handle={tile.handle}
                className="h-7 w-7 shrink-0 text-[#0E1A2B]/45 transition group-hover:text-[#2E64A8]"
              />

              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium leading-5 text-[#0E1A2B]">
                  {tile.label}
                </span>
                <span className="block text-[11px] tabular-nums text-[#0E1A2B]/35">
                  {tile.count}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
