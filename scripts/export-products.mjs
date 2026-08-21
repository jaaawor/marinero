#!/usr/bin/env node
//
// Eksport katalogu ze sklepu do CSV — do arkusza „Obecne produkty"
// w `import/marinero-produkty.xlsx`.
//
//   node scripts/export-products.mjs > /tmp/produkty.csv
//
// Czyta publiczne Store API (klucz `pk_...`), więc niczego nie zmienia.
// Ceny wymagają kontekstu regionu, inaczej Medusa zwraca
// „Missing required pricing context to calculate prices - region_id".

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"

const FIELDS = "*variants.calculated_price,+variants.sku,*categories,+metadata"

async function api(path, params = {}) {
  const url = new URL(`${MEDUSA_URL}/store${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))

  const response = await fetch(url, { headers: { "x-publishable-api-key": KEY } })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)

  return response.json()
}

function csvCell(value) {
  const text = String(value ?? "")
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function main() {
  const { regions } = await api("/regions")
  const region = regions.find((item) => String(item.currency_code).toLowerCase() === "pln")
  if (!region) throw new Error("Brak regionu z walutą PLN")

  const rows = []
  let offset = 0
  let count = 0

  do {
    const data = await api("/products", {
      limit: 100,
      offset,
      region_id: region.id,
      fields: FIELDS,
    })

    count = data.count || 0

    for (const product of data.products || []) {
      const variant = product.variants?.[0] || {}
      const price = variant.calculated_price?.calculated_amount

      rows.push([
        variant.sku || "",
        product.title || "",
        typeof price === "number" ? price.toFixed(2).replace(".", ",") : "",
        product.categories?.[0]?.name || "",
        product.metadata?.dostepnosc || "",
        product.metadata?.ean || "",
      ])
    }

    offset += 100
  } while (offset < count)

  rows.sort((a, b) => a[3].localeCompare(b[3], "pl") || a[1].localeCompare(b[1], "pl"))

  // Średnik i BOM — polski Excel otwiera taki plik bez kreatora importu.
  const header = ["SKU", "Nazwa", "Cena brutto (zł)", "Kategoria", "Dostępność", "EAN"]
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"))

  process.stdout.write("﻿" + lines.join("\n") + "\n")
  process.stderr.write(`Wyeksportowano ${rows.length} produktów.\n`)
}

main().catch((error) => {
  process.stderr.write(`Błąd: ${error.message}\n`)
  process.exit(1)
})
