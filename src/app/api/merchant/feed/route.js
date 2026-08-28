import { NextResponse } from "next/server"
import { getAllShopProducts } from "@/lib/medusa"
import { getAvailability } from "@/lib/availability"

// Feed produktowy dla Google Merchant Center (RSS 2.0 z przestrzenią `g:`).
// W panelu Merchanta wskazuje się go jako źródło pobierane z adresu:
//   https://marinero.pl/api/merchant/feed
//
// Ceny i dostępność biorą się wprost z Medusy, więc feed nie rozjeżdża się
// z tym, co widzi klient na stronie.

// Feed budujemy **na żądanie**, nie przy budowaniu strony. Przy `revalidate`
// odpowiedź powstawała w trakcie builda i jeżeli Medusa akurat nie odpowiedziała,
// pod adresem feedu zostawał zapieczony błąd — a Merchant Center widział go
// jako niedostępne źródło. Google pobiera feed raz na dobę, więc kilka zapytań
// do Medusy przy okazji niczego nie kosztuje.
export const dynamic = "force-dynamic"

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://marinero.pl"

// Marki rozpoznajemy po nazwie produktu — Medusa nie ma pola „marka".
const BRANDS = [
  "Suzuki",
  "Mercury",
  "Quicksilver",
  "Torqeedo",
  "Garmin",
  "Lowrance",
  "Fusion",
  "Simrad",
  "Navionics",
]

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Opis bez HTML-a i bez tabel specyfikacji — Google chce czystego tekstu. */
function plainDescription(product) {
  const raw = String(product.description || product.subtitle || product.title)
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4900)
}

function brandOf(title) {
  const lower = String(title || "").toLowerCase()
  return BRANDS.find((brand) => lower.includes(brand.toLowerCase())) || "Marinero"
}

/**
 * Google przyjmuje tylko `in_stock`, `out_of_stock` i `preorder`.
 * Nasze „7–10 dni" czy „14 dni" to wciąż towar dostępny — na zamówienie
 * i niedostępny idą jako `out_of_stock`, żeby nie obiecywać wysyłki.
 */
function availabilityFor(product) {
  const code = getAvailability(product.metadata, product.title).code
  if (code === "na-zamowienie") return "preorder"
  if (code === "niedostepny") return "out_of_stock"
  return "in_stock"
}

export async function GET() {
  let products = []

  try {
    products = await getAllShopProducts()
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Nie udało się pobrać produktów z Medusy" },
      { status: 502 }
    )
  }

  const items = products
    // Bez ceny i zdjęcia Google i tak odrzuci ofertę.
    .filter((product) => typeof product.price === "number" && product.thumbnail)
    .map((product) => {
      const sku = product.variants?.[0]?.sku || product.handle
      const brand = brandOf(product.title)

      // Kod kreskowy wpisuje sprzedawca w metadanych produktu (`ean`).
      // Bez niego Google chce jawnej deklaracji, że identyfikatora nie ma —
      // oferty z EAN-em mają jednak wyraźnie lepszą widoczność.
      const ean = String(product.metadata?.ean || "").replace(/\D/g, "")
      const identifiers = ean
        ? `      <g:gtin>${escapeXml(ean)}</g:gtin>`
        : `      <g:identifier_exists>no</g:identifier_exists>`

      const extraImages = (product.images || [])
        .map((image) => image.url)
        .filter((url) => url && url !== product.thumbnail)
        .slice(0, 10)
        .map((url) => `      <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`)
        .join("\n")

      return `    <item>
      <g:id>${escapeXml(sku)}</g:id>
      <g:title>${escapeXml(product.title.slice(0, 150))}</g:title>
      <g:description>${escapeXml(plainDescription(product))}</g:description>
      <g:link>${SITE}/sklep/produkt/${escapeXml(product.handle)}</g:link>
      <g:image_link>${escapeXml(product.thumbnail)}</g:image_link>
${extraImages}
      <g:availability>${availabilityFor(product)}</g:availability>
      <g:price>${product.price.toFixed(2)} PLN</g:price>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:mpn>${escapeXml(sku)}</g:mpn>
${identifiers}
      <g:product_type>${escapeXml(product.categories?.[0]?.name || "")}</g:product_type>
    </item>`
    })

  // Feed bez ani jednej oferty wygląda dla Google jak „sklep zamknięty"
  // i wygasza wszystkie pozycje. Wolimy powiedzieć wprost, że źródło padło.
  if (!items.length) {
    return NextResponse.json(
      { ok: false, error: "Medusa nie oddała ani jednego produktu z ceną i zdjęciem" },
      { status: 503 }
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Marinero — sklep motorowodny</title>
    <link>${SITE}/sklep</link>
    <description>Silniki zaburtowe, elektronika nawigacyjna, części i akcesoria.</description>
${items.join("\n")}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
