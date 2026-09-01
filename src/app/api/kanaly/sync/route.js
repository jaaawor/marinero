// Synchronizacja cen i stanów z Allegro (OLX dojdzie, gdy będzie dostęp do API).
//
// Bez kompletu zmiennych `ALLEGRO_*` endpoint działa w trybie podglądu:
// liczy, co zostałoby wysłane, i zwraca plan — dzięki temu da się sprawdzić
// reguły cen zanim konto sprzedażowe w ogóle istnieje.
//
// Wywołanie: POST /api/kanaly/sync  (nagłówek `x-sync-token`, gdy ustawiony
// `CHANNEL_SYNC_TOKEN`). Docelowo woła to cron na VPS-ie.

import { getShopProducts } from "@/lib/medusa"
import { getAvailability } from "@/lib/availability"
import { SALES_CHANNELS, cenaZRegul, isChannelEligible, pobierzReguly } from "@/lib/channel-pricing"
import { listOffers, readAllegroConfig, updateOffer } from "@/lib/allegro"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function loadCatalog() {
  const first = await getShopProducts({ limit: 100 })
  const products = [...first.products]

  for (let offset = 100; offset < Math.min(first.count, 1000); offset += 100) {
    const chunk = await getShopProducts({ limit: 100, offset })
    products.push(...chunk.products)
  }

  return products
}

// Stan do wystawienia na portalu: liczba sztuk z panelu, a gdy sprzedawca jej
// nie poda — 1 dla towaru „od ręki", 0 dla rzeczy na zamówienie.
function stockFor(product) {
  const availability = getAvailability(product.metadata, product.title)
  if (availability.quantity > 0) return availability.quantity
  if (availability.code === "od-reki" || availability.code === "2-3-dni") return 1
  return 0
}

export async function POST(request) {
  const expected = process.env.CHANNEL_SYNC_TOKEN
  if (expected && request.headers.get("x-sync-token") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const products = await loadCatalog()
  // Reguły z panelu — plik w repozytorium jest tylko zapasem.
  const reguly = await pobierzReguly()

  const plan = products.flatMap((product) => {
    // Zakaz sprzedaży na Allegro z panelu obowiązuje też tutaj — synchronizacja
    // ma robić to samo, co mówi oznaczenie przy produkcie.
    if (product.metadata?.bez_allegro === true) return []

    const sku = product.variants[0]?.sku || ""
    const categories = product.categories.map((category) => category.handle)

    return SALES_CHANNELS.filter((channel) => isChannelEligible(product.title, channel)).map(
      (channel) => ({
        channel: channel.id,
        sku,
        title: product.title,
        shopPrice: product.price,
        channelPrice: cenaZRegul(product.price, reguly[channel.id], categories),
        stock: stockFor(product),
      })
    )
  })

  const config = readAllegroConfig()
  if (!config) {
    return Response.json({
      mode: "podglad",
      reason: "brak_danych_allegro",
      products: products.length,
      sample: plan.slice(0, 10),
    })
  }

  // Ofertę łączymy z produktem po sygnaturze sprzedawcy (external.id = SKU).
  const offers = await listOffers(config)
  const bySignature = new Map(offers.map((offer) => [offer.signature, offer]))

  const results = { updated: 0, skipped: 0, errors: [] }

  for (const item of plan.filter((entry) => entry.channel === "allegro")) {
    const offer = bySignature.get(item.sku)
    if (!offer || !item.channelPrice) {
      results.skipped++
      continue
    }

    const samePrice = Math.abs(offer.price - item.channelPrice) < 0.01
    const sameStock = offer.stock === item.stock
    if (samePrice && sameStock) {
      results.skipped++
      continue
    }

    try {
      await updateOffer(config, offer.id, {
        price: samePrice ? undefined : item.channelPrice,
        stock: sameStock ? undefined : item.stock,
      })
      results.updated++
    } catch (error) {
      results.errors.push(`${item.sku}: ${String(error).slice(0, 160)}`)
    }
  }

  return Response.json({ mode: "sync", products: products.length, ...results })
}
