import QuickAdd from "@/components/shop/QuickAdd"
import { formatPrice } from "@/lib/medusa"
import type { ShopProduct } from "@/lib/medusa"
import { localeHref, normalizeLocale } from "@/lib/i18n"
import { availabilityDotClass, getAvailability } from "@/lib/availability"
import { parseProduct } from "@/lib/product-family"
import { enginePower } from "@/lib/shop-filters"

type ProductCardProps = {
  product: ShopProduct
  locale?: string
  quickAdd?: boolean
}

// Kafelek produktu: biały kadr bez ramek, pod nim kategoria, nazwa, cecha
// techniczna wyciągnięta z nazwy modelu, cena i dostępność. Quick-add wjeżdża
// przy najechaniu, na dotyku jest widoczny od razu.
export default function ProductCard({ product, locale = "pl", quickAdd }: ProductCardProps) {
  const current = normalizeLocale(locale)
  const availability = getAvailability(product.metadata, product.title)
  const parsed = parseProduct(product.title)
  const power = enginePower(product.title)

  // Skróty kolumny — pełny opis („S — krótka (15″)") nie mieści się na kafelku.
  const SHAFT_SHORT: Record<string, string> = {
    S: 'kolumna S · 15″',
    L: 'kolumna L · 20″',
    X: 'kolumna X · 25″',
    XX: 'kolumna XX · 30″',
    UL: "kolumna UL",
  }

  const shaft = parsed?.traits.find((trait) => trait.key === "kolumna")?.value || ""

  // Najkrótsze informacje, które realnie pomagają wybrać model.
  const chips = [
    power ? `${power} KM` : "",
    shaft ? SHAFT_SHORT[shaft] || shaft : "",
    parsed?.traits.find((trait) => trait.key === "ekran")?.display || "",
  ].filter(Boolean)

  return (
    <div className="group relative flex flex-col">
      <a href={localeHref(current, `/sklep/produkt/${product.handle}`)} className="flex flex-col">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-white p-8 transition duration-500 group-hover:shadow-[0_30px_60px_-45px_rgba(14,26,43,0.65)]">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="h-full w-full bg-[#F4F1EC]" />
          )}

          {availability.code === "od-reki" ? (
            <span className="absolute left-4 top-4 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              24 h
            </span>
          ) : null}

          {quickAdd && product.variants[0]?.id ? (
            <div className="absolute inset-x-4 bottom-4 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100">
              <QuickAdd variantId={product.variants[0].id} locale={current} />
            </div>
          ) : null}
        </div>

        <div className="pt-5">
          {product.categories[0] ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
              {product.categories[0].name}
            </p>
          ) : null}

          <h3 className="mt-2.5 line-clamp-2 text-[15px] font-medium leading-6 text-[#0E1A2B] transition group-hover:text-[#2E64A8]">
            {product.title}
          </h3>

          {chips.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {chips.slice(0, 3).map((chip) => (
                <li
                  key={chip}
                  className="rounded-sm bg-[#F4F1EC] px-2 py-1 text-[11px] text-[#0E1A2B]/55"
                >
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3.5 flex items-baseline justify-between gap-3">
            <p className="text-base font-semibold tracking-[-0.01em] text-[#0E1A2B]">
              {formatPrice(product.price)}
            </p>

            <p className="flex items-center gap-1.5 text-[11px] text-[#0E1A2B]/45">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${availabilityDotClass(
                  availability.tone
                )}`}
              />
              {availability.short}
            </p>
          </div>
        </div>
      </a>
    </div>
  )
}
