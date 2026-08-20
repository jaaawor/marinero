"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { formatPrice } from "@/lib/medusa"

type StickyBuyBarProps = {
  title: string
  price: number | null
  image?: string
  /** Krótka informacja pod ceną — termin wysyłki albo dostępność. */
  note?: string
  /** Id kolumny zakupu — pasek pokazuje się, gdy zjedzie ona z ekranu. */
  watchId: string
  /** Przycisk zakupu — ten sam komponent co w kolumnie zakupu. */
  children: ReactNode
}

// Pasek zakupu doklejony do dołu ekranu, gdy właściwy przycisk wyjedzie
// poza widok. Po długim opisie i tabeli specyfikacji „Dodaj do koszyka"
// zostawało kilka ekranów wyżej.
export default function StickyBuyBar({ title, price, image, note, watchId, children }: StickyBuyBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Obserwujemy właściwą kolumnę zakupu, nie znacznik przy stopce —
    // znacznik na dole strony pokazywałby pasek dopiero na samym końcu.
    const node = document.getElementById(watchId)
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Widoczny tylko wtedy, gdy kolumna zakupu wyjechała górą ekranu.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0)
      },
      { threshold: 0 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [watchId])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#0E1A2B]/10 bg-white/95 backdrop-blur transition duration-300 ${
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 py-3 md:px-8 md:py-4">
        {image ? (
          <img src={image} alt="" className="hidden h-14 w-14 shrink-0 object-contain sm:block" />
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[#0E1A2B] sm:text-sm">{title}</p>

          <p className="flex flex-wrap items-baseline gap-x-3 text-[#0E1A2B]">
            <span className="text-lg font-semibold tracking-[-0.02em]">{formatPrice(price)}</span>
            {note ? <span className="text-[12px] text-[#0E1A2B]/50">{note}</span> : null}
          </p>
        </div>

        <div className="w-[46%] shrink-0 sm:w-auto sm:min-w-[240px]">{children}</div>
      </div>
    </div>
  )
}
