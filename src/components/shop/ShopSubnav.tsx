import { shop } from "@/components/shop/theme"

export type SubnavItem = {
  label: string
  href: string
  count: number
  active?: boolean
  /** Nagłówek grupy (np. „Spalinowe") — nie jest linkiem. */
  section?: boolean
}

type ShopSubnavProps = {
  title: string
  items: SubnavItem[]
}

// Pasek podkategorii pod nagłówkiem listy. Bez niego wejście w „Elektronikę"
// wysypywało 37 pozycji wszystkich marek naraz i trzeba było szukać Garmina
// ręcznie. Chipsy są zwykłymi linkami, więc działają bez JS.
export default function ShopSubnav({ title, items }: ShopSubnavProps) {
  // Dział bywa nazwany marką (Elektronika ma w Medusie uchwyt `garmin`),
  // więc chipsy zawężamy do sekcji, w której siedzi aktywna kategoria —
  // Lowrance i Fusion nie są podkategoriami Garmina.
  const sections = items.some((item) => item.section)
  const activeIndex = items.findIndex((item) => item.active)
  let scope = items

  if (sections) {
    const first = items.findIndex((item) => item.section)
    const from = activeIndex > 0 ? activeIndex : first

    let start = -1
    for (let index = from; index >= 1; index -= 1) {
      if (items[index].section) {
        start = index
        break
      }
    }

    // Pozycje stojące PRZED pierwszym nagłówkiem tworzą własną grupę
    // (Elektronika zaczyna się od Garmina, dopiero potem są „Mapy morskie"
    // i „Pozostałe marki"). Bez tego Garmin dostawał chipsy cudzej sekcji.
    if (start < 0) start = 1

    let end = items.length
    for (let index = start + 1; index < items.length; index += 1) {
      if (items[index].section) {
        end = index
        break
      }
    }

    // Pierwszy chip („zobacz wszystko") zostaje zawsze.
    scope = [items[0], ...items.slice(start, end)]
  }

  const links = scope.filter((item) => !item.section && item.count > 0)
  if (links.length < 2) return null

  return (
    <section className="border-b border-[#0E1A2B]/10 bg-white">
      <div className={`${shop.container} py-6`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
          {title}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex items-center gap-2 border px-4 py-2.5 text-sm transition ${
                item.active
                  ? "border-[#0E1A2B] bg-[#0E1A2B] text-white"
                  : "border-[#0E1A2B]/12 text-[#0E1A2B]/70 hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
              }`}
            >
              {item.label}
              <span
                className={`text-[11px] tabular-nums ${
                  item.active ? "text-white/55" : "text-[#0E1A2B]/35"
                }`}
              >
                {item.count}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
