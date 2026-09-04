#!/usr/bin/env node
//
// Galerie zdjęć nowości Garmina i JL Audio → Medusa.
//
//   node scripts/garmin/zdjecia.mjs                  # podgląd
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/garmin/zdjecia.mjs --zapisz
//
// Import wgrywał **jeden** kadr — pakshot na białym tle. Strona produktu
// wyglądała przy tym biednie obok strony producenta, która pokazuje sprzęt
// zamontowany na pokładzie. Adresy całej galerii zbiera `pobierz.mjs`
// (pole `zdjecia` w `produkty.json`).
//
// Zdjęcia, których produkt jeszcze nie ma, **dokładamy** — nie podmieniamy
// całej listy. Medusa traktuje `images` jak komplet, więc wysyłamy to, co już
// jest, plus nowe; miniatura zostaje ta sama, żeby kafelek w sklepie nie
// zmienił się przy okazji.
//
// Pary adres → plik w Medusie pamiętamy w metadanej `zdjecia_zrodlo`. Bez tego
// drugi przebieg wgrałby wszystko jeszcze raz: w Medusie adresy są już nasze
// i po niczym nie widać, z czego powstały.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import "../lib/env.mjs"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")

function autoryzacja() {
  return `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`
}

async function admin(sciezka, init = {}) {
  const odpowiedz = await fetch(`${MEDUSA_URL}${sciezka}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: autoryzacja(),
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
    signal: AbortSignal.timeout(60000),
  })
  const tekst = await odpowiedz.text()
  const tresc = tekst ? JSON.parse(tekst) : {}
  if (!odpowiedz.ok) {
    throw new Error(`${sciezka} → ${odpowiedz.status}: ${tresc?.message || tekst.slice(0, 300)}`)
  }
  return tresc
}

async function wgraj(adres, nazwa) {
  const odpowiedz = await fetch(adres, { signal: AbortSignal.timeout(30000) })
  if (!odpowiedz.ok) throw new Error(`HTTP ${odpowiedz.status}`)
  const bajty = Buffer.from(await odpowiedz.arrayBuffer())

  // Nagłówek pliku, nie rozmiar: serwer potrafi oddać stronę HTML z kodem 200,
  // a Medusa przyjmie dokument HTML podpisany jako `image/jpeg` i zostawi
  // w sklepie ikonę zepsutego obrazka.
  if (!(bajty[0] === 0xff && bajty[1] === 0xd8)) throw new Error("to nie jest JPEG")

  const dane = new FormData()
  dane.append("files", new Blob([bajty], { type: "image/jpeg" }), `${nazwa}.jpg`)
  const wynik = await admin("/admin/uploads", { method: "POST", body: dane })
  return wynik?.files?.[0]?.url || ""
}

async function main() {
  const zrodlo = JSON.parse(readFileSync(join(KATALOG, "produkty.json"), "utf8"))
  const produkty = zrodlo.produkty || []

  if (!TOKEN) {
    console.log("Brak MEDUSA_ADMIN_TOKEN — pokazuję, ile kadrów mamy do wgrania.\n")
    for (const p of produkty) {
      console.log(`${String(p.zdjecia?.length || 0).padStart(2)}  ${p.sku}  ${p.nazwa.replace(/[™®]/g, "")}`)
    }
    console.log("\nNa VPS-ie:  node scripts/garmin/zdjecia.mjs --zapisz")
    return
  }

  let dolozone = 0
  let bezZmian = 0

  for (const p of produkty) {
    const adresy = p.zdjecia || []
    if (!adresy.length) continue

    const { products } = await admin(
      `/admin/products?variants.sku=${encodeURIComponent(p.sku)}&fields=id,title,thumbnail,images.id,images.url,+metadata&limit=1`
    )
    const produkt = products?.[0]
    if (!produkt) {
      console.log(`? ${p.sku}: nie ma takiego produktu w sklepie`)
      continue
    }

    const zrodla = { ...((produkt.metadata || {}).zdjecia_zrodlo || {}) }
    const brakujace = adresy.filter((adres) => !zrodla[adres])
    if (!brakujace.length) {
      console.log(`= ${p.sku} ma już komplet (${adresy.length})`)
      bezZmian += 1
      continue
    }

    console.log(`+ ${p.sku} ${produkt.title} — dokładam ${brakujace.length} z ${adresy.length}`)
    if (!ZAPISZ) continue

    for (const [numer, adres] of brakujace.entries()) {
      try {
        const url = await wgraj(adres, `${p.sku}-${numer + 1}`)
        if (url) zrodla[adres] = url
      } catch (problem) {
        console.log(`  ! ${adres.split("/").pop()}: ${problem.message}`)
      }
    }

    // Kolejność jak w źródle: pakshot pierwszy, dalej kadry z sesji. To, co
    // produkt już ma, zostaje na swoim miejscu — miniatura się nie zmienia.
    const juzMa = (produkt.images || []).map((obraz) => obraz.url)
    const nowe = adresy.map((adres) => zrodla[adres]).filter((url) => url && !juzMa.includes(url))
    if (!nowe.length) {
      console.log(`  ! ${p.sku}: nic się nie wgrało`)
      continue
    }

    await admin(`/admin/products/${produkt.id}`, {
      method: "POST",
      body: JSON.stringify({
        // `images` Medusa traktuje jak komplet — wysyłamy pełną listę.
        images: [...juzMa, ...nowe].map((url) => ({ url })),
        // `metadata` się scala, więc para adres → plik dopisuje się bez ruszania
        // dostępności i notatki.
        metadata: { zdjecia_zrodlo: zrodla },
        ...(produkt.thumbnail ? {} : { thumbnail: nowe[0] }),
      }),
    })
    dolozone += nowe.length
  }

  console.log("")
  console.log(
    ZAPISZ
      ? `Gotowe: ${dolozone} nowych kadrów, ${bezZmian} produktów bez zmian.`
      : "Przebieg na sucho — dodaj --zapisz."
  )
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
