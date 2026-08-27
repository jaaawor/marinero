import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import { getShopProducts } from "@/lib/medusa"
import { SALES_CHANNELS, channelPrice, isChannelEligible } from "@/lib/channel-pricing"
import { listOffers, readAllegroConfig } from "@/lib/allegro"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function wszystkieProdukty() {
  const pierwsza = await getShopProducts({ limit: 100 })
  const produkty = [...pierwsza.products]

  for (let offset = 100; offset < Math.min(pierwsza.count, 1000); offset += 100) {
    const paczka = await getShopProducts({ limit: 100, offset })
    produkty.push(...paczka.products)
  }

  return produkty
}

/**
 * Zestawienie cen: co jest w sklepie, co stoi na Allegro i ile wyszłoby
 * z reguł w `channel-pricing.ts`. **Niczego nie wysyła** — to jest widok do
 * porównania, wysyłką zajmuje się osobno `POST /api/kanaly/sync`.
 */
export async function GET() {
  const token = await getAdminToken()
  if (!token) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  const kanal = SALES_CHANNELS.find((channel) => channel.id === "allegro")!
  const produkty = await wszystkieProdukty()

  const config = readAllegroConfig()
  let oferty: Awaited<ReturnType<typeof listOffers>> = []
  let bladAllegro = ""

  if (config) {
    try {
      oferty = await listOffers(config)
    } catch (error) {
      bladAllegro = error instanceof Error ? error.message : String(error)
    }
  }

  // Oferta wiąże się z produktem po sygnaturze sprzedawcy (`external.id`),
  // w którą wpisujemy SKU. Dopasowanie po nazwie jest bezużyteczne — nazwy
  // na Allegro są przycięte do limitu znaków i doprawione słowami kluczowymi.
  const poSku = new Map(oferty.filter((oferta) => oferta.signature).map((o) => [o.signature, o]))
  const uzyte = new Set<string>()

  const wiersze = produkty.map((produkt) => {
    const sku = produkt.variants[0]?.sku || ""
    const oferta = sku ? poSku.get(sku) : undefined
    if (oferta) uzyte.add(oferta.id)

    const kategorie = produkt.categories.map((kategoria) => kategoria.handle)
    const wgReguly = isChannelEligible(produkt.title, kanal)
      ? channelPrice(produkt.price, kanal, kategorie)
      : null

    return {
      sku,
      handle: produkt.handle,
      tytul: produkt.title,
      cenaSklep: produkt.price,
      cenaAllegro: oferta?.price ?? null,
      stanAllegro: oferta?.stock ?? null,
      ofertaId: oferta?.id ?? null,
      cenaWgReguly: wgReguly,
      roznica:
        typeof oferta?.price === "number" && typeof wgReguly === "number"
          ? Math.round((oferta.price - wgReguly) * 100) / 100
          : null,
    }
  })

  // Oferty, których nie umiemy przypiąć do produktu — zwykle brak SKU
  // w sygnaturze. Warto je pokazać, bo to one wypadną z synchronizacji.
  const bezProduktu = oferty
    .filter((oferta) => !uzyte.has(oferta.id))
    .map((oferta) => ({ id: oferta.id, nazwa: oferta.name, sku: oferta.signature, cena: oferta.price }))

  return NextResponse.json({
    polaczono: Boolean(config) && !bladAllegro,
    blad: bladAllegro || (config ? "" : "brak_danych_allegro"),
    produktow: wiersze.length,
    ofert: oferty.length,
    wiersze,
    bezProduktu,
  })
}
