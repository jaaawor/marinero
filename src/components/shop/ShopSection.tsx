import type { ReactNode } from "react"
import { shop } from "@/components/shop/theme"

type ShopSectionProps = {
  eyebrow?: string
  title: string
  lead?: string
  linkLabel?: string
  linkHref?: string
  /** Sekcja na własnym tle, odcięta liniami od sąsiadów. */
  banded?: boolean
  /** Wersja dodatkowa: mniejszy nagłówek i mniej powietrza — dla pasków,
      które tylko towarzyszą liście produktów, a nie są jej głównym daniem. */
  compact?: boolean
  children: ReactNode
}

// Jeden nagłówek sekcji dla całego sklepu: ta sama nadlinia, ten sam stopień
// pisma, ten sam odstęp do treści. Wcześniej każda sekcja miała własne
// marginesy i wielkości, przez co strona wyglądała na poskładaną z kawałków.
export default function ShopSection({
  eyebrow,
  title,
  lead,
  linkLabel,
  linkHref,
  banded,
  compact,
  children,
}: ShopSectionProps) {
  const inner = (
    <div className={`${shop.container} ${compact ? "py-7 md:py-9" : shop.section}`}>
      <div
        className={`flex flex-wrap items-end justify-between gap-x-10 gap-y-5 ${
          compact ? "mb-5" : "mb-9"
        }`}
      >
        <div>
          {eyebrow ? <p className={shop.eyebrow}>{eyebrow}</p> : null}

          <h2
            className={`${shop.display} ${
              compact ? "mt-2 text-xl md:text-2xl" : "mt-4 text-3xl md:text-[2.75rem]"
            }`}
          >
            {title}
          </h2>

          {lead ? (
            <p className="mt-5 max-w-xl text-base leading-8 text-[#0E1A2B]/55">{lead}</p>
          ) : null}
        </div>

        {linkLabel && linkHref ? (
          <a href={linkHref} className={shop.link}>
            {linkLabel} →
          </a>
        ) : null}
      </div>

      {children}
    </div>
  )

  if (banded) {
    return <section className="border-y border-[#0E1A2B]/10 bg-white">{inner}</section>
  }

  return <section>{inner}</section>
}
