// Aktualność o nowościach Garmin / JL Audio z 1 września 2026.
//
//   node scripts/news/garmin-wrzesien-2026.mjs            # pokazuje, co zrobi
//   node scripts/news/garmin-wrzesien-2026.mjs --zapisz   # zapisuje
//   node scripts/news/garmin-wrzesien-2026.mjs --zdjecia --zapisz   # dokłada
//       zdjęcia do wpisu, który powstał wcześniej (bez kadrów)
//   node scripts/news/garmin-wrzesien-2026.mjs --produkty --zapisz  # dopisuje
//       na końcu odnośniki do tych nowości, które stoją już w sklepie
//
// Uruchamia się **na VPS-ie**, bo potrzebuje `DIRECTUS_ADMIN_TOKEN`.
//
// Treść napisana z sześciu ogłoszeń producenta (GMI 40, JL Audio A60/A60-H,
// M200, NRX-300, R5, SmartDrive). **Nie ma w niej ani jednej ceny** — ceny
// wchodzą razem z produktami do sklepu, a artykuł o premierze przeżyje
// niejedną zmianę cennika.
//
// Wpis powstaje jako **szkic**. Zdjęcia (pięć kadrów produktowych) skrypt sam
// wgrywa do biblioteki Directusa z garmin.com i wstawia pod nagłówki sekcji,
// a GMI 40 ustawia jako kadr otwierający — nagłówek bez zdjęcia wygląda na
// liście aktualności jak dziura.

import "../lib/env.mjs"

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")
// Wpis mógł już powstać wcześniej — bez zdjęć. `--zdjecia` dokłada je do
// istniejącego szkicu, zamiast kazać wgrywać pięć kadrów ręcznie w panelu.
const TYLKO_ZDJECIA = process.argv.includes("--zdjecia")
// `--produkty` dopisuje na końcu wpisu listę odnośników do sklepu. Osobny krok,
// bo produkty wchodzą do Medusy jako **szkice** — dopóki ich nie opublikujesz,
// odnośnik prowadziłby na stronę, której nie ma. Skrypt bierze więc tylko to,
// co naprawdę stoi w sklepie, i można go puścić drugi raz po publikacji reszty.
const TYLKO_PRODUKTY = process.argv.includes("--produkty")
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const KLUCZ_SKLEPU = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
const STRONA = process.env.NEXT_PUBLIC_SITE_URL || "https://marinero.pl"

// Znaczniki wokół listy — dzięki nim powtórzony przebieg **podmienia** sekcję,
// zamiast dokładać drugą. Reszty treści nie ruszamy.
const OD = "<!-- produkty-ze-sklepu -->"
const DO = "<!-- /produkty-ze-sklepu -->"

if (!TOKEN) {
  console.error("Brak DIRECTUS_ADMIN_TOKEN — uruchom to na serwerze, gdzie jest .env.local.")
  process.exit(1)
}

const SLUG = "garmin-jl-audio-nowosci-wrzesien-2026"

const WPIS = {
  status: "draft",
  title: "Nowości Garmin i JL Audio — wrzesień 2026",
  slug: SLUG,
  kind: "news",
  published_at: "2026-09-01T08:00:00.000Z",
  excerpt:
    "Sześć premier naraz: instrument GMI 40 z ekranem dotykowym, radia JL Audio A60 " +
    "i A60-H, głośniki i subwoofery M200, dwa nowe piloty oraz SmartDrive — pierwszy " +
    "autopilot żaglowy z bezszczotkowym siłownikiem liniowym i wbudowanym sterownikiem.",
  content: `
<p>1 września Garmin ogłosił sześć nowości dla łodzi motorowych i żaglowych. Poniżej
to, co warto z nich wiedzieć — po kolei, od nawigacji przez audio po autopilota.</p>

<h2>GMI 40 — instrument z ekranem dotykowym</h2>
<p>Wielofunkcyjny instrument z dotykowym ekranem 4,3 cala. Pokazuje na żywo wiatr,
prędkość, głębokość, kurs, dane silnika i zużycie paliwa. Łączy się z ploterami Garmina
i z urządzeniami bezprzewodowymi. Do żeglarzy trafiają gotowe pakiety —
przewodowe i bezprzewodowe — z instrumentem, czujnikiem głębokości, prędkości i wiatru
w kilku wariantach.</p>

<h2>JL Audio A60 i A60-H — radia morskie</h2>
<p>Dźwięk w maksymalnie czterech strefach, z wbudowanym procesorem sygnału (DSP), który
dobiera brzmienie i chroni głośniki. A60 ma kolorowy ekran 2,95 cala i wygląda jak
element nowoczesnego stanowiska sterowego; A60-H jest kompaktowy i można go schować
pod pulpitem. Oba obsługują Bluetooth LE — sterowanie z aplikacji Garmin Audio albo
ze zgodnego zegarka — oraz NMEA 2000 do połączenia z ploterem.</p>

<h2>JL Audio M200 — głośniki i subwoofery</h2>
<p>Seria M w przystępniejszej półce. Głośniki 50–60 W RMS grają głośno i czysto,
subwoofer 250 W RMS daje niskie tony. Opcjonalne podświetlenie RGB i wymienne grille
(białe albo szare, sprzedawane osobno) pozwalają dopasować je do wnętrza łodzi.
Materiały morskie, złącza i płytki odporne na korozję. Do wyboru głośniki 6,5" i 7,7"
oraz subwoofer 10".</p>

<h2>JL Audio NRX-300 i R5 — sterowanie</h2>
<p><strong>NRX-300</strong> to przewodowy pilot z ekranem 2,6 cala: obsługuje cztery
strefy dźwięku, ma klasę szczelności IPX7 i odporność na mgłę solną, temperaturę,
drgania i promieniowanie UV. Podłączony do sieci NMEA 2000 pracuje też jako powtarzacz
danych — pokaże wiatr, głębokość, prędkość, kurs, pozycję, ETA i temperaturę wody.</p>
<p><strong>R5</strong> jest prostszy: jedno duże pokrętło reguluje wszystkie strefy
jednego radia, przycisk zatrzymuje i wznawia odtwarzanie. Montaż od frontu wymaga
jednego otworu 38 mm.</p>

<h2>SmartDrive — autopilot dla żaglówek</h2>
<p>Pierwszy autopilot żaglowy z <strong>bezszczotkowym siłownikiem liniowym i wbudowanym
sterownikiem</strong>. Do 1050 funtów siły ciągu, regulowana prędkość zwrotu przez sztag
i przez rufę, automatyczna reakcja i lepsze trzymanie kursu na wiatr. Bezstykowy czujnik
położenia steru jest wbudowany, co zdejmuje jedną z częstszych przyczyn awarii.
W parze z Reactorem 40 i instrumentem GHC 50 całość obsługuje się z ekranu dotykowego.</p>

<h2>Kiedy u nas</h2>
<p>Nowości wchodzą do naszej oferty. Po szczegóły, dostępność i wycenę pod konkretną
łódź — napisz albo zadzwoń, dobierzemy zestaw do tego, co masz już na pokładzie.</p>
`.trim(),
}

// Zdjęcia bierzemy z garmin.com — adresy leżą w `scripts/garmin/produkty.json`
// (zbiera je `scripts/garmin/pobierz.mjs`). Adresu **nie zgadujemy**: człon
// języka w `res.garmin.com` bywa różny i zgadnięty adres wraca z 400.
//
// Do Directusa wgrywamy je raz, a w treści wpisu stoją pod nagłówkami sekcji.
// Kadr otwierający (`image`) to GMI 40 — jedyna z tych premier, która na
// zdjęciu wygląda jak sprzęt na pokładzie, a nie jak czarny krążek na bieli.
const ZDJECIA = [
  { sku: "010-03411-00", podpis: "Garmin GMI 40 — instrument z ekranem dotykowym", hero: true, po: "<h2>GMI 40" },
  { sku: "010-02983-00", podpis: "JL Audio A60 — jachtowa jednostka centralna", po: "<h2>JL Audio A60 i A60-H" },
  { sku: "010-04753-02", podpis: "JL Audio M200 — głośnik 6,5″ z podświetleniem", po: "<h2>JL Audio M200" },
  { sku: "010-01628-06", podpis: "JL Audio NRX-300 — pilot przewodowy", po: "<h2>JL Audio NRX-300 i R5" },
  { sku: "010-02794-12", podpis: "Garmin SmartDrive — siłownik autopilota", po: "<h2>SmartDrive" },
]

/** Plik z res.garmin.com → biblioteka plików Directusa. Zwraca identyfikator. */
async function wgrajDoDirectusa(adres, tytul) {
  const odpowiedz = await fetch(adres, { signal: AbortSignal.timeout(30000) })
  if (!odpowiedz.ok) throw new Error(`${adres} → HTTP ${odpowiedz.status}`)
  const bajty = Buffer.from(await odpowiedz.arrayBuffer())

  // Ta sama pułapka co przy pobieraniu ze starego sklepu: serwer potrafi oddać
  // stronę HTML z kodem 200. Sprawdzamy nagłówek pliku, nie rozmiar — Directus
  // przyjmie dokument HTML podpisany jako `image/jpeg`, przeskalować go nie
  // umie i na stronie zostaje ikona zepsutego obrazka.
  if (!(bajty[0] === 0xff && bajty[1] === 0xd8)) throw new Error(`${adres}: to nie jest JPEG`)

  const dane = new FormData()
  dane.append("title", tytul)
  dane.append("file", new Blob([bajty], { type: "image/jpeg" }), `${adres.split("/").slice(-3, -2)[0]}.jpg`)
  const wynik = await fetch(`${DIRECTUS}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: dane,
  })
  const tresc = await wynik.json().catch(() => ({}))
  if (!wynik.ok) throw new Error(tresc?.errors?.[0]?.message || `HTTP ${wynik.status}`)
  return tresc?.data?.id
}

/** Wgrywa komplet i oddaje treść wpisu z kadrami wstawionymi pod nagłówkami. */
async function zeZdjeciami(tresc) {
  const zrodlo = JSON.parse(readFileSync(join(KATALOG, "..", "garmin", "produkty.json"), "utf8"))
  let hero = ""
  let wynik = tresc

  for (const kadr of ZDJECIA) {
    const produkt = (zrodlo.produkty || []).find((p) => p.sku === kadr.sku)
    if (!produkt?.zdjecie) {
      console.log(`  ! ${kadr.sku}: nie mam adresu zdjęcia — pomijam`)
      continue
    }
    const id = await wgrajDoDirectusa(produkt.zdjecie, kadr.podpis)
    if (kadr.hero) hero = id
    const obrazek =
      `<figure><img src="${DIRECTUS}/assets/${id}?width=1200&format=webp&quality=82" ` +
      `alt="${kadr.podpis}" loading="lazy"><figcaption>${kadr.podpis}</figcaption></figure>`
    const miejsce = wynik.indexOf(kadr.po)
    if (miejsce < 0) {
      console.log(`  ! nie znalazłem nagłówka „${kadr.po}" — zdjęcie ${kadr.sku} zostaje w bibliotece`)
      continue
    }
    const koniec = wynik.indexOf("</h2>", miejsce)
    wynik = `${wynik.slice(0, koniec + 5)}\n${obrazek}${wynik.slice(koniec + 5)}`
    console.log(`  + ${kadr.sku} ${kadr.podpis}`)
  }

  return { tresc: wynik, hero }
}

/**
 * Te z 19 nowości, które naprawdę stoją w sklepie. Pytamy Store API — czyli tą
 * samą drogą co klient — więc szkice nie wejdą do listy. Parujemy po numerze
 * katalogowym w SKU wariantu, nie po nazwie: nazwa w sklepie bywa poprawiona
 * ręcznie, numer katalogowy nie.
 */
async function produktyWSklepie() {
  const zrodlo = JSON.parse(readFileSync(join(KATALOG, "..", "garmin", "produkty.json"), "utf8"))
  const nasze = new Map((zrodlo.produkty || []).map((p) => [p.sku, p]))

  const wszystkie = []
  for (let offset = 0; ; offset += 100) {
    const odpowiedz = await fetch(
      `${MEDUSA_URL}/store/products?limit=100&offset=${offset}&fields=id,title,handle,+variants.sku`,
      { headers: { "x-publishable-api-key": KLUCZ_SKLEPU }, signal: AbortSignal.timeout(20000) }
    )
    if (!odpowiedz.ok) throw new Error(`sklep nie odpowiedział: HTTP ${odpowiedz.status}`)
    const { products = [], count = 0 } = await odpowiedz.json()
    wszystkie.push(...products)
    if (!products.length || wszystkie.length >= count) break
  }

  const znalezione = []
  for (const produkt of wszystkie) {
    const sku = (produkt.variants || []).map((w) => w.sku).find((kod) => nasze.has(kod))
    if (!sku) continue
    znalezione.push({ sku, handle: produkt.handle, title: produkt.title })
  }
  // Kolejność jak w cenniku producenta, żeby lista czytała się tak samo jak wpis.
  znalezione.sort((a, b) => a.sku.localeCompare(b.sku))
  return { znalezione, wszystkich: nasze.size }
}

/** Wstawia (albo podmienia) sekcję z odnośnikami do sklepu na końcu wpisu. */
function zProduktami(tresc, lista) {
  const pozycje = lista
    .map(
      (p) =>
        `<li><a href="${STRONA}/sklep/produkt/${p.handle}">${p.title}</a> ` +
        `<span class="nr-kat">— nr kat. ${p.sku}</span></li>`
    )
    .join("\n")

  const sekcja =
    `${OD}\n<h2>Kup w naszym sklepie</h2>\n<ul>\n${pozycje}\n</ul>\n${DO}`

  const od = tresc.indexOf(OD)
  const doo = tresc.indexOf(DO)
  if (od >= 0 && doo > od) {
    return `${tresc.slice(0, od)}${sekcja}${tresc.slice(doo + DO.length)}`
  }
  return `${tresc.trim()}\n\n${sekcja}`
}

async function directus(sciezka, opcje = {}) {
  const odpowiedz = await fetch(`${DIRECTUS}${sciezka}`, {
    ...opcje,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(opcje.headers || {}),
    },
  })
  const tekst = await odpowiedz.text()
  const tresc = tekst ? JSON.parse(tekst) : {}
  if (!odpowiedz.ok) {
    throw Object.assign(new Error(tresc?.errors?.[0]?.message || `HTTP ${odpowiedz.status}`), {
      status: odpowiedz.status,
    })
  }
  return tresc
}

async function main() {
  const { data: sa = [] } = await directus(
    `/items/news?filter[slug][_eq]=${encodeURIComponent(SLUG)}&fields=id,title,status,content,image&limit=1`
  )

  if (sa.length) {
    const wpis = sa[0]
    console.log(`Wpis „${wpis.title}" już jest (id ${wpis.id}, stan: ${wpis.status}).`)

    if (TYLKO_PRODUKTY) {
      const { znalezione, wszystkich } = await produktyWSklepie()
      console.log(`w sklepie stoi ${znalezione.length} z ${wszystkich} nowości:`)
      for (const p of znalezione) console.log(`  ${p.sku}  /sklep/produkt/${p.handle}`)

      if (!znalezione.length) {
        console.log(
          "\nŻadna z nowości nie jest jeszcze opublikowana — odnośnik prowadziłby donikąd.\n" +
            "Opublikuj je (Ceny → filtr „Szkice”) i puść ten skrypt jeszcze raz."
        )
        return
      }
      if (!ZAPISZ) {
        console.log("\n(podgląd) Powtórz z --zapisz.")
        return
      }

      await directus(`/items/news/${wpis.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: zProduktami(wpis.content || WPIS.content, znalezione) }),
      })
      console.log(`\nGotowe — lista jest na końcu wpisu.`)
      console.log(`  ${DIRECTUS}/admin/content/news/${wpis.id}`)
      return
    }

    if (!TYLKO_ZDJECIA) {
      console.log("Nic nie robię — treść poprawia się w panelu, nie skryptem.")
      console.log("Zdjęcia:   node scripts/news/garmin-wrzesien-2026.mjs --zdjecia --zapisz")
      console.log("Odnośniki do sklepu:  node scripts/news/garmin-wrzesien-2026.mjs --produkty --zapisz")
      console.log(`  ${DIRECTUS}/admin/content/news/${wpis.id}`)
      return
    }

    // Treści nie przepisujemy — bierzemy tę, która stoi w panelu, i tylko
    // wstawiamy w nią kadry. Gdyby ktoś zdążył ją poprawić, poprawki zostają.
    if (/<img\s/i.test(wpis.content || "")) {
      console.log("W treści już są zdjęcia — nic nie ruszam, żeby ich nie zdublować.")
      return
    }

    console.log("wgrywam zdjęcia z garmin.com i wstawiam je do istniejącego wpisu:")
    if (!ZAPISZ) {
      console.log("\n(podgląd) Powtórz z --zapisz.")
      return
    }

    const { tresc, hero } = await zeZdjeciami(wpis.content || WPIS.content)
    await directus(`/items/news/${wpis.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: tresc, ...(hero && !wpis.image ? { image: hero } : {}) }),
    })
    console.log(`\nGotowe. Zostało przeczytać treść i przestawić stan na „published”.`)
    console.log(`  ${DIRECTUS}/admin/content/news/${wpis.id}`)
    return
  }

  console.log(`${ZAPISZ ? "→" : "(podgląd)"} zakładam aktualność „${WPIS.title}" jako szkic`)
  if (!ZAPISZ) {
    console.log("\nNic nie zapisano. Powtórz z --zapisz.")
    return
  }

  console.log("wgrywam zdjęcia z garmin.com do biblioteki Directusa:")
  const { tresc, hero } = await zeZdjeciami(WPIS.content)

  const { data } = await directus("/items/news", {
    method: "POST",
    body: JSON.stringify({ ...WPIS, content: tresc, ...(hero ? { image: hero } : {}) }),
  })
  console.log(`Gotowe, id ${data?.id}.`)
  console.log("")
  console.log(hero ? "Została jedna rzecz w panelu:" : "Zostały dwie rzeczy w panelu:")
  if (!hero) console.log("  1. wybierz zdjęcie (bez kadru wpis wygląda na liście jak dziura),")
  console.log(`  ${hero ? "" : "2. "}przeczytaj treść i przestaw stan na „published”.`)
  console.log(`  ${DIRECTUS}/admin/content/news/${data?.id}`)
}

main().catch((problem) => {
  console.error("Nie udało się:", problem.message)
  process.exit(1)
})
