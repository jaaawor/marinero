#!/usr/bin/env node
//
// „Niezrealizowane produkty — nie mogę zrealizować".
//
// W Medusie 2 zamówienie realizuje się **z magazynu**, nawet gdy żaden produkt
// nie ma włączonego zarządzania stanem. Jeśli nie ma lokalizacji magazynowej,
// albo nie jest ona wpięta w kanał sprzedaży i w zestaw wysyłkowy, lista
// wyboru magazynu w oknie „Zrealizuj pozycje" jest pusta i przycisk nic nie robi.
//
// Ten skrypt sprawdza cały łańcuch i mówi, którego ogniwa brakuje.
//
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/diagnoza-realizacji.mjs
//
// Niczego nie zmienia — tylko czyta.

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""

async function admin(path) {
  const response = await fetch(`${MEDUSA_URL}${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${path} → ${response.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : {}
}

function stan(ok, tekst) {
  console.log(`${ok ? "  OK " : "  !! "} ${tekst}`)
  return ok
}

async function main() {
  if (!TOKEN) {
    console.error(
      "Brak MEDUSA_ADMIN_TOKEN. Na VPS-ie:\n" +
        "  cd /opt/marinero-frontend\n" +
        "  MEDUSA_ADMIN_TOKEN=$(grep '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2-) \\\n" +
        "    node scripts/medusa/diagnoza-realizacji.mjs"
    )
    process.exit(1)
  }

  let wszystko = true

  console.log("\n1. Magazyny (Ustawienia → Lokalizacje i wysyłka)")
  const { stock_locations: magazyny = [] } = await admin(
    "/admin/stock-locations?limit=50&fields=id,name,*sales_channels,*fulfillment_sets"
  )
  wszystko &= stan(magazyny.length > 0, `magazynów: ${magazyny.length}`)
  for (const m of magazyny) {
    console.log(`     • ${m.name} (${m.id})`)
    console.log(`       kanały sprzedaży: ${(m.sales_channels || []).map((k) => k.name).join(", ") || "BRAK"}`)
    console.log(`       zestawy wysyłkowe: ${(m.fulfillment_sets || []).map((z) => z.name).join(", ") || "BRAK"}`)
  }

  console.log("\n2. Kanały sprzedaży")
  const { sales_channels: kanaly = [] } = await admin("/admin/sales-channels?limit=20&fields=id,name")
  for (const k of kanaly) {
    const wpiety = magazyny.some((m) => (m.sales_channels || []).some((s) => s.id === k.id))
    wszystko &= stan(wpiety, `${k.name} — ${wpiety ? "wpięty w magazyn" : "NIE jest wpięty w żaden magazyn"}`)
  }

  console.log("\n3. Dostawcy realizacji włączeni w magazynach")
  for (const m of magazyny) {
    try {
      const { fulfillment_providers: dostawcy = [] } = await admin(
        `/admin/stock-locations/${m.id}/fulfillment-providers?limit=20`
      )
      wszystko &= stan(
        dostawcy.length > 0,
        `${m.name}: ${dostawcy.map((d) => d.id).join(", ") || "BRAK dostawcy — potrzebny „manual"}`
      )
    } catch (error) {
      console.log(`  ?? ${m.name}: nie udało się odczytać (${error.message})`)
    }
  }

  console.log("\n4. Opcje wysyłki")
  const { shipping_options: opcje = [] } = await admin(
    "/admin/shipping-options?limit=50&fields=id,name,provider_id,*service_zone"
  )
  wszystko &= stan(opcje.length > 0, `opcji: ${opcje.length}`)
  for (const o of opcje) {
    console.log(`     • ${o.name} — dostawca ${o.provider_id}, strefa ${o.service_zone?.name || "?"}`)
  }

  console.log("\n5. Zamówienia czekające na realizację")
  const { orders = [] } = await admin(
    "/admin/orders?limit=10&fields=id,display_id,status,fulfillment_status,payment_status"
  )
  for (const z of orders) {
    console.log(
      `     • #${z.display_id} — status ${z.status}, płatność ${z.payment_status}, realizacja ${z.fulfillment_status}`
    )
  }

  console.log(
    wszystko
      ? "\nŁańcuch wygląda kompletnie — jeśli przycisk dalej nie działa, przyślij zrzut błędu z panelu."
      : "\nPozycje oznaczone !! to brakujące ogniwa — od nich zacznij."
  )
}

main().catch((error) => {
  console.error(String(error.message || error))
  process.exit(1)
})
