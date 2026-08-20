"use client"

import { useRef, useState } from "react"
import ProductCard from "@/components/shop/ProductCard"
import type { ShopProduct } from "@/lib/medusa"

type ProductRailProps = {
  products: ShopProduct[]
  locale?: string
}

// Szyna produktów przewijana w poziomie — mieści 10–12 pozycji na tej samej
// wysokości strony, na której siatka pokazywała cztery. Kadry są te same
// (`shop.tile`), więc rytm strony się nie psuje.
//
// Pasek przewijania jest ukryty: na telefonie system i tak rysuje własny,
// cienki i znikający, a na desktopie zostawał brzydki pasek na stałe.
// Zamiast niego kółko myszy przewija w poziomie, a przy najechaniu
// pojawiają się dyskretne strzałki.
export default function ProductRail({ products, locale = "pl" }: ProductRailProps) {
  const track = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  if (!products.length) return null

  function sync() {
    const node = track.current
    if (!node) return

    setAtStart(node.scrollLeft <= 4)
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 4)
  }

  function step(direction: 1 | -1) {
    const node = track.current
    if (!node) return

    node.scrollBy({ left: direction * Math.round(node.clientWidth * 0.8), behavior: "smooth" })
  }

  return (
    <div className="group/rail relative">
      <div
        ref={track}
        onScroll={sync}
        onWheel={(event) => {
          const node = track.current
          if (!node) return

          // Gest poziomy (touchpad) zostawiamy przeglądarce.
          if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

          const next = node.scrollLeft + event.deltaY
          const max = node.scrollWidth - node.clientWidth

          // Na końcach oddajemy przewijanie stronie, żeby nie blokować kółka.
          if ((event.deltaY < 0 && node.scrollLeft <= 0) || (event.deltaY > 0 && node.scrollLeft >= max)) {
            return
          }

          event.preventDefault()
          node.scrollLeft = next
        }}
        className="-mx-5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden"
      >
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

      {/* Strzałki tylko na desktopie — na dotyku przewija się palcem. */}
      {[-1, 1].map((direction) => {
        const hidden = direction === -1 ? atStart : atEnd

        return (
          <button
            key={direction}
            type="button"
            aria-label={direction === -1 ? "Poprzednie produkty" : "Następne produkty"}
            onClick={() => step(direction as 1 | -1)}
            className={`absolute top-[32%] z-10 hidden h-11 w-11 items-center justify-center rounded-full border border-[#0E1A2B]/10 bg-white/95 text-[#0E1A2B] shadow-[0_10px_30px_-16px_rgba(14,26,43,0.7)] transition duration-200 hover:border-[#0E1A2B]/30 lg:flex ${
              direction === -1 ? "-left-3" : "-right-3"
            } ${hidden ? "pointer-events-none opacity-0" : "opacity-0 group-hover/rail:opacity-100"}`}
          >
            {direction === -1 ? "‹" : "›"}
          </button>
        )
      })}
    </div>
  )
}
