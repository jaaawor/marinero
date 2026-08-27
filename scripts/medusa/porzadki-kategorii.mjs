#!/usr/bin/env node
//
// Porządki w drzewie kategorii sklepu — trzy wpisy, które zostały po imporcie
// z WooCommerce i nie powinny stać w nawigacji:
//
//   promocje-garmin  — worek na przecenione plotery; te same produkty leżą
//                      już w „GPSMAP" i „Echomap", więc dublowały się w menu.
//   suzuki-oleje     — druga „Suzuki" obok „Oleje Suzuki", z tymi samymi
//                      dwoma olejami ECSTAR. Komplet czterech jest w
//                      `oleje-suzuki`, więc ta zostaje.
//   lodzie-motorowe  — dwie łodzie Jeanneau w sklepie z częściami. Łodzie
//                      sprzedajemy na /gielda, więc produkty idą do szkiców.
//
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/porzadki-kategorii.mjs
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/porzadki-kategorii.mjs --zapis
//
// Front i tak już te kategorie pomija (`HIDDEN_SHOP_CATEGORIES`), więc skrypt
// tylko sprząta w panelu. Kolejność jest ważna: **najpierw sprawdzamy, czy
// produkt ma gdzie zostać**, i dopiero potem kasujemy kategorię. Odwrotnie
// wypadłby z katalogu bez śladu.

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")

/** Kategoria → co zrobić z produktami, które w niej zostaną same. */
const DO_KASACJI = [
  { handle: "promocje-garmin", osierocone: "zostaw" },
  { handle: "suzuki-oleje", osierocone: "zostaw" },
  { handle: "lodzie-motorowe", osierocone: "szkic" },
]

async function admin(path, init = {}) {
  const response = await fetch(`${MEDUSA_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(`${path} → ${response.status}: ${body?.message || text.slice(0, 200)}`)
  }
  return body
}

async function main() {
  if (!TOKEN) {
    console.error(
      "Brak MEDUSA_ADMIN_TOKEN. Klucz `sk_…` siedzi w .env.local na VPS-ie:\n" +
        "  cd /opt/marinero-frontend\n" +
        "  MEDUSA_ADMIN_TOKEN=$(grep '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2-) \\\n" +
        "    node scripts/medusa/porzadki-kategorii.mjs --zapis"
    )
    process.exit(1)
  }

  const { product_categories: kategorie } = await admin(
    "/admin/product-categories?limit=200&fields=id,name,handle"
  )

  for (const wpis of DO_KASACJI) {
    const kategoria = kategorie.find((k) => k.handle === wpis.handle)
    if (!kategoria) {
      console.log(`\n· ${wpis.handle} — już nie ma`)
      continue
    }

    const { products } = await admin(
      `/admin/products?category_id[]=${kategoria.id}&limit=100&fields=id,title,status,+categories.handle`
    )

    console.log(`\n== ${wpis.handle} (${kategoria.name}) — ${products.length} produktów`)

    for (const produkt of products) {
      const inne = (produkt.categories || []).filter((k) => k.handle !== wpis.handle)

      if (inne.length) {
        console.log(`   ${produkt.title}\n     zostaje w: ${inne.map((k) => k.handle).join(", ")}`)
        continue
      }

      if (wpis.osierocone === "szkic") {
        console.log(`   ${produkt.title}\n     jedyna kategoria → do szkiców`)
        if (ZAPIS && produkt.status !== "draft") {
          await admin(`/admin/products/${produkt.id}`, {
            method: "POST",
            body: JSON.stringify({ status: "draft" }),
          })
        }
        continue
      }

      console.log(`   ${produkt.title}\n     UWAGA: zostałby bez kategorii — kategorii nie kasuję`)
      wpis.blokada = true
    }

    if (wpis.blokada) continue

    console.log(`   → kasuję kategorię ${wpis.handle}`)
    if (ZAPIS) await admin(`/admin/product-categories/${kategoria.id}`, { method: "DELETE" })
  }

  console.log(ZAPIS ? "\nZapisane." : "\nPrzebieg na sucho — dodaj --zapis.")
}

main().catch((error) => {
  console.error(String(error.message || error))
  process.exit(1)
})
