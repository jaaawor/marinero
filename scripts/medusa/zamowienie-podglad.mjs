#!/usr/bin/env node
//
// Surowy kształt zamówienia z Medusy — do sprawdzenia, czy panel czyta
// właściwe pola.
//
//   cd /opt/marinero-frontend
//   node scripts/medusa/zamowienie-podglad.mjs
//
// Panel mapuje pola Medusy na polskie nazwy (`src/lib/medusa-admin.ts`).
// Gdy w panelu któraś kolumna świeci pustką, to zwykle znaczy, że Medusa
// trzyma tę wartość gdzie indziej — ten skrypt pokazuje, gdzie.
//
// Sam odczyt, niczego nie zmienia. Kluczy nie wypisuje.

import { wczytajSrodowisko } from "../lib/env.mjs"

// Czytamy `.env.local`, `.env.production` i `.env` — tak jak strona.
// Samo `--env-file=.env.local` widziało tylko jeden z nich, więc klucz
// ustawiony gdzie indziej wyglądał na nieistniejący.
wczytajSrodowisko()

const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const token = process.env.MEDUSA_ADMIN_TOKEN || ""

if (!token) {
  console.error("Brak MEDUSA_ADMIN_TOKEN w .env.local.")
  process.exit(1)
}

// Medusa 2 uwierzytelnia klucz `sk_…` przez HTTP Basic (klucz jako login,
// puste hasło). Nagłówek `x-medusa-access-token` z Medusy 1 zwraca 401.
const basic = `Basic ${Buffer.from(`${token}:`).toString("base64")}`

const pola = [
  "id", "display_id", "status", "email", "currency_code", "total",
  "payment_status", "fulfillment_status", "created_at",
  "+metadata", "*items", "*shipping_methods", "*shipping_address",
].join(",")

const odp = await fetch(`${MEDUSA}/admin/orders?limit=1&order=-created_at&fields=${pola}`, {
  headers: { Authorization: basic },
})

if (!odp.ok) {
  console.error(`Medusa odpowiedziała ${odp.status}`)
  console.error((await odp.text()).slice(0, 500))
  process.exit(1)
}

const dane = await odp.json()
const zamowienie = (dane.orders || [])[0]

console.log(`Zamówień w sklepie: ${dane.count ?? "?"}`)

if (!zamowienie) {
  console.log("Nie ma jeszcze żadnego zamówienia — nie ma czego sprawdzać.")
  process.exit(0)
}

console.log("\nNajnowsze zamówienie — pola, które czyta panel:\n")
const podglad = (nazwa, wartosc) =>
  console.log(`  ${nazwa.padEnd(22)} ${wartosc === undefined ? "— BRAK POLA —" : JSON.stringify(wartosc)}`)

podglad("display_id", zamowienie.display_id)
podglad("created_at", zamowienie.created_at)
podglad("email", zamowienie.email)
podglad("total", zamowienie.total)
podglad("currency_code", zamowienie.currency_code)
podglad("payment_status", zamowienie.payment_status)
podglad("fulfillment_status", zamowienie.fulfillment_status)
podglad("metadata", zamowienie.metadata)
podglad("shipping_address", zamowienie.shipping_address)
podglad("shipping_methods[0]", zamowienie.shipping_methods?.[0]?.name)
podglad("items.length", zamowienie.items?.length)

if (zamowienie.items?.[0]) {
  const p = zamowienie.items[0]
  console.log("\n  pierwsza pozycja:")
  for (const k of ["product_title", "title", "variant_title", "variant_sku", "quantity", "unit_price", "total"]) {
    console.log(`    ${k.padEnd(20)} ${JSON.stringify(p[k])}`)
  }
}

console.log("\nGotowe. Niczego nie zmieniono.")
