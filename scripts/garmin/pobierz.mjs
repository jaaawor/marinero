// Ceny i warianty nowości Garmina prosto z garmin.com/pl-PL.
//
//   node scripts/garmin/pobierz.mjs            # pokazuje, co znalazł
//   node scripts/garmin/pobierz.mjs --zapisz   # nadpisuje produkty.json
//
// Nie potrzebuje żadnych kluczy — czyta publiczne strony producenta.
//
// **Ceny są w HTML-u, mimo że strona wygląda na budowaną JavaScriptem.**
// Garmin wstawia do dokumentu mapę produktów kluczowaną numerem katalogowym,
// a przy każdym z nich obiekt `price`. Nie ma więc potrzeby uruchamiać
// przeglądarki — wystarczy `fetch`.
//
// Pułapka, na którą już raz wpadliśmy: **numer katalogowy przy cenie należy
// do ceny, nie do produktu obok**. Obiekt wygląda tak:
//
//   "listPrice":{…,"price":8169,…,"wholeUnitAmount":"8 169"},"partNumber":"010-03411-20"
//
// Parowanie „najbliższy numer przed ceną" przesuwa cały cennik o jedną
// pozycję i wychodzi z tego instrument pokładowy po cenie zestawu żeglarskiego.
// Dlatego bierzemy numer stojący **za** blokiem `listPrice`.
//
// Trzecia: nazwa wariantu (`productVariation`) bywa z przecinkiem — „6,5\""
// przy głośnikach — więc wzorca nie wolno urywać na przecinku, tylko na
// cudzysłowie. Inaczej z „6,5-calowych" zostaje samo „6".
//
// Druga pułapka: `template` w środku obiektu ceny zawiera klamry w cudzysłowie
// (`"{prefix}{wholeUnitAmount}…"`), więc wzorzec „do najbliższej klamry
// zamykającej" urywa się w połowie i nie znajduje nic.

import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ZAPISZ = process.argv.includes("--zapisz")
const KATALOG = dirname(fileURLToPath(import.meta.url))

const URLE = [
  "https://www.garmin.com/pl-PL/p/1960585/pn/010-02794-11/",
  "https://www.garmin.com/pl-PL/p/pn/010-03411-00/",
  "https://www.garmin.com/pl-PL/p/pn/010-02983-00/",
  "https://www.garmin.com/pl-PL/p/pn/010-04753-00/",
  "https://www.garmin.com/pl-PL/p/pn/010-01628-06/",
  "https://www.garmin.com/pl-PL/p/pn/010-04790-00/",
]

const PRZEGLADARKA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

/** Twarda spacja z cennika Garmina czyta się potem jak dziwny znak. */
const bezTwardych = (t) => t.replace(/ /g, " ").trim()

async function strona(url) {
  const odpowiedz = await fetch(url, { headers: { "User-Agent": PRZEGLADARKA } })
  if (!odpowiedz.ok) throw new Error(`${url} → HTML ${odpowiedz.status}`)
  return odpowiedz.text()
}

/** Pakshot pierwszy, dalej pozostałe ujęcia produktu, na końcu kadry z sesji. */
function uporzadkuj(lista) {
  return [...(lista || [])]
    .sort((a, b) => a.waga - b.waga || a.plik.localeCompare(b.plik, "pl", { numeric: true }))
    .map((k) => k.adres)
}

async function main() {
  const nazwy = new Map()
  const warianty = new Map()
  const ceny = new Map()
  const zdjecia = new Map()
  const strony = []

  for (const url of URLE) {
    const html = await strona(url)
    const tytul = bezTwardych((html.match(/<title[^>]*>(.*?)<\/title>/s)?.[1] || "").replace(/\s+/g, " "))

    for (const m of html.matchAll(
      /"(010-\d{5}-\d{2})"\s*:\s*\{"productId":"\d+","productName":"([^"]*)"(?:[^{]*?"productVariation":"([^"]*)")?/g
    )) {
      const [, sku, nazwa, wariant] = m
      if (!nazwy.has(sku)) nazwy.set(sku, bezTwardych(nazwa))
      if (wariant && wariant !== "null" && !warianty.has(sku)) warianty.set(sku, bezTwardych(wariant))
    }

    for (const m of html.matchAll(
      /"price"\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"template"[\s\S]{0,200}?"partNumber"\s*:\s*"(010-\d{5}-\d{2})"/g
    )) {
      if (!ceny.has(m[2])) ceny.set(m[2], Number(m[1]))
    }

    // Adresu zdjęcia **nie zgadujemy**. Kusi wzorzec
    // `res.garmin.com/<język>/products/<SKU>/v/cf-lg.jpg`, ale człon języka jest
    // przy różnych produktach różny (`en`, nie `pl_PL`) i zgadnięty adres wraca
    // z 400 — sprawdzone: z 19 wariantów trafiał jeden. Bierzemy więc adresy
    // wypisane wprost w kodzie strony.
    //
    // `v/cf-lg.jpg` to pakshot („catalog front") i on idzie pierwszy — to jest
    // kadr, który ma stać na kafelku. Reszta galerii siedzi pod `g/<id>-N.jpg`.
    // **Pomijamy `-VID` i `-FAN`**: pierwsze to plansze pod film, drugie
    // panoramiczne banery na całą szerokość strony producenta — w kwadratowym
    // kadrze galerii zostaje z nich pasek nieba.
    for (const m of html.matchAll(
      /https:\/\/res\.garmin\.com\/[a-zA-Z_]+\/products\/(010-\d{5}-\d{2})\/(v|g)\/([A-Za-z0-9._-]+)\.jpg/g
    )) {
      const [adres, sku, gdzie, plik] = m
      // `-VID` to plansze pod film, `-FAN` i `banner` to panoramiczne pasy na
      // całą szerokość strony producenta — w kwadratowym kadrze galerii zostaje
      // z nich pasek nieba.
      if (/-(VID|FAN)$/i.test(plik) || /banner/i.test(plik)) continue
      // `g/cf-lg.jpg` to ten sam pakshot co `v/cf-lg.jpg`, tylko w innym
      // katalogu — bez tego ten sam kadr wchodziłby do galerii dwa razy.
      if (gdzie === "g" && plik === "cf-lg") continue

      const lista = zdjecia.get(sku) || []
      if (lista.some((k) => k.adres === adres)) continue
      // Kolejność ustawiamy na końcu, nie przy zbieraniu: na stronie adresy
      // stoją w kolejności, w jakiej wypadły w kodzie, a pakshot ma być
      // pierwszy — to on trafia na kafelek i do feedu Google.
      lista.push({ adres, waga: plik === "cf-lg" ? 0 : gdzie === "v" ? 1 : 2, plik })
      zdjecia.set(sku, lista)
    }

    strony.push({ url, tytul })
    console.log(`${tytul.slice(0, 70)}`)
  }

  const produkty = [...new Set([...nazwy.keys(), ...ceny.keys()])].sort().map((sku) => ({
    sku,
    nazwa: nazwy.get(sku) || "",
    wariant: warianty.get(sku) || "",
    cena_pln: ceny.get(sku) ?? null,
    zdjecie: uporzadkuj(zdjecia.get(sku))[0] || "",
    // Cała galeria — pakshot na pierwszym miejscu, dalej kadry z materiałów
    // producenta. Przy części wariantów jest tylko pakshot i to jest normalne:
    // producent nie robi sesji do każdego numeru katalogowego.
    zdjecia: uporzadkuj(zdjecia.get(sku)),
  }))

  console.log("")
  for (const p of produkty) {
    const cena = p.cena_pln ? `${p.cena_pln.toLocaleString("pl-PL")} zł` : "— brak ceny —"
    console.log(`  ${p.sku}  ${cena.padStart(13)}  ${p.nazwa}${p.wariant ? ` — ${p.wariant}` : ""}`)
  }

  const bezCeny = produkty.filter((p) => !p.cena_pln)
  const bezZdjecia = produkty.filter((p) => !p.zdjecie)
  const kadrow = produkty.reduce((suma, p) => suma + (p.zdjecia?.length || 0), 0)
  console.log("")
  console.log(
    `Razem ${produkty.length}, z ceną ${produkty.length - bezCeny.length}, ` +
      `ze zdjęciem ${produkty.length - bezZdjecia.length}, kadrów łącznie ${kadrow}.`
  )
  if (bezZdjecia.length) console.log(`BEZ ZDJĘCIA: ${bezZdjecia.map((p) => p.sku).join(", ")}`)
  if (bezCeny.length) {
    console.log(`BEZ CENY: ${bezCeny.map((p) => p.sku).join(", ")} — nie wolno ich wgrać do sklepu.`)
  }

  if (!ZAPISZ) {
    console.log("\nNic nie zapisano. Powtórz z --zapisz, żeby nadpisać produkty.json.")
    return
  }

  const plik = join(KATALOG, "produkty.json")
  writeFileSync(
    plik,
    `${JSON.stringify({ pobrano: new Date().toISOString(), strony, produkty }, null, 2)}\n`
  )
  console.log(`\nZapisane: ${plik}`)
}

main().catch((problem) => {
  console.error("Nie udało się:", problem.message)
  process.exit(1)
})
