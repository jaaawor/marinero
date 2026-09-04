#!/usr/bin/env node
//
// Opisy produktów Garmina i JL Audio → Medusa.
//
//   node scripts/garmin/opisy.mjs                  # podgląd
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/garmin/opisy.mjs --zapisz
//
// Import zakładał produkty z opisem jednozdaniowym — nazwa i numer katalogowy.
// Na stronie produktu wyglądało to jak dziura, bo to nie jest opis, tylko
// podpis. Właściwe teksty siedzą w `opisy.json`, napisane z materiałów
// producenta (strony garmin.com/pl-PL i ogłoszeń premierowych).
//
// Skrypt **wysyła samo pole `description`**. To ważne: aktualizacja produktu
// w Medusie traktuje `variants`, `images` i `categories` jak komplet, więc
// wysłanie ich niepełnych skasowałoby resztę.
//
// Produkty poznajemy po **numerze katalogowym w SKU wariantu**, nie po nazwie —
// nazwa w sklepie bywa poprawiona ręcznie, numer katalogowy nie.
//
// Domyślnie **nie nadpisuje opisu, który ktoś już poprawił**: jeśli w Medusie
// stoi coś innego niż opis z importu, skrypt zostawia go w spokoju i mówi
// o tym wprost. `--nadpisz` wymusza podmianę.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import "../lib/env.mjs"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")
const NADPISZ = process.argv.includes("--nadpisz")

function autoryzacja() {
  return `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`
}

async function admin(sciezka, init = {}) {
  const odpowiedz = await fetch(`${MEDUSA_URL}${sciezka}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: autoryzacja(), "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
  })
  const tekst = await odpowiedz.text()
  const tresc = tekst ? JSON.parse(tekst) : {}
  if (!odpowiedz.ok) {
    throw new Error(`${sciezka} → ${odpowiedz.status}: ${tresc?.message || tekst.slice(0, 300)}`)
  }
  return tresc
}

/** Opis dla numeru katalogowego: tekst rodziny plus zdanie o wersji. */
function opisDla(sku, produkt, rodziny) {
  const rodzina = Object.values(rodziny).find((r) => r.sku.includes(sku))
  if (!rodzina) return ""

  const wariant = (produkt?.wariant || "").replace(/[™®]/g, "").replace(/\s+/g, " ").trim()
  // Zdanie o wersji ma sens tylko wtedy, gdy rodzina ma ich kilka — przy
  // jednym wariancie powtarzałoby nazwę produktu stojącą tuż nad opisem.
  const dopisek =
    rodzina.sku.length > 1 && wariant ? `\n\nTa wersja: ${wariant}.` : ""

  return `${rodzina.opis.trim()}${dopisek}`
}

async function main() {
  const zrodlo = JSON.parse(readFileSync(join(KATALOG, "produkty.json"), "utf8"))
  const { rodziny } = JSON.parse(readFileSync(join(KATALOG, "opisy.json"), "utf8"))
  const produkty = zrodlo.produkty || []

  if (!TOKEN) {
    console.log("Brak MEDUSA_ADMIN_TOKEN — pokazuję same opisy.\n")
    for (const p of produkty) {
      const opis = opisDla(p.sku, p, rodziny)
      console.log(`── ${p.sku}  ${p.nazwa.replace(/[™®]/g, "")}`)
      console.log(`${opis.split("\n\n")[0].slice(0, 160)}…\n`)
    }
    console.log("Na VPS-ie:  node scripts/garmin/opisy.mjs --zapisz")
    return
  }

  let zmienione = 0
  let pominiete = 0
  let brakujace = 0

  for (const p of produkty) {
    const opis = opisDla(p.sku, p, rodziny)
    if (!opis) {
      console.log(`? ${p.sku}: nie mam dla niego opisu w opisy.json`)
      brakujace += 1
      continue
    }

    const { products } = await admin(
      `/admin/products?variants.sku=${encodeURIComponent(p.sku)}&fields=id,title,description&limit=1`
    )
    const produkt = products?.[0]
    if (!produkt) {
      console.log(`? ${p.sku}: nie ma takiego produktu w sklepie`)
      brakujace += 1
      continue
    }

    if (produkt.description === opis) {
      console.log(`= ${p.sku} opis już aktualny`)
      pominiete += 1
      continue
    }

    // Opis z importu wyglądał tak: „<tytuł>. Numer katalogowy producenta: <SKU>."
    // Wszystko inne znaczy, że ktoś go pisał ręcznie.
    const zImportu =
      !produkt.description || produkt.description.includes(`Numer katalogowy producenta: ${p.sku}`)
    if (!zImportu && !NADPISZ) {
      console.log(`! ${p.sku}: opis był poprawiany ręcznie — zostawiam (--nadpisz wymusza)`)
      pominiete += 1
      continue
    }

    console.log(`+ ${p.sku} ${produkt.title}`)
    if (!ZAPISZ) continue

    // Samo `description` — bez `variants`, `images` i `categories`, które
    // Medusa traktuje jak komplet.
    await admin(`/admin/products/${produkt.id}`, {
      method: "POST",
      body: JSON.stringify({ description: opis }),
    })
    zmienione += 1
  }

  console.log("")
  if (!ZAPISZ) {
    console.log("Przebieg na sucho — dodaj --zapisz.")
    return
  }
  console.log(`Gotowe: ${zmienione} opisów zapisanych, ${pominiete} pominiętych, ${brakujace} bez pary.`)
  console.log("Strona produktu odświeży się przy najbliższym ISR (do 5 minut).")
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
