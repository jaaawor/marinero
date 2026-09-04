import QuickAdd from "@/components/shop/QuickAdd"
import { formatPrice } from "@/lib/medusa"
import { cenaRegularna } from "@/lib/cena-detaliczna"
import { najnizszaZ30Dni } from "@/lib/historia-cen"
import type { ShopProduct } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { availabilityDotClass, czyDoKupienia, getAvailability } from "@/lib/availability"
import { parseProduct } from "@/lib/product-family"
import { cechyProduktu, enginePower } from "@/lib/parametry"
import { getMapCompatibility } from "@/lib/map-compatibility"
import { shop } from "@/components/shop/theme"

type ProductCardProps = {
  product: ShopProduct
  locale?: string
  quickAdd?: boolean
  /** Bez rzędu cech („300 KM", 15\") — szyna obok listy ma być niska. */
  hideChips?: boolean
}

// Kafelek produktu: biały kadr bez ramek, pod nim kategoria, nazwa, cecha
// techniczna wyciągnięta z nazwy modelu, cena i dostępność. Quick-add wjeżdża
// przy najechaniu, na dotyku jest widoczny od razu.
export default function ProductCard({
  product,
  locale = "pl",
  quickAdd,
  hideChips,
}: ProductCardProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const availability = getAvailability(product.metadata, product.title)
  const parsed = parseProduct(product.title)
  const power = enginePower(product)

  // Skróty kolumny — pełny opis („S — krótka (381 mm)") nie mieści się na kafelku.
  const SHAFT_SHORT: Record<string, string> = {
    S: "kolumna S · 381 mm",
    L: "kolumna L · 508 mm",
    X: "kolumna X · 635 mm",
    XX: "kolumna XX · 762 mm",
    UL: "kolumna UL",
  }

  const shaft = cechyProduktu(product).kolumna || ""

  // Przy mapach najważniejsze jest to, w czym karta w ogóle zadziała.
  const maps = getMapCompatibility(
    product.title,
    product.metadata,
    product.categories.map((category) => category.handle)
  )

  const regularna = cenaRegularna(product.metadata, product.price)

  // Omnibus obowiązuje też na liście: obniżkę ogłaszamy przekreśleniem, więc
  // najniższa cena z 30 dni musi stać tam, gdzie ta obniżka jest widoczna.
  const najnizsza = regularna ? najnizszaZ30Dni(product.metadata) : null

  // Najkrótsze informacje, które realnie pomagają wybrać model.
  const chips = [
    maps ? maps.label : "",
    power ? `${power} KM` : "",
    shaft ? SHAFT_SHORT[shaft] || shaft : "",
    parsed?.traits.find((trait) => trait.key === "ekran")?.display || "",
  ].filter(Boolean)

  return (
    <div className="group relative flex flex-col">
      <a href={localeHref(current, `/sklep/produkt/${product.handle}`)} className="flex flex-col">
        {/* Bez ramki — kadr trzyma sama biel i zdjęcie, jak w blokach
            redakcyjnych na stronie sklepu. Cień pojawia się dopiero przy najechaniu. */}
        <div
          className={`${shop.tile} p-3 sm:p-5 transition duration-500 group-hover:shadow-[0_36px_70px_-50px_rgba(14,26,43,0.7)]`}
        >
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.titleDisplay || product.title}
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

          {/* Na telefonie kafelek ma ~167 px szerokości i przycisk zjadałby
              pół kadru — quick-add zostaje od `md`, na dotyku kupuje się
              ze strony produktu. */}
          {quickAdd && czyDoKupienia(availability.code) && product.variants[0]?.id ? (
            <div className="absolute inset-x-4 bottom-4 hidden translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
              <QuickAdd variantId={product.variants[0].id} locale={current} />
            </div>
          ) : null}
        </div>

        <div className="mt-3.5 border-t border-[#0E1A2B]/10 pt-3.5">
          {product.categories[0] ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E1A2B]/35">
              {product.categories[0].name}
            </p>
          ) : null}

          {/*
            Nazwa produktu idzie szeryfowym Newsreaderem, tak jak nagłówki
            sklepu — bezszeryfowy tekst o wadze medium czytał się jak etykieta
            z panelu, a nie jak nazwa towaru. Krój dostaje własną interlinię:
            `shop.display` ma leading 1.06, dobre pod duży nagłówek, ale przy
            dwóch linijkach na kafelku litery zachodziłyby na siebie.
            Ceny zostają bezszeryfowe, żeby cyfry się nie rozjeżdżały.
          */}
          <h3 className="mt-2 line-clamp-2 min-h-[2.75rem] font-serif text-[15px] font-normal leading-[1.4] text-[#0E1A2B] transition group-hover:text-[#2E64A8] sm:min-h-[2.9rem] sm:text-base">
            {product.titleDisplay || product.title}
          </h3>

          {/* Rząd cech ma stałą wysokość także wtedy, gdy produkt nie ma
              żadnej — inaczej ceny w sąsiednich kafelkach stoją na różnych
              wysokościach (to był ten „różny rozmiar" na stronie). */}
          <ul
            className={`mt-2 min-h-[1.75rem] flex-wrap gap-1.5 ${
              hideChips ? "hidden" : "hidden sm:flex"
            }`}
          >
            {chips.slice(0, 3).map((chip) => (
              <li
                key={chip}
                className="rounded-sm bg-[#F4F1EC] px-2 py-1 text-[11px] text-[#0E1A2B]/55"
              >
                {chip}
              </li>
            ))}
          </ul>

          {/* Cena i termin wysyłki jeden pod drugim — na kafelku x-koma to
              właśnie te dwie informacje decydują o kliknięciu. */}
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[17px] font-semibold tracking-[-0.02em] text-[#0E1A2B] sm:text-xl">
            <span>{formatPrice(product.price)}</span>

            {/* Przekreślona cena regularna tylko wtedy, gdy sprzedawca ją
                włączył przy tym produkcie i jest wyższa od obecnej. */}
            {regularna ? (
              <>
                <span className="text-[13px] font-normal text-[#0E1A2B]/40 line-through sm:text-sm">
                  {formatPrice(regularna.regularna)}
                </span>
                <span className="rounded-full bg-[#2E64A8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2E64A8]">
                  −{regularna.rabat}%
                </span>
              </>
            ) : null}
          </p>

          {najnizsza !== null ? (
            <p className="mt-1 text-[11px] leading-4 text-[#0E1A2B]/45">
              {t.shopLowest30} {formatPrice(najnizsza)}
            </p>
          ) : null}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#0E1A2B]/50">
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${availabilityDotClass(
                  availability.tone
                )}`}
              />
              {availability.short}
            </span>

            {availability.quantity > 0 ? (
              <span className="text-[#0E1A2B]/35">· {availability.quantity} szt.</span>
            ) : null}
          </p>
        </div>
      </a>
    </div>
  )
}
