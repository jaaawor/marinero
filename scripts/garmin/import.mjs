#!/usr/bin/env node
//
// Nowości Garmina i JL Audio z września 2026 → produkty w Medusie.
//
//   node scripts/garmin/import.mjs                  # podgląd, niczego nie zapisuje
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/garmin/import.mjs --zapisz
//
// Dane wejściowe: `scripts/garmin/produkty.json` — 19 wariantów zebranych ze
// stron produktowych garmin.com/pl-PL przez `pobierz.mjs` (nazwa, wariant,
// numer katalogowy, cena brutto w złotych, adres zdjęcia).
//
// Produkty powstają jako **szkice** (`status: "draft"`). Szkic nie pokazuje się
// w sklepie, w wyszukiwarce ani w feedzie do Google, więc katalog można obejrzeć
// i poprawić na spokojnie, a publikacja to jedno kliknięcie w tabeli Cen.
//
// Trzy rzeczy, na których łatwo się przejechać w Medusie 2 i które ten skrypt
// robi po dobremu:
//
//  1. **Kanał sprzedaży** bierzemy z klucza publikowalnego, którym front rozmawia
//     ze sklepem — a nie „pierwszy z brzegu". Pierwszy, jaki oddaje Medusa, to
//     instalacyjny „Default Sales Channel", do którego nie zagląda nic; produkt
//     w nim jest niewidoczny w sklepie, choć w panelu Medusy wygląda poprawnie.
//  2. **Cena i SKU należą do wariantu**, nie do produktu.
//  3. **Zdjęcia wgrywa się na `/admin/uploads` polem `files`** — inne nazwy pola
//     wracają z 400.
//
// Skrypt jest **idempotentny**: produkt o tym samym uchwycie albo SKU pomija.
// Uruchamia się na VPS-ie, bo `MEDUSA_ADMIN_TOKEN` siedzi w `.env.local`
// i nie wchodzi do repozytorium.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import "../lib/env.mjs"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
// Klucz publikowalny jest publiczny (front wysyła go w każdym żądaniu do sklepu)
// i w `.env.local` na VPS-ie go nie ma — stoi tu jako wartość zapasowa, tak samo
// jak w pozostałych skryptach. Bez niego nie da się zapytać, do jakiego kanału
// naprawdę zagląda sklep, i kanał trzeba by zgadywać.
const KLUCZ =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"
const ZAPISZ = process.argv.includes("--zapisz")

// Cały ten komplet to katalog Garmina (JL Audio należy dziś do Garmina i idzie
// przez ten sam cennik), więc ląduje w dziale Elektronika → Garmin. Osobną
// kategorię „JL Audio" da się dołożyć później — wymaga też wpisu w
// `src/lib/shop-taxonomy.ts`, inaczej nie pokaże się w menu.
const KATEGORIA = "garmin"

// Ceny z garmin.com/pl-PL to sugerowane ceny detaliczne brutto. Wchodzą i jako
// cena sprzedaży, i jako `cena_detaliczna` (pole „sugerowana cena od dostawcy"
// w panelu). **Przekreślenia nie włączamy** — bez własnej ceny obie kwoty są
// równe, a przekreślona kwota równa bieżącej wygląda jak pomyłka.
const DOSTEPNOSC = "na-zamowienie"

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
    signal: AbortSignal.timeout(30000),
  })
  const tekst = await odpowiedz.text()
  const tresc = tekst ? JSON.parse(tekst) : {}
  if (!odpowiedz.ok) {
    throw new Error(`${sciezka} → ${odpowiedz.status}: ${tresc?.message || tekst.slice(0, 300)}`)
  }
  return tresc
}

function slug(tekst) {
  return tekst
    .toLowerCase()
    .replace(/[\u2122\u00ae\u00a9]/g, " ")
    .replace(/[\u201e\u201d"\u2033\u2019']/g, " ")
    .replace(/\u0105/g, "a").replace(/\u0107/g, "c").replace(/\u0119/g, "e").replace(/\u0142/g, "l")
    .replace(/\u0144/g, "n").replace(/\u00f3/g, "o").replace(/\u015b/g, "s").replace(/[\u017c\u017a]/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Uchwyt w sklepie, czyli adres produktu. Ucinamy **na granicy s\u0142owa**, nie na
 * 70. znaku \u2014 `...gwind-wired-an` w adresie wygl\u0105da na uci\u0119ty link, a nie na
 * nazw\u0119 towaru. Gdy dwa warianty daj\u0105 ten sam adres, rozr\u00f3\u017cnia je ko\u0144c\u00f3wka
 * numeru katalogowego \u2014 ten jest z definicji jedyny.
 */
function uchwyt(produkt, zajete = new Set()) {
  const pelny = slug(`${produkt.nazwa} ${produkt.wariant}`)
  let baza = pelny
  if (baza.length > 70) {
    baza = baza.slice(0, 70)
    baza = baza.slice(0, baza.lastIndexOf("-")).replace(/-+$/, "")
  }
  let wynik = baza
  if (zajete.has(wynik)) wynik = `${baza}-${produkt.sku.split("-").pop()}`
  zajete.add(wynik)
  return wynik
}

function tytul(produkt) {
  const nazwa = produkt.nazwa.replace(/[™®]/g, "").replace(/\s+/g, " ").trim()
  const wariant = produkt.wariant.replace(/[™®]/g, "").replace(/\s+/g, " ").trim()
  return wariant && !nazwa.toLowerCase().includes(wariant.toLowerCase())
    ? `${nazwa} — ${wariant}`
    : nazwa
}

/**
 * Kanał sprzedaży, z którego naprawdę czyta sklep — ta sama droga co
 * `kanalSklepu()` w `src/lib/medusa-admin.ts`.
 */
async function kanalSklepu() {
  if (KLUCZ) {
    const klucze = await admin(
      "/admin/api-keys?type=publishable&limit=50&fields=id,token,*sales_channels"
    ).catch(() => null)
    const nasz = (klucze?.api_keys || []).find((wpis) => wpis?.token === KLUCZ)
    const zKlucza = nasz?.sales_channels?.[0]
    if (zKlucza?.id) return zKlucza
  }
  const kanaly = await admin("/admin/sales-channels?limit=50&fields=id,name").catch(() => null)
  const lista = kanaly?.sales_channels || []
  return lista.find((k) => !/^default sales channel$/i.test(k.name || "")) || lista[0] || null
}

/** Zdjęcie z res.garmin.com → plik w Medusie. Zwraca adres albo pusty ciąg. */
async function wgrajZdjecie(adres) {
  const odpowiedz = await fetch(adres, { signal: AbortSignal.timeout(30000) })
  if (!odpowiedz.ok) throw new Error(`zdjęcie ${odpowiedz.status}`)
  const bajty = Buffer.from(await odpowiedz.arrayBuffer())

  // Ta sama pułapka co przy pobieraniu ze starego sklepu: serwer potrafi oddać
  // stronę HTML z kodem 200. Sprawdzamy **nagłówek pliku**, nie rozmiar —
  // dokument HTML podpisany jako `image/jpeg` Medusa przyjmie, a przeskalować
  // go nie umie i w sklepie zostaje ikona zepsutego obrazka.
  const jpeg = bajty[0] === 0xff && bajty[1] === 0xd8
  const png = bajty.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (!jpeg && !png) throw new Error("to nie jest zdjęcie (nagłówek pliku się nie zgadza)")

  const nazwa = adres.split("/").filter(Boolean).slice(-3, -2)[0] || "garmin"
  const dane = new FormData()
  dane.append("files", new Blob([bajty], { type: jpeg ? "image/jpeg" : "image/png" }), `${nazwa}.${jpeg ? "jpg" : "png"}`)
  const wynik = await admin("/admin/uploads", { method: "POST", body: dane })
  return wynik?.files?.[0]?.url || ""
}

async function main() {
  const zrodlo = JSON.parse(readFileSync(join(KATALOG, "produkty.json"), "utf8"))
  const produkty = zrodlo.produkty || []
  const zajete = new Set()
  for (const p of produkty) p.uchwyt = uchwyt(p, zajete)

  console.log(`z garmin.com (${zrodlo.pobrano?.slice(0, 10)}): ${produkty.length} wariantów\n`)
  for (const p of produkty) {
    console.log(`  ${p.sku}  ${String(p.cena_pln).padStart(6)} zł  ${tytul(p)}`)
    console.log(`            /sklep/produkt/${p.uchwyt}`)
  }

  if (!TOKEN) {
    console.log(
      "\nBrak MEDUSA_ADMIN_TOKEN — to jest sam podgląd.\n" +
        "Na VPS-ie:  cd /opt/marinero-frontend && node scripts/garmin/import.mjs --zapisz"
    )
    return
  }

  const [kanal, kategorie, profile] = await Promise.all([
    kanalSklepu(),
    admin("/admin/product-categories?limit=200&fields=id,handle"),
    admin("/admin/shipping-profiles?limit=10&fields=id,name"),
  ])
  const kategoriaId = (kategorie?.product_categories || []).find((k) => k.handle === KATEGORIA)?.id
  const profilId = profile?.shipping_profiles?.[0]?.id

  console.log(
    `\nkanał: ${kanal?.name || "—"} | kategoria ${KATEGORIA}: ${kategoriaId ? "jest" : "BRAK"} | ` +
      `profil wysyłki: ${profile?.shipping_profiles?.[0]?.name || "—"}`
  )
  if (!kanal?.id) throw new Error("nie znalazłem kanału sprzedaży — bez niego produkt nie pokaże się w sklepie")
  if (!kategoriaId) console.log(`uwaga: nie ma kategorii "${KATEGORIA}" — produkty powstaną bez działu`)
  if (!ZAPISZ) {
    console.log("\nPrzebieg na sucho — dodaj --zapisz, żeby założyć produkty.")
    return
  }

  let dodane = 0
  let pominiete = 0
  for (const p of produkty) {
    const handle = p.uchwyt
    const { products: poUchwycie } = await admin(
      `/admin/products?handle=${encodeURIComponent(handle)}&fields=id,title&limit=1`
    )
    if (poUchwycie?.length) {
      console.log(`= ${p.sku} już jest (${handle})`)
      pominiete += 1
      continue
    }
    const { products: poSku } = await admin(
      `/admin/products?variants.sku=${encodeURIComponent(p.sku)}&fields=id,title&limit=1`
    ).catch(() => ({ products: [] }))
    if (poSku?.length) {
      console.log(`= ${p.sku} już jest pod innym uchwytem (${poSku[0].title})`)
      pominiete += 1
      continue
    }

    let zdjecie = ""
    try {
      zdjecie = await wgrajZdjecie(p.zdjecie)
    } catch (problem) {
      console.log(`  ! ${p.sku}: zdjęcia nie wziąłem (${problem.message}) — produkt powstaje bez niego`)
    }

    await admin("/admin/products", {
      method: "POST",
      body: JSON.stringify({
        title: tytul(p),
        handle,
        description: `${tytul(p)}. Numer katalogowy producenta: ${p.sku}.`,
        status: "draft",
        // Medusa 2 przyjmuje `categories: [{ id }]` — `category_ids` odbija z 400
        // („Unrecognized fields"). Kategorie traktuje jak komplet, więc wysyłamy
        // pełną listę.
        ...(kategoriaId ? { categories: [{ id: kategoriaId }] } : {}),
        sales_channels: [{ id: kanal.id }],
        ...(profilId ? { shipping_profile_id: profilId } : {}),
        ...(zdjecie ? { images: [{ url: zdjecie }], thumbnail: zdjecie } : {}),
        options: [{ title: "Wariant", values: ["Standard"] }],
        variants: [
          {
            title: "Standard",
            sku: p.sku,
            manage_inventory: false,
            options: { Wariant: "Standard" },
            prices: [{ amount: p.cena_pln, currency_code: "pln" }],
          },
        ],
        metadata: {
          dostepnosc: DOSTEPNOSC,
          // Znacznik dla filtra „Przygotowane" w tabeli Cen. Szkiców jest dziś
          // dwa rodzaje: **wycofane ze sprzedaży** i **jeszcze niewystawione** —
          // jeden filtr na oba nie odpowiada na żadne z dwóch pytań.
          przygotowany: true,
          cena_detaliczna: p.cena_pln,
          notatka: `Nowość Garmin/JL Audio, cennik garmin.com/pl-PL z ${zrodlo.pobrano?.slice(0, 10)}`,
        },
      }),
    })
    console.log(`+ ${p.sku} ${tytul(p)} — ${p.cena_pln} zł${zdjecie ? " (ze zdjęciem)" : ""}`)
    dodane += 1
  }

  console.log(`\nGotowe: ${dodane} nowych szkiców, ${pominiete} pominiętych.`)
  console.log("Do publikacji: /narzedzia-8f3a/ceny → filtr „Szkice” → Publikacja = opublikowany.")
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
