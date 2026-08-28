#!/usr/bin/env node
//
// Przenosi wagi (i wymiary) produktów ze starego sklepu WooCommerce do Medusy.
//
// Migracja z WooCommerce zgubiła wagi — w Medusie nie ma ich ani jedna sztuka,
// a bez nich nie da się policzyć wysyłki wg cennika (`src/lib/wysylka.ts`).
// Stary sklep wystawia je publicznie przez Store API i dopóki stoi, jest
// najprostszym źródłem.
//
//   node scripts/medusa/wagi-ze-starego-sklepu.mjs            # na sucho
//   node scripts/medusa/wagi-ze-starego-sklepu.mjs --zapis
//
// Wymaga MEDUSA_ADMIN_TOKEN. Uruchamiać na VPS-ie:
//   cd /opt/marinero-frontend
//   export MEDUSA_ADMIN_TOKEN=$(sed -n 's/^MEDUSA_ADMIN_TOKEN=//p' .env.local | tr -d '"' | tr -d "'")
//     node scripts/medusa/wagi-ze-starego-sklepu.mjs
//
// UWAGA na jednostki: WooCommerce podaje wagę w **kilogramach** („1" to 1 kg),
// a my zapisujemy w Medusie **gramy** — tak zakłada `src/lib/wysylka.ts`.
// Wymiary WooCommerce podaje w centymetrach i tak je zostawiamy.

const STARY_SKLEP = "https://sklep.marinero.pl/wp-json/wc/store/v1"
const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")

if (!TOKEN) {
  console.error("Brak MEDUSA_ADMIN_TOKEN — patrz nagłówek pliku.")
  process.exit(1)
}

// Medusa 2 przyjmuje klucz `sk_…` przez HTTP Basic: klucz jako login, puste hasło.
const BASIC = `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`

async function admin(sciezka, init = {}) {
  const odpowiedz = await fetch(`${MEDUSA}${sciezka}`, {
    ...init,
    headers: { Authorization: BASIC, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  const tresc = await odpowiedz.text()
  if (!odpowiedz.ok) throw new Error(`${sciezka} → ${odpowiedz.status}: ${tresc.slice(0, 200)}`)
  return tresc ? JSON.parse(tresc) : {}
}

async function stareProdukty() {
  const wszystkie = []
  for (let strona = 1; strona <= 20; strona += 1) {
    const odpowiedz = await fetch(`${STARY_SKLEP}/products?per_page=100&page=${strona}`)
    if (!odpowiedz.ok) break
    const paczka = await odpowiedz.json()
    if (!Array.isArray(paczka) || !paczka.length) break
    wszystkie.push(...paczka)
    if (paczka.length < 100) break
  }
  return wszystkie
}

async function produktyMedusy() {
  const wszystkie = []
  for (let offset = 0; offset < 3000; offset += 100) {
    const dane = await admin(`/admin/products?limit=100&offset=${offset}&fields=handle,title,*variants`)
    wszystkie.push(...(dane.products || []))
    if ((dane.products || []).length < 100) break
  }
  return wszystkie
}

const stare = await stareProdukty()
const zWaga = stare.filter((p) => Number(p.weight) > 0)
console.log(`stary sklep: ${stare.length} produktów, w tym ${zWaga.length} z wagą`)

// Uchwyty przeszły z WooCommerce do Medusy bez zmian, więc slug = handle.
// SKU zostaje jako druga szansa — kilka pozycji ma inny uchwyt niż dawniej.
const poUchwycie = new Map(zWaga.map((p) => [p.slug, p]))
const poSku = new Map(zWaga.filter((p) => p.sku).map((p) => [p.sku, p]))

const nowe = await produktyMedusy()
console.log(`Medusa: ${nowe.length} produktów`)

const doZapisu = []
const bezPary = []

for (const produkt of nowe) {
  const wariant = (produkt.variants || [])[0]
  if (!wariant) continue
  if (Number(wariant.weight) > 0) continue // już ma wagę — nie ruszamy

  const stary = poUchwycie.get(produkt.handle) || (wariant.sku ? poSku.get(wariant.sku) : null)
  if (!stary) {
    bezPary.push(produkt.title)
    continue
  }

  const wymiary = stary.dimensions || {}
  doZapisu.push({
    produktId: produkt.id,
    wariantId: wariant.id,
    tytul: produkt.title,
    kg: Number(stary.weight),
    zmiany: {
      weight: Math.round(Number(stary.weight) * 1000),
      ...(Number(wymiary.length) ? { length: Math.round(Number(wymiary.length)) } : {}),
      ...(Number(wymiary.width) ? { width: Math.round(Number(wymiary.width)) } : {}),
      ...(Number(wymiary.height) ? { height: Math.round(Number(wymiary.height)) } : {}),
    },
  })
}

console.log(`\ndo uzupełnienia: ${doZapisu.length}`)
console.log(`bez pary w starym sklepie: ${bezPary.length}`)
for (const tytul of bezPary.slice(0, 10)) console.log("   ", tytul.slice(0, 60))
if (bezPary.length > 10) console.log(`    … i ${bezPary.length - 10} więcej`)

console.log("\nprzykłady:")
for (const wpis of doZapisu.slice(0, 8)) {
  console.log(`   ${String(wpis.kg).padStart(6)} kg  ${wpis.tytul.slice(0, 55)}`)
}

if (!ZAPIS) {
  console.log("\nPrzebieg na sucho — dodaj --zapis, żeby wgrać.")
  process.exit(0)
}

let zapisane = 0
const bledy = []
for (const wpis of doZapisu) {
  try {
    await admin(`/admin/products/${wpis.produktId}/variants/${wpis.wariantId}`, {
      method: "POST",
      body: JSON.stringify(wpis.zmiany),
    })
    zapisane += 1
    if (zapisane % 25 === 0) console.log(`  zapisane ${zapisane} / ${doZapisu.length}`)
  } catch (error) {
    bledy.push(`${wpis.tytul.slice(0, 40)}: ${error.message}`)
  }
}

console.log(`\nZapisane: ${zapisane} / ${doZapisu.length}`)
if (bledy.length) {
  console.log(`Błędy (${bledy.length}):`)
  for (const blad of bledy.slice(0, 10)) console.log("   ", blad)
}
