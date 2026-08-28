#!/usr/bin/env node
//
// Wypisuje usługi kurierskie dostępne na koncie Apaczki.
//
// Z tej listy bierze się dwa identyfikatory do `.env.local`:
//   APACZKA_SERVICE_ID            — kurier pod adres
//   APACZKA_SERVICE_ID_PACZKOMAT  — InPost do paczkomatu
//
// Bez nich nadanie przesyłki idzie z pustym `service_id` i Apaczka je odbija.
//
//   cd /opt/marinero-frontend
//   APACZKA_APP_ID=… APACZKA_APP_SECRET=… node scripts/apaczka/uslugi.mjs
//
// Skrypt tylko **czyta** — niczego nie nadaje i nie zmienia na koncie.
// Przy okazji jest to pierwszy test podpisu: jeżeli Apaczka odpowie
// „invalid signature", to schemat podpisu trzeba poprawić w `src/lib/apaczka.ts`
// (specyfikacja API v2 jest u nich za logowaniem do panelu).

import crypto from "node:crypto"

const API = process.env.APACZKA_API_URL || "https://www.apaczka.pl/api/v2"
const APP_ID = process.env.APACZKA_APP_ID || ""
const APP_SECRET = process.env.APACZKA_APP_SECRET || ""

if (!APP_ID || !APP_SECRET) {
  console.error("Brak APACZKA_APP_ID / APACZKA_APP_SECRET — patrz nagłówek pliku.")
  process.exit(1)
}

const route = "service_structure"
const body = JSON.stringify({})
const expires = Math.floor(Date.now() / 1000) + 300
const signature = crypto
  .createHmac("sha256", APP_SECRET)
  // Nazwa akcji w podpisie idzie z ukośnikiem — patrz src/lib/apaczka.ts.
  .update(`${APP_ID}:${route}/:${body}:${expires}`)
  .digest("hex")

const odpowiedz = await fetch(`${API}/${route}/`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ app_id: APP_ID, request: body, expires: String(expires), signature }),
})

const tresc = await odpowiedz.text()
if (!odpowiedz.ok) {
  console.error(`Apaczka odpowiedziała ${odpowiedz.status}:\n${tresc.slice(0, 500)}`)
  process.exit(1)
}

let dane
try {
  dane = JSON.parse(tresc)
} catch {
  console.error(`Odpowiedź nie jest JSON-em:\n${tresc.slice(0, 500)}`)
  process.exit(1)
}

if (dane.status && dane.status !== 200) {
  const komunikat = String(dane.message || dane.status)
  console.error(`Apaczka (${API}): ${komunikat}`)

  if (/app not found/i.test(komunikat)) {
    console.error(
      "\nTo nie jest problem z podpisem — Apaczka nie zna tego `app_id` w tym\n" +
        "środowisku. Dwie najczęstsze przyczyny:\n" +
        "  1. To nie jest identyfikator aplikacji, tylko numer klienta. `app_id`\n" +
        "     zakłada się w panelu Apaczki przy tworzeniu aplikacji API.\n" +
        "  2. Klucze są z środowiska testowego, a pytamy produkcję (albo odwrotnie).\n" +
        "     Testowe: APACZKA_API_URL=https://sandbox.apaczka.pl/api/v2"
    )
  } else if (/signature/i.test(komunikat)) {
    console.error("\nPodpis do poprawienia w src/lib/apaczka.ts.")
  }

  process.exit(1)
}

// Struktura odpowiedzi bywa opakowana różnie w zależności od wersji konta —
// szukamy listy usług tam, gdzie może być, zamiast zakładać jedną ścieżkę.
const uslugi =
  dane?.response?.services ||
  dane?.response?.service_structure ||
  dane?.services ||
  []

if (!Array.isArray(uslugi) || !uslugi.length) {
  console.log("Nie rozpoznałem listy usług. Cała odpowiedź:\n")
  console.log(JSON.stringify(dane, null, 2).slice(0, 4000))
  process.exit(0)
}

console.log(`Usługi na koncie: ${uslugi.length}\n`)
for (const usluga of uslugi) {
  const id = usluga.service_id ?? usluga.id ?? "?"
  const nazwa = usluga.name || usluga.supplier || ""
  const typ = usluga.delivery_type || usluga.type || ""
  console.log(`  ${String(id).padEnd(8)} ${nazwa} ${typ ? `(${typ})` : ""}`)
}

console.log(
  "\nDo .env.local:\n" +
    "  APACZKA_SERVICE_ID=<numer usługi kuriera pod adres>\n" +
    "  APACZKA_SERVICE_ID_PACZKOMAT=<numer usługi InPost do paczkomatu>"
)
