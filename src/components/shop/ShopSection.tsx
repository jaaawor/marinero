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
  children,
}: ShopSectionProps) {
  const inner = (
    <div className={`${shop.container} ${shop.section}`}>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          {eyebrow ? <p className={shop.eyebrow}>{eyebrow}</p> : null}

          <h2 className={`${shop.display} mt-4 text-3xl md:text-[2.75rem]`}>{title}</h2>

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
