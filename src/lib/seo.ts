// Wspólne kawałki SEO: adres kanoniczny, wersje językowe i dane strukturalne.
//
// Wyszukiwarka nie widzi układu strony — widzi tytuł, opis i dane strukturalne.
// Do tej pory 79 modeli łodzi miało jeden wspólny tytuł z layoutu, więc
// w wynikach wyglądały identycznie i konkurowały ze sobą o to samo zapytanie.

import { LOCALES, localeHref, normalizeLocale } from "@/lib/i18n"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://marinero.pl"

/**
 * Adresy techniczne, pod którymi ten sam serwis stoi na VPS-ie.
 *
 * `marinero.150197.pl` to nazwa od hostingu — pod nią serwis wstał, zanim
 * przepięliśmy domenę, i **nadal oddaje całą stronę z kodem 200**. Dla Google
 * to drugi, kompletny serwis z tą samą treścią: adres wychodził w wynikach
 * wyszukiwania zamiast marinero.pl. Znacznik `canonical` tego nie załatwia —
 * jest podpowiedzią, a nie poleceniem, i Google potrafi go zignorować, gdy
 * host odpowiada normalnie i nie zabrania się indeksować.
 *
 * Dlatego zamykamy to dwoma zaporami: `middleware.ts` odsyła stąd **trwałym
 * przekierowaniem** (301, czyli „przenieś moc linków na marinero.pl"),
 * a `robots.ts` na takim hoście oddaje `Disallow: /`, bo pod przekierowanie
 * nie wchodzą wszystkie ścieżki.
 */
export const HOSTY_TECHNICZNE = ["marinero.150197.pl", "www.marinero.150197.pl"]

/** Czy żądanie przyszło pod adresem technicznym, a nie pod marinero.pl. */
export function czyHostTechniczny(host: string | null | undefined): boolean {
  if (!host) return false
  // Port odcinamy — nagłówek `Host` potrafi go nieść.
  const czysty = host.split(":")[0].toLowerCase()
  return HOSTY_TECHNICZNE.includes(czysty)
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Adres kanoniczny + wersje językowe dla jednej ścieżki (bez prefiksu locale).
 * Polski jest wersją domyślną (`x-default`), bo stoi pod adresem bez prefiksu.
 */
export function localeAlternates(locale: string, path: string) {
  const languages: Record<string, string> = {}

  for (const code of LOCALES) {
    languages[code] = absoluteUrl(localeHref(code, path))
  }

  languages["x-default"] = absoluteUrl(localeHref("pl", path))

  return {
    canonical: absoluteUrl(localeHref(normalizeLocale(locale), path)),
    languages,
  }
}

/** Skraca opis do długości, którą Google i tak pokazuje w wyniku. */
export function clampDescription(text: string, max = 165): string {
  const clean = String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (clean.length <= max) return clean

  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[,.;:–-]$/, "")}…`
}

type JsonLdValue = Record<string, unknown>

/**
 * Dane strukturalne wstawiamy przez `dangerouslySetInnerHTML`, bo React
 * inaczej ucieka znaki w treści `<script>` i Google dostaje śmieci.
 * `<` zamieniamy na `<`, żeby treść nie mogła zamknąć skryptu.
 */
export function jsonLdProps(data: JsonLdValue | JsonLdValue[]) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    },
  }
}

export function organizationJsonLd(settings?: any): JsonLdValue {
  const phone = settings?.phone || ""
  const address =
    settings?.address || "ul. Arkadiusza Rybickiego 4B/U1, 81-340 Gdynia — Marina Yacht Park"

  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${SITE_URL}/#organizacja`,
    name: settings?.site_name || "Marinero",
    description:
      "Autoryzowany dealer łodzi motorowych i katamaranów oraz serwis silników zaburtowych Suzuki i Mercury.",
    url: SITE_URL,
    logo: absoluteUrl("/logo-marinero.png"),
    image: absoluteUrl("/logo-marinero.png"),
    email: settings?.email || "biuro@marinero.pl",
    ...(phone ? { telephone: phone } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: "Gdynia",
      addressCountry: "PL",
    },
    areaServed: "PL",
    ...(settings?.facebook_url ? { sameAs: [settings.facebook_url] } : {}),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

type ProductJsonLd = {
  name: string
  description?: string
  image?: string | string[]
  brand?: string
  sku?: string
  /** Numer katalogowy producenta. */
  mpn?: string
  gtin?: string
  url: string
  price?: number | null
  currency?: string
  availability?: "InStock" | "PreOrder" | "OutOfStock"
}

export function productJsonLd(product: ProductJsonLd): JsonLdValue {
  const images = ([] as string[])
    .concat(product.image || [])
    .filter(Boolean)
    .map((src) => (src.startsWith("http") ? src : absoluteUrl(src)))

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(product.gtin ? { gtin13: product.gtin } : {}),
    url: absoluteUrl(product.url),
    ...(typeof product.price === "number"
      ? {
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: product.currency || "PLN",
            availability: `https://schema.org/${product.availability || "InStock"}`,
            url: absoluteUrl(product.url),
            seller: { "@id": `${SITE_URL}/#organizacja` },
          },
        }
      : {}),
  }
}
