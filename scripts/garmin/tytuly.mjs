#!/usr/bin/env node
//
// Krótsze nazwy sklepowe dla nowości Garmina i JL Audio — plus rodziny, czyli
// wybór wersji na stronie produktu.
//
//   node scripts/garmin/tytuly.mjs                  # podgląd
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/garmin/tytuly.mjs --zapisz
//   ... --zapisz --bez-adresow                      # sama nazwa, adres zostaje
//
// Producent pakuje w tytuł cały opis wersji: „Przewodowy zestaw żeglarski
// GMI 40 — 52 mm — Dwa instrumenty morskie GMI 40; gWind Wired oraz
// przetworniki DST820" to 105 znaków. Taka nazwa rozpycha tabele w panelu
// i nie mieści się na kafelku w sklepie. Szczegóły wersji siedzą w opisie —
// w tytule zostaje marka, model i to, co odróżnia wariant.
//
// **Adres produktu zmieniamy razem z nazwą**, bo powstał z tej samej długiej
// nazwy i bywał ucięty w połowie słowa (`...-i-wyswietlaczem-z`). Robimy to
// teraz, dopóki nic do tych produktów nie linkuje: później zmiana adresu
// znaczyłaby zepsute odnośniki i utratę tego, co zdążył zaindeksować Google.
// `--bez-adresow` zostawia adresy w spokoju.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import "../lib/env.mjs"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")
const BEZ_ADRESOW = process.argv.includes("--bez-adresow")

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

function uchwyt(tytul) {
  return tytul
    .toLowerCase()
    .replace(/[™®©]/g, " ")
    .replace(/[„”"″’'—–]/g, " ")
    .replace(/×/g, "x")
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e").replace(/ł/g, "l")
    .replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s").replace(/[żź]/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function main() {
  const { tytuly, rodziny } = JSON.parse(readFileSync(join(KATALOG, "tytuly.json"), "utf8"))
  const wpisy = Object.entries(tytuly)

  if (!TOKEN) {
    console.log("Brak MEDUSA_ADMIN_TOKEN — pokazuję same nazwy.\n")
    for (const [sku, tytul] of wpisy) {
      console.log(`${sku}  ${tytul}`)
      console.log(`            /sklep/produkt/${uchwyt(tytul)}\n`)
    }
    console.log("Na VPS-ie:  node scripts/garmin/tytuly.mjs --zapisz")
    return
  }

  let zmienione = 0
  let pominiete = 0
  let brakujace = 0

  for (const [sku, tytul] of wpisy) {
    const { products } = await admin(
      `/admin/products?variants.sku=${encodeURIComponent(sku)}&fields=id,title,handle,+metadata&limit=1`
    )
    const produkt = products?.[0]
    if (!produkt) {
      console.log(`? ${sku}: nie ma takiego produktu w sklepie`)
      brakujace += 1
      continue
    }

    const nowyUchwyt = BEZ_ADRESOW ? produkt.handle : uchwyt(tytul)
    const rodzina = rodziny?.[sku] || null
    const rodzinaJest =
      !rodzina ||
      ((produkt.metadata || {}).rodzina === rodzina.rodzina &&
        (produkt.metadata || {}).wersja === rodzina.wersja)

    if (produkt.title === tytul && produkt.handle === nowyUchwyt && rodzinaJest) {
      console.log(`= ${sku} już aktualne`)
      pominiete += 1
      continue
    }

    console.log(`+ ${sku}`)
    console.log(`    ${produkt.title}`)
    console.log(`  → ${tytul}`)
    if (produkt.handle !== nowyUchwyt) {
      console.log(`    /sklep/produkt/${produkt.handle}`)
      console.log(`  → /sklep/produkt/${nowyUchwyt}`)
    }
    if (rodzina && !rodzinaJest) {
      console.log(`    rodzina: ${rodzina.rodzina} · wersja: ${rodzina.wersja}`)
    }
    if (!ZAPISZ) continue

    // Samo `title` i `handle` — `variants`, `images` i `categories` Medusa
    // traktuje jak komplet, więc niepełne skasowałyby resztę.
    await admin(`/admin/products/${produkt.id}`, {
      method: "POST",
      // `metadata` się **scala**, więc dopisanie rodziny nie rusza dostępności,
      // notatki ani reszty. To odwrotnie niż `images` i `categories`.
      body: JSON.stringify({
        title: tytul,
        ...(BEZ_ADRESOW ? {} : { handle: nowyUchwyt }),
        ...(rodzina ? { metadata: { rodzina: rodzina.rodzina, wersja: rodzina.wersja } } : {}),
      }),
    })
    zmienione += 1
  }

  console.log("")
  if (!ZAPISZ) {
    console.log("Przebieg na sucho — dodaj --zapisz.")
    return
  }
  console.log(`Gotowe: ${zmienione} zmienionych, ${pominiete} bez zmian, ${brakujace} bez pary.`)
  if (!BEZ_ADRESOW) {
    console.log("Adresy się zmieniły — jeśli aktualność ma już listę odnośników, puść ją ponownie:")
    console.log("  node scripts/news/garmin-wrzesien-2026.mjs --produkty --zapisz")
  }
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
