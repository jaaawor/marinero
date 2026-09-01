// Eksport katalogu z cenami per kanał — CSV do ręcznego wystawienia
// i do sprawdzenia reguł cen, zanim ruszy synchronizacja przez API.
//
// GET /api/kanaly/eksport?kanal=allegro

import { getShopProducts } from "@/lib/medusa"
import { getAvailability } from "@/lib/availability"
import {
  SALES_CHANNELS,
  cenaZRegul,
  getChannel,
  isChannelEligible,
  pobierzReguly,
} from "@/lib/channel-pricing"

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://marinero.pl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function csvCell(value) {
  const text = String(value ?? "")
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET(request) {
  const url = new URL(request.url)
  const channel = getChannel(url.searchParams.get("kanal") || "allegro") || SALES_CHANNELS[0]

  // Reguły z panelu — plik w repozytorium jest tylko zapasem.
  const reguly = await pobierzReguly()

  const first = await getShopProducts({ limit: 100 })
  const products = [...first.products]
  for (let offset = 100; offset < Math.min(first.count, 1000); offset += 100) {
    const chunk = await getShopProducts({ limit: 100, offset })
    products.push(...chunk.products)
  }

  const rows = [
    [
      "sku",
      "nazwa",
      "kategoria",
      "cena_sklep",
      `cena_${channel.id}`,
      "stan",
      "dostepnosc",
      "url",
    ],
  ]

  for (const product of products) {
    if (!isChannelEligible(product.title, channel)) continue

    // Produkt oznaczony w panelu jako „nie sprzedajemy na Allegro" nie wchodzi
    // do eksportu. Oznaczenie ma znaczyć to samo we wszystkich miejscach —
    // inaczej sprzedawca odhaczałby zakaz w panelu, a plik i tak niósłby
    // pozycję dalej.
    if (product.metadata?.bez_allegro === true) continue

    const availability = getAvailability(product.metadata, product.title)
    const categories = product.categories.map((category) => category.handle)

    rows.push([
      product.variants[0]?.sku || "",
      product.title,
      product.categories[0]?.name || "",
      product.price ?? "",
      cenaZRegul(product.price, reguly[channel.id], categories) ?? "",
      availability.quantity ||
        (availability.code === "od-reki" || availability.code === "2-3-dni" ? 1 : 0),
      availability.code,
      `${SITE}/sklep/produkt/${product.handle}`,
    ])
  }

  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n")

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marinero-${channel.id}.csv"`,
    },
  })
}
