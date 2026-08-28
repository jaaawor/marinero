#!/usr/bin/env node
//
// Przenosi zdjęcia produktów ze starego sklepu WooCommerce do Medusy.
//
// Po migracji z WooCommerce w Medusie zostały **adresy**, nie pliki: wszystkie
// 907 zdjęć przy 387 produktach wisi na `sklep.marinero.pl`. Dopóki stary
// serwer stoi, sklep wygląda dobrze — ale w dniu, w którym przepniemy tę
// subdomenę na nowy serwer (a taki jest plan: przekierowanie na
// `marinero.pl/sklep`), **każde zdjęcie w sklepie zamieni się w przekierowanie
// do listy produktów**. Dlatego pliki trzeba najpierw ściągnąć i wgrać do
// Medusy, a produktom podmienić adresy.
//
//   node scripts/medusa/zdjecia-ze-starego-sklepu.mjs             # na sucho
//   node scripts/medusa/zdjecia-ze-starego-sklepu.mjs --zapis
//   node scripts/medusa/zdjecia-ze-starego-sklepu.mjs --zapis --ile 5
//
// Wymaga MEDUSA_ADMIN_TOKEN. Uruchamiać na VPS-ie:
//   cd /opt/marinero-frontend
//   export MEDUSA_ADMIN_TOKEN=$(sed -n 's/^MEDUSA_ADMIN_TOKEN=//p' .env.local | tr -d '"' | tr -d "'")
//     node scripts/medusa/zdjecia-ze-starego-sklepu.mjs --zapis
//
// Skrypt jest **wznawialny**: produkt, który nie ma już ani jednego zdjęcia na
// starym serwerze, jest pomijany. Można go przerwać i puścić od nowa.

const STARY_HOST = "sklep.marinero.pl"
const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const KLUCZ_PUBLICZNY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")
const LIMIT = Number(process.argv[process.argv.indexOf("--ile") + 1]) || 0

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

async function produkty() {
  const lista = []
  for (let offset = 0; ; offset += 100) {
    const adres =
      `/store/products?limit=100&offset=${offset}` +
      `&fields=id,handle,title,%2Bimages.url,%2Bthumbnail`
    const odpowiedz = await fetch(`${MEDUSA}${adres}`, {
      headers: { "x-publishable-api-key": KLUCZ_PUBLICZNY },
    })
    const dane = await odpowiedz.json()
    const paczka = dane?.products || []
    lista.push(...paczka)
    if (paczka.length < 100) break
  }
  return lista
}

// Stary sklep na część adresów oddaje **stronę HTML** zamiast pliku — ta sama
// pułapka co przy zdjęciach silników Suzuki. Sprawdzamy nagłówek pliku, nie
// rozmiar: dokument HTML podpisany jako `image/jpeg` trafiał do bazy i zostawał
// po nim połamany obrazek.
function czyObrazek(bajty) {
  if (bajty.length < 12) return false
  const b = bajty
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg"
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif"
  const naglowek = Buffer.from(b.subarray(0, 12)).toString("latin1")
  if (naglowek.startsWith("RIFF") && naglowek.slice(8, 12) === "WEBP") return "image/webp"
  // AVIF nie ma stałej sygnatury na początku pliku: to pudełko ISOBMFF, więc
  // rozpoznaje się je po `ftyp` na czwartym bajcie i marce zaraz za nim.
  // Sklep ma takie zdjęcia przy częściach Suzuki.
  if (naglowek.slice(4, 8) === "ftyp" && ["avif", "avis"].includes(naglowek.slice(8, 12))) {
    return "image/avif"
  }
  return false
}

const ROZSZERZENIA = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
}

async function pobierz(adres) {
  for (let proba = 1; proba <= 3; proba += 1) {
    try {
      const odpowiedz = await fetch(adres, {
        headers: { "User-Agent": "marinero-migracja/1.0" },
      })
      if (!odpowiedz.ok) throw new Error(`HTTP ${odpowiedz.status}`)
      const bajty = Buffer.from(await odpowiedz.arrayBuffer())
      const typ = czyObrazek(bajty)
      if (!typ) throw new Error("to nie jest plik obrazu")
      return { bajty, typ }
    } catch (blad) {
      if (proba === 3) throw blad
      await new Promise((r) => setTimeout(r, proba * 2000))
    }
  }
}

// Wgrywamy plik po pliku. Medusa 2 przyjmuje multipart pod polem `files`;
// odpowiedź niesie adres, pod którym plik stoi już u nas.
async function wgraj(nazwa, bajty, typ) {
  const formularz = new FormData()
  formularz.append("files", new Blob([bajty], { type: typ }), nazwa)

  const odpowiedz = await fetch(`${MEDUSA}/admin/uploads`, {
    method: "POST",
    headers: { Authorization: BASIC },
    body: formularz,
  })
  const tresc = await odpowiedz.text()
  if (!odpowiedz.ok) throw new Error(`/admin/uploads → ${odpowiedz.status}: ${tresc.slice(0, 200)}`)

  const dane = JSON.parse(tresc)
  const plik = dane?.files?.[0] || dane?.uploads?.[0] || dane
  const adres = plik?.url
  if (!adres) throw new Error(`Medusa nie oddała adresu pliku: ${tresc.slice(0, 200)}`)
  return publiczny(adres)
}

// Lokalny magazyn plików Medusy skleja adres z własnego `backend_url`, a ten
// domyślnie brzmi `http://localhost:9000`. Plik leży dobrze i jest publicznie
// dostępny, ale zapisany taki adres w przeglądarce klienta nie istnieje —
// w sklepie nie widać wtedy ani jednego zdjęcia.
const LOKALNE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i

function publiczny(adres) {
  return LOKALNE.test(adres) ? adres.replace(LOKALNE, MEDUSA) : adres
}

function nazwaPliku(adres, typ) {
  const ogon = decodeURIComponent(new URL(adres).pathname.split("/").pop() || "zdjecie")
  const bezRozszerzenia = ogon.replace(/\.[a-z0-9]+$/i, "")
  return `${bezRozszerzenia.slice(0, 80) || "zdjecie"}.${ROZSZERZENIA[typ]}`
}

async function main() {
  const wszystkie = await produkty()
  const doZrobienia = wszystkie.filter((produkt) => {
    const adresy = [produkt.thumbnail, ...(produkt.images || []).map((i) => i.url)]
    return adresy.some((adres) => adres && adres.includes(STARY_HOST))
  })

  console.log(`Produktów w sklepie: ${wszystkie.length}`)
  console.log(`Ze zdjęciami na starym serwerze: ${doZrobienia.length}`)
  if (!ZAPIS) console.log("Tryb na sucho — nic nie zapisuję. Dodaj --zapis.\n")

  const lista = LIMIT ? doZrobienia.slice(0, LIMIT) : doZrobienia
  let przeniesione = 0
  let bledy = 0

  for (const [numer, produkt] of lista.entries()) {
    const stare = (produkt.images || []).map((i) => i.url)
    // Miniaturka bywa spoza listy zdjęć — wtedy trzeba ją przenieść osobno.
    const doPobrania = [...new Set([...stare, produkt.thumbnail].filter(Boolean))]
    const mapa = new Map()

    let potkniecie = false
    for (const adres of doPobrania) {
      if (!adres.includes(STARY_HOST)) {
        mapa.set(adres, adres)
        continue
      }
      try {
        const { bajty, typ } = await pobierz(adres)
        const nowy = ZAPIS ? await wgraj(nazwaPliku(adres, typ), bajty, typ) : `(na sucho) ${adres}`
        mapa.set(adres, nowy)
      } catch (blad) {
        console.log(`  ✗ ${produkt.handle}: ${adres.split("/").pop()} — ${blad.message}`)
        potkniecie = true
        bledy += 1
      }
    }

    // Produkt przepinamy **tylko w całości**. Podmiana połowy adresów zostawiłaby
    // galerię rozjechaną między dwa serwery, a przy wyłączeniu starego —
    // z dziurami w środku.
    if (potkniecie) {
      console.log(`  ↷ ${produkt.handle}: zostawiam bez zmian, poprawić i puścić ponownie`)
      continue
    }

    if (ZAPIS) {
      const nowaMiniaturka = produkt.thumbnail ? mapa.get(produkt.thumbnail) : undefined
      await admin(`/admin/products/${produkt.id}`, {
        method: "POST",
        body: JSON.stringify({
          images: stare.map((adres) => ({ url: mapa.get(adres) })),
          ...(nowaMiniaturka ? { thumbnail: nowaMiniaturka } : {}),
        }),
      })
    }

    przeniesione += 1
    if ((numer + 1) % 20 === 0 || numer + 1 === lista.length) {
      console.log(`  … ${numer + 1}/${lista.length}`)
    }
  }

  console.log(`\nPrzeniesione produkty: ${przeniesione}, błędy zdjęć: ${bledy}`)
  if (!ZAPIS) console.log("To był przebieg na sucho.")
}

main().catch((blad) => {
  console.error(blad)
  process.exit(1)
})
