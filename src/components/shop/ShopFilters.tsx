import { shop } from "@/components/shop/theme"
import { formatPrice } from "@/lib/medusa"
import type { ShopMenuGroup } from "@/lib/shop-taxonomy"
import { toggleParam } from "@/lib/shop-filters"
import type { AvailabilityFilter, FacetOption, ShopFilterState } from "@/lib/shop-filters"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type ShopFiltersProps = {
  locale?: string
  /** Adres listy, do której wracają linki filtrów. */
  basePath: string
  /** Parametry bieżącego adresu — na ich podstawie budujemy przełączniki. */
  params: Record<string, string | undefined>
  filters: ShopFilterState
  brands: { brand: string; count: number }[]
  availability: { value: AvailabilityFilter; label: string; count: number }[]
  /** Dział, w którym jesteśmy — pokazujemy jego podkategorie. */
  group?: ShopMenuGroup
  activeHandle?: string
  priceRange?: { min: number; max: number }
  /** Filtry techniczne — pokazujemy tylko te, które mają trafienia. */
  technical?: {
    fuel: FacetOption[]
    power: FacetOption[]
    shaft: FacetOption[]
    control: FacetOption[]
  }
  total: number
}

// Lewa szyna z filtrami. Wszystko na linkach — działa bez JS, każdy stan
// filtrów ma własny adres, więc da się go wysłać albo dodać do zakładek.
export function ActiveFilterChips({
  locale = "pl",
  basePath,
  params,
}: {
  locale?: string
  basePath: string
  params: Record<string, string | undefined>
}) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const chips: { key: string; value: string }[] = []
  for (const key of ["marki", "dostepnosc", "paliwo", "moc", "kolumna", "sterowanie"]) {
    for (const value of (params[key] || "").split(",").filter(Boolean)) {
      chips.push({ key, value })
    }
  }

  if (!chips.length) return null

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <a
          key={`${chip.key}-${chip.value}`}
          href={`${localeHref(current, basePath)}${toggleParam(params, chip.key, chip.value)}`}
          className="inline-flex items-center gap-2 rounded-full bg-[#0E1A2B] px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#2E64A8]"
        >
          {chip.value}
          <span aria-hidden className="text-white/60">
            ✕
          </span>
        </a>
      ))}

      <a
        href={localeHref(current, basePath)}
        className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0E1A2B]/45 underline underline-offset-4 transition hover:text-[#2E64A8]"
      >
        {t.shopFiltersClear}
      </a>
    </div>
  )
}

export default function ShopFilters({
  locale = "pl",
  basePath,
  params,
  filters,
  brands,
  availability,
  group,
  activeHandle,
  priceRange,
  technical,
  total,
}: ShopFiltersProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const href = (path: string) => localeHref(current, path)

  const link = (key: string, value: string) => `${href(basePath)}${toggleParam(params, key, value)}`
  // Jedna sekcja z „ptaszkami" — używamy jej dla wszystkich list wyboru.
  const facetSection = (
    title: string,
    key: string,
    options: FacetOption[],
    selected: string[]
  ) =>
    options.length ? (
      <section className="mt-8" key={key}>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
          {title}
        </p>

        <ul className="space-y-2">
          {options.map((option) => {
            const active = selected.includes(option.value)
            return (
              <li key={option.value}>
                <a
                  href={link(key, option.value)}
                  className="flex items-center gap-2.5 text-[14px] text-[#0E1A2B]/70 transition hover:text-[#0E1A2B]"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[10px] ${
                      active ? "border-[#0E1A2B] bg-[#0E1A2B] text-white" : "border-[#0E1A2B]/25"
                    }`}
                  >
                    {active ? "✓" : ""}
                  </span>
                  <span className={active ? "font-medium text-[#0E1A2B]" : ""}>
                    {option.label}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-[#0E1A2B]/30">
                    {option.count}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>
    ) : null

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="flex items-baseline justify-between gap-4 border-b border-[#0E1A2B]/10 pb-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]">
          {t.shopFilters}
        </p>
        <span className="text-[12px] text-[#0E1A2B]/40">
          {total} {t.shopProducts}
        </span>
      </div>


      {group?.children.length ? (
        <section className="mt-7">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
            {t.shopCategories}
          </p>

          <ul className="space-y-1.5">
            {group.children.map((child) => (
              <li key={child.handle}>
                <a
                  href={href(`/sklep/kategoria/${child.handle}`)}
                  className={`flex items-center justify-between gap-3 text-[14px] transition hover:text-[#2E64A8] ${
                    child.handle === activeHandle
                      ? "font-semibold text-[#0E1A2B]"
                      : child.section
                        ? "font-semibold text-[#0E1A2B]/80"
                        : "pl-3 text-[#0E1A2B]/60"
                  }`}
                >
                  {child.label}
                  <span className="text-[11px] tabular-nums text-[#0E1A2B]/30">
                    {child.productCount}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {availability.length ? (
        <section className="mt-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
            {t.shopAvailability}
          </p>

          <ul className="space-y-2">
            {availability.map((item) => {
              const active = filters.availability.includes(item.value)
              return (
                <li key={item.value}>
                  <a
                    href={link("dostepnosc", item.value)}
                    className="flex items-center gap-2.5 text-[14px] text-[#0E1A2B]/70 transition hover:text-[#0E1A2B]"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[10px] ${
                        active
                          ? "border-[#0E1A2B] bg-[#0E1A2B] text-white"
                          : "border-[#0E1A2B]/25"
                      }`}
                    >
                      {active ? "✓" : ""}
                    </span>
                    <span className={active ? "font-medium text-[#0E1A2B]" : ""}>{item.label}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-[#0E1A2B]/30">
                      {item.count}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {technical
        ? [
            facetSection(t.shopFuel, "paliwo", technical.fuel, filters.fuel),
            facetSection(t.shopPower, "moc", technical.power, filters.power),
            facetSection(t.shopShaft, "kolumna", technical.shaft, filters.shaft),
            facetSection(t.shopControl, "sterowanie", technical.control, filters.control),
          ]
        : null}

      {brands.length ? (
        <section className="mt-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
            {t.shopBrandLabel}
          </p>

          <ul className="space-y-2">
            {brands.map((item) => {
              const active = filters.brands.includes(item.brand)
              return (
                <li key={item.brand}>
                  <a
                    href={link("marki", item.brand)}
                    className="flex items-center gap-2.5 text-[14px] text-[#0E1A2B]/70 transition hover:text-[#0E1A2B]"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[10px] ${
                        active
                          ? "border-[#0E1A2B] bg-[#0E1A2B] text-white"
                          : "border-[#0E1A2B]/25"
                      }`}
                    >
                      {active ? "✓" : ""}
                    </span>
                    <span className={active ? "font-medium text-[#0E1A2B]" : ""}>{item.brand}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-[#0E1A2B]/30">
                      {item.count}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
          {t.shopPrice}
        </p>

        <form action={href(basePath)} className="flex items-center gap-2">
          {Object.entries(params)
            .filter(([key, value]) => value && !["cena_od", "cena_do", "strona"].includes(key))
            .map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}

          <input
            type="number"
            name="cena_od"
            min={0}
            defaultValue={filters.priceFrom ?? ""}
            placeholder={priceRange ? String(Math.floor(priceRange.min)) : "od"}
            className="w-full rounded-sm border border-[#0E1A2B]/15 px-3 py-2 text-sm outline-none focus:border-[#0E1A2B]"
          />
          <span className="text-[#0E1A2B]/30">–</span>
          <input
            type="number"
            name="cena_do"
            min={0}
            defaultValue={filters.priceTo ?? ""}
            placeholder={priceRange ? String(Math.ceil(priceRange.max)) : "do"}
            className="w-full rounded-sm border border-[#0E1A2B]/15 px-3 py-2 text-sm outline-none focus:border-[#0E1A2B]"
          />
          <button
            type="submit"
            aria-label={t.searchButton}
            className="shrink-0 rounded-sm border border-[#0E1A2B]/15 px-3 py-2 text-sm text-[#0E1A2B]/60 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
          >
            →
          </button>
        </form>

        {priceRange ? (
          <p className="mt-2 text-[11px] text-[#0E1A2B]/35">
            {formatPrice(priceRange.min)} – {formatPrice(priceRange.max)}
          </p>
        ) : null}
      </section>
    </aside>
  )
}
