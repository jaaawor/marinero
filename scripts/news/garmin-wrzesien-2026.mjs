// Aktualność o nowościach Garmin / JL Audio z 1 września 2026.
//
//   node scripts/news/garmin-wrzesien-2026.mjs            # pokazuje, co zrobi
//   node scripts/news/garmin-wrzesien-2026.mjs --zapisz   # zapisuje
//
// Uruchamia się **na VPS-ie**, bo potrzebuje `DIRECTUS_ADMIN_TOKEN`.
//
// Treść napisana z sześciu ogłoszeń producenta (GMI 40, JL Audio A60/A60-H,
// M200, NRX-300, R5, SmartDrive). **Nie ma w niej ani jednej ceny** — ceny
// wchodzą razem z produktami do sklepu, a artykuł o premierze przeżyje
// niejedną zmianę cennika.
//
// Wpis powstaje jako **szkic**: zdjęcie trzeba wybrać w panelu, a nagłówek
// bez kadru wygląda na liście jak dziura.

import "../lib/env.mjs"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")

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
    `/items/news?filter[slug][_eq]=${encodeURIComponent(SLUG)}&fields=id,title,status&limit=1`
  )

  if (sa.length) {
    console.log(`Wpis „${sa[0].title}" już jest (id ${sa[0].id}, stan: ${sa[0].status}).`)
    console.log("Nic nie robię — treść poprawia się w panelu, nie skryptem.")
    return
  }

  console.log(`${ZAPISZ ? "→" : "(podgląd)"} zakładam aktualność „${WPIS.title}" jako szkic`)
  if (!ZAPISZ) {
    console.log("\nNic nie zapisano. Powtórz z --zapisz.")
    return
  }

  const { data } = await directus("/items/news", { method: "POST", body: JSON.stringify(WPIS) })
  console.log(`Gotowe, id ${data?.id}.`)
  console.log("")
  console.log("Zostały dwie rzeczy w panelu:")
  console.log(`  1. wybierz zdjęcie (bez kadru wpis wygląda na liście jak dziura),`)
  console.log(`  2. przestaw stan na „published".`)
  console.log(`  ${DIRECTUS}/admin/content/news/${data?.id}`)
}

main().catch((problem) => {
  console.error("Nie udało się:", problem.message)
  process.exit(1)
})
