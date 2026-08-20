import { shop } from "@/components/shop/theme"

export type QuickLink = { label: string; href: string; count: number }

// Pas szybkich wejść tuż pod kadrem — wzorem x-kom.pl, gdzie nad treścią stoi
// rząd wąskich kafelków prowadzących prosto do najczęściej szukanych działów.
// Bez niego trzeba było przewinąć pół strony, żeby wejść w kategorię.
export default function ShopQuickLinks({ items }: { items: QuickLink[] }) {
  const links = items.filter((item) => item.count > 0).slice(0, 6)
  if (links.length < 3) return null

  return (
    <section className="border-b border-[#0E1A2B]/10 bg-white">
      <div className={`${shop.container} py-6`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {links.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-baseline justify-between gap-3 border border-[#0E1A2B]/12 px-4 py-4 transition hover:border-[#0E1A2B] hover:bg-[#0E1A2B] hover:text-white"
            >
              <span className="text-[13px] font-semibold leading-5">{item.label}</span>
              <span className="text-[11px] tabular-nums text-[#0E1A2B]/35 transition group-hover:text-white/55">
                {item.count}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
