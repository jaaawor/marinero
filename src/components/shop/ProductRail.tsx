"use client"

import { useEffect, useRef, useState } from "react"
import ProductCard from "@/components/shop/ProductCard"
import type { ShopProduct } from "@/lib/medusa"

type ProductRailProps = {
  products: ShopProduct[]
  locale?: string
  /** Węższe kafelki — szyna towarzyszy liście, nie zastępuje jej. */
  compact?: boolean
}

// Szyna produktów przewijana w poziomie — mieści 10–12 pozycji na tej samej
// wysokości strony, na której siatka pokazywała cztery. Kadry są te same
// (`shop.tile`), więc rytm strony się nie psuje.
//
// Pasek przewijania jest ukryty: na telefonie system i tak rysuje własny,
// cienki i znikający, a na desktopie zostawał brzydki pasek na stałe.
// Zamiast niego kółko myszy przewija w poziomie, a przy najechaniu
// pojawiają się dyskretne strzałki.
export default function ProductRail({
  products,
  locale = "pl",
  compact,
}: ProductRailProps) {
  const track = useRef<HTMLDivElement>(null)
  const lastWheel = useRef(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  // Kółko myszy musi przewijać SAME produkty, a nie produkty i stronę naraz.
  // React wpina `onWheel` jako listener pasywny, więc `preventDefault()` w JSX
  // nic nie robił — stąd podwójne przewijanie. Tu wpinamy własny listener
  // z `passive: false`.
  //
  // Na końcu szyny nadal blokujemy przewijanie, ale tylko dopóki trwa ten sam
  // gest (kolejne zdarzenia co < 250 ms). Po chwili przerwy kółko znów należy
  // do strony, więc nikt nie zostaje uwięziony na szynie.
  useEffect(() => {
    const node = track.current
    if (!node) return

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      const max = node.scrollWidth - node.clientWidth
      if (max <= 0) return

      const atEdge =
        (event.deltaY < 0 && node.scrollLeft <= 0) || (event.deltaY > 0 && node.scrollLeft >= max)
      const continuing = event.timeStamp - lastWheel.current < 250

      if (atEdge && !continuing) return

      lastWheel.current = event.timeStamp
      event.preventDefault()
      node.scrollLeft = Math.max(0, Math.min(max, node.scrollLeft + event.deltaY))
    }

    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [products.length])

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
        className="-mx-5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex snap-x snap-mandatory gap-4 pb-2 sm:gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className={
                compact
                  ? "w-[38vw] shrink-0 snap-start sm:w-[24vw] lg:w-[calc((100%-5*1.5rem)/6)] lg:max-w-[200px]"
                  : "w-[43vw] shrink-0 snap-start sm:w-[30vw] lg:w-[calc((100%-4*1.5rem)/5)] lg:max-w-[280px]"
              }
            >
              {/* W wersji zwartej chowamy rząd cech („300 KM", 15") — to
                  on robił połowę wysokości kafelka. */}
              <ProductCard product={product} locale={locale} quickAdd hideChips={compact} />
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
