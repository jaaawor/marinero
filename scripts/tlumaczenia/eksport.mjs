#!/usr/bin/env node
//
// Zbiera z Directusa i Medusy teksty, które widzi klient, i wypisuje te,
// dla których nie ma jeszcze tłumaczenia — w paczkach do przetłumaczenia.
//
//   node scripts/tlumaczenia/eksport.mjs            # raport
//   node scripts/tlumaczenia/eksport.mjs --paczki   # + pliki w `do-zrobienia/`
//
// Kluczem jest **skrót polskiego tekstu** (md5 po zwinięciu białych znaków),
// dokładnie ten sam, którego szuka `src/lib/content-translations.ts`. Dzięki
// temu ten sam napis przy dwudziestu łodziach tłumaczy się raz.

import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const DIRECTUS = process.env.NEXT_PUBLIC_DIRECTUS_URL || "https://dms.marinero.150197.pl"
const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const PK =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"

export const JEZYKI = ["en", "de", "fr", "ru", "uk", "it", "es"]

/** Ile krótkich tekstów w jednej paczce — tyle, żeby dało się je zrobić naraz. */
const PACZKA = 120

/**
 * Dłuższe teksty (opisy modeli, opisy produktów, artykuły) idą w paczkach po
 * kilka. Sto dwadzieścia akapitów po parę tysięcy znaków to paczka, której nie
 * da się przetłumaczyć w jednym podejściu.
 */
const DLUGI = 1200

/**
 * Przy długich tekstach liczy się **suma znaków**, nie liczba pozycji: sześć
 * artykułów z aktualności to bywa osiemdziesiąt tysięcy znaków w jednej
 * paczce, czyli po pomnożeniu przez siedem języków ponad pół miliona.
 */
const ZNAKOW_W_PACZCE = 6000

/**
 * Górna granica. Po wyczyszczeniu opisów modeli (widżety galerii z WordPressa
 * miały po 26 tys. znaków, a tekstu w nich było 292) najdłuższy tekst
 * w serwisie to artykuł z aktualności, poniżej 20 tys. znaków.
 */
const MAX_ZNAKOW = 25000

export function hash(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  return createHash("md5").update(normalized, "utf8").digest("hex")
}

/** Czy w tekście jest cokolwiek do tłumaczenia — czy to tylko liczby i kody. */
function warteTlumaczenia(text) {
  const t = String(text || "").trim()
  if (t.length < 3) return false
  // musi mieć choć jedno słowo z co najmniej trzema literami
  return /[a-ząćęłńóśźż]{3,}/i.test(t)
}

async function directus(collection, fields) {
  const rows = []
  for (let page = 1; page < 100; page++) {
    const url = `${DIRECTUS}/items/${collection}?limit=200&page=${page}&fields=${fields.join(",")}`
    const response = await fetch(url)
    if (!response.ok) break
    const data = (await response.json())?.data || []
    rows.push(...data)
    if (data.length < 200) break
  }
  return rows
}

async function medusa(path) {
  const response = await fetch(`${MEDUSA}/store${path}`, {
    headers: { "x-publishable-api-key": PK },
  })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
}

/** Wszystkie teksty widoczne dla klienta: `{hash: {source, context}}`. */
export async function zbierzTeksty() {
  const teksty = new Map()

  const dodaj = (value, context) => {
    const text = String(value || "").trim()
    if (!text || !warteTlumaczenia(text)) return
    const key = hash(text)
    if (!teksty.has(key)) teksty.set(key, { hash: key, source: text, context })
  }

  const zrodla = [
    ["boat_models", ["short_description", "description"], "opis modelu"],
    ["brands", ["description"], "opis marki"],
    ["news", ["title", "excerpt", "content"], "aktualności"],
    ["used_boats", ["short_description", "description", "vat_status", "location", "engines"], "giełda"],
    ["trailers", ["name", "description"], "przyczepy"],
    ["configurator_groups", ["title"], "grupa konfiguratora"],
    ["configurator_options", ["name", "description"], "opcja konfiguratora"],
    ["equipment_groups", ["title"], "grupa wyposażenia"],
    ["equipment_items", ["text"], "wyposażenie standardowe"],
    ["team", ["role"], "zespół"],
  ]

  for (const [collection, fields, context] of zrodla) {
    const rows = await directus(collection, fields)
    for (const row of rows) for (const field of fields) dodaj(row?.[field], context)
  }

  const produkty = []
  for (let offset = 0; ; offset += 200) {
    const { products, count } = await medusa(
      `/products?limit=200&offset=${offset}&fields=title,subtitle,description`
    )
    produkty.push(...products)
    if (produkty.length >= count || !products.length) break
  }
  for (const product of produkty) {
    dodaj(product.title, "nazwa produktu")
    dodaj(product.subtitle, "produkt — podtytuł")
    dodaj(product.description, "opis produktu")
  }

  const { product_categories: kategorie } = await medusa(
    "/product-categories?limit=200&fields=name,description"
  )
  for (const category of kategorie) {
    dodaj(category.name, "kategoria sklepu")
    dodaj(category.description, "opis kategorii")
  }

  return teksty
}

/** Skróty, dla których tłumaczenie już jest — po języku. */
export async function istniejace() {
  const mapa = new Map(JEZYKI.map((language) => [language, new Set()]))

  for (let page = 1; page < 500; page++) {
    const response = await fetch(
      `${DIRECTUS}/items/content_translations?fields=hash,language&limit=500&page=${page}`
    )
    if (!response.ok) break
    const rows = (await response.json())?.data || []
    for (const row of rows) mapa.get(row.language)?.add(row.hash)
    if (rows.length < 500) break
  }

  return mapa
}

/** Skróty leżące już w plikach `gotowe/` — jeszcze niezaimportowane. */
function wGotowych() {
  const katalog = join(KATALOG, "gotowe")
  const zrobione = new Set()
  if (!existsSync(katalog)) return zrobione

  for (const plik of readdirSync(katalog).filter((name) => name.endsWith(".json"))) {
    const dane = JSON.parse(readFileSync(join(katalog, plik), "utf8"))
    for (const wpis of dane.teksty || []) {
      if (JEZYKI.every((language) => wpis[language])) zrobione.add(wpis.hash)
    }
  }
  return zrobione
}

async function main() {
  const teksty = await zbierzTeksty()
  const gotowe = await istniejace()
  const wPlikach = wGotowych()

  // Do zrobienia: brakuje choć jednego języka i nie leży to w `gotowe/`.
  const brakujace = [...teksty.values()].filter(
    (wpis) =>
      !wPlikach.has(wpis.hash) && JEZYKI.some((language) => !gotowe.get(language).has(wpis.hash))
  )

  const dlugie = brakujace.filter((wpis) => wpis.source.length > MAX_ZNAKOW)
  const doPaczek = brakujace
    .filter((wpis) => wpis.source.length <= MAX_ZNAKOW)
    // Krótkie najpierw: to nazwy opcji i wyposażenia, czyli to, co widać
    // wszędzie. Długie opisy idą na koniec.
    .sort((a, b) => a.source.length - b.source.length || a.source.localeCompare(b.source, "pl"))

  console.log(`tekstów w serwisie:     ${teksty.size}`)
  for (const language of JEZYKI) {
    console.log(`  ${language}: przetłumaczonych ${gotowe.get(language).size}`)
  }
  console.log(`w plikach gotowe/:      ${wPlikach.size}`)
  console.log(`do zrobienia:           ${brakujace.length}`)
  console.log(`  w tym za długie:      ${dlugie.length} (powyżej ${MAX_ZNAKOW} znaków — do przepisania)`)
  console.log(`paczek do wystawienia:  ${Math.ceil(doPaczek.length / PACZKA)}`)

  if (!process.argv.includes("--paczki")) return

  const katalog = join(KATALOG, "do-zrobienia")
  mkdirSync(katalog, { recursive: true })

  // Krótkie i długie rozdzielamy: inaczej ostatnia paczka miałaby sto
  // dwadzieścia akapitów po kilka tysięcy znaków.
  const krotkie = doPaczek.filter((wpis) => wpis.source.length <= DLUGI)
  const dlugieTeksty = doPaczek.filter((wpis) => wpis.source.length > DLUGI)

  let numer = 0
  const zapisz = (paczka) => {
    numer += 1
    writeFileSync(
      join(katalog, `${String(numer).padStart(3, "0")}.json`),
      JSON.stringify({ jezyki: JEZYKI, teksty: paczka }, null, 2) + "\n"
    )
  }

  for (let i = 0; i < krotkie.length; i += PACZKA) zapisz(krotkie.slice(i, i + PACZKA))
  let biezaca = []
  let znakow = 0
  for (const wpis of dlugieTeksty) {
    if (biezaca.length && znakow + wpis.source.length > ZNAKOW_W_PACZCE) {
      zapisz(biezaca)
      biezaca = []
      znakow = 0
    }
    biezaca.push(wpis)
    znakow += wpis.source.length
  }
  if (biezaca.length) zapisz(biezaca)
  console.log(`  krótkich: ${krotkie.length}, długich: ${dlugieTeksty.length}`)
  console.log(`\nZapisane w ${katalog}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
