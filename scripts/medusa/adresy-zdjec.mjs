#!/usr/bin/env node
//
// Prostuje adresy zdjęć produktów zapisane przez Medusę jako `localhost`.
//
// Lokalny magazyn plików Medusy skleja adres wgranego pliku z własnego
// `backend_url`, a ten domyślnie brzmi `http://localhost:9000`. Pliki leżą
// dobrze i są publicznie dostępne pod `https://commerce.…/static/…`, ale
// w bazie stoi adres, którego przeglądarka klienta nie ma jak otworzyć —
// w sklepie nie widać wtedy ani jednego zdjęcia.
//
//   node scripts/medusa/adresy-zdjec.mjs            # na sucho
//   node scripts/medusa/adresy-zdjec.mjs --zapis
//
// Wymaga MEDUSA_ADMIN_TOKEN. Uruchamiać na VPS-ie:
//   cd /opt/marinero-frontend
//   TOKEN=$(grep -h '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'"'\'')
//   MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/adresy-zdjec.mjs --zapis
//
// Skrypt można puszczać wielokrotnie — produkt z poprawnymi adresami jest
// pomijany. Docelowo trzeba jeszcze ustawić `backend_url` w konfiguracji
// Medusy, żeby kolejne wgrania od razu miały właściwy adres.

const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const KLUCZ_PUBLICZNY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")

if (!TOKEN) {
  console.error("Brak MEDUSA_ADMIN_TOKEN — patrz nagłówek pliku.")
  process.exit(1)
}

const BASIC = `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`

// Adresy, które trzeba przepisać na publiczny. `localhost` i `127.0.0.1`
// widzi tylko sam serwer; `0.0.0.0` bierze się z nasłuchu kontenera.
const LOKALNE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i

function publiczny(adres) {
  return LOKALNE.test(adres) ? adres.replace(LOKALNE, MEDUSA) : adres
}

async function admin(sciezka, init = {}) {
  const odpowiedz = await fetch(`${MEDUSA}${sciezka}`, {
    ...init,
    headers: { Authorization: BASIC, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  const tresc = await odpowiedz.text()
  if (!odpowiedz.ok) throw new Error(`${sciezka} → ${odpowiedz.status}: ${tresc.slice(0, 200)}`)
  return tresc ? JSON.parse(tresc) : {}
}

async function produkty() {
  const lista = []
  for (let offset = 0; ; offset += 100) {
    const odpowiedz = await fetch(
      `${MEDUSA}/store/products?limit=100&offset=${offset}&fields=id,handle,%2Bimages.url,%2Bthumbnail`,
      { headers: { "x-publishable-api-key": KLUCZ_PUBLICZNY } }
    )
    const paczka = (await odpowiedz.json())?.products || []
    lista.push(...paczka)
    if (paczka.length < 100) break
  }
  return lista
}

const wszystkie = await produkty()
const doPoprawy = wszystkie.filter((produkt) =>
  [produkt.thumbnail, ...(produkt.images || []).map((i) => i.url)].some(
    (adres) => adres && LOKALNE.test(adres)
  )
)

console.log(`Produktów w sklepie: ${wszystkie.length}`)
console.log(`Z adresem lokalnym: ${doPoprawy.length}`)
if (!ZAPIS) {
  if (doPoprawy[0]) {
    console.log(`\nPrzykład: ${doPoprawy[0].thumbnail}`)
    console.log(`      →   ${publiczny(doPoprawy[0].thumbnail)}`)
  }
  console.log("\nTryb na sucho — nic nie zapisuję. Dodaj --zapis.")
  process.exit(0)
}

let poprawione = 0
for (const [numer, produkt] of doPoprawy.entries()) {
  const obrazki = (produkt.images || []).map((obraz) => ({ url: publiczny(obraz.url) }))
  const miniaturka = produkt.thumbnail ? publiczny(produkt.thumbnail) : undefined

  await admin(`/admin/products/${produkt.id}`, {
    method: "POST",
    body: JSON.stringify({ images: obrazki, ...(miniaturka ? { thumbnail: miniaturka } : {}) }),
  })

  poprawione += 1
  if ((numer + 1) % 40 === 0 || numer + 1 === doPoprawy.length) {
    console.log(`  … ${numer + 1}/${doPoprawy.length}`)
  }
}

console.log(`\nPoprawione produkty: ${poprawione}`)
