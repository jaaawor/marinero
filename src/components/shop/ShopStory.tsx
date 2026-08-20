import { shop } from "@/components/shop/theme"

type ShopStoryProps = {
  eyebrow: string
  title: string
  lead: string
  ctaLabel: string
  ctaHref: string
  image: string
  imageAlt?: string
  /** Zdjęcie po prawej stronie zamiast po lewej. */
  reverse?: boolean
}

// Blok redakcyjny: duże zdjęcie z życia, obok krótki tekst i jedno wyjście.
// Rozbija listy produktów, żeby sklep nie był wyłącznie siatką pakshotów.
export default function ShopStory({
  eyebrow,
  title,
  lead,
  ctaLabel,
  ctaHref,
  image,
  imageAlt = "",
  reverse,
}: ShopStoryProps) {
  if (!image) return null

  return (
    <section className="border-y border-[#0E1A2B]/10 bg-white">
      <div className="mx-auto grid max-w-[1500px] items-stretch lg:grid-cols-2">
        <div className={`relative min-h-[280px] lg:min-h-[440px] ${reverse ? "lg:order-2" : ""}`}>
          <img
            src={image}
            alt={imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div
          className={`flex flex-col justify-center px-5 py-12 md:px-12 lg:px-16 lg:py-16 ${
            reverse ? "lg:order-1" : ""
          }`}
        >
          <p className={shop.eyebrow}>{eyebrow}</p>

          <h2 className={`${shop.display} mt-5 text-3xl md:text-[2.75rem]`}>{title}</h2>

          <p className="mt-6 max-w-xl text-base leading-8 text-[#0E1A2B]/60">{lead}</p>

          <div className="mt-9">
            <a href={ctaHref} className={shop.btnPrimary}>
              {ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
