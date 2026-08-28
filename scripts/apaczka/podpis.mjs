#!/usr/bin/env node
//
// Ustala, jak dokładnie Apaczka liczy podpis żądania.
//
// Specyfikacja API v2 stoi u nich za logowaniem do panelu, a szczegóły, które
// decydują o wyniku, są niewidoczne z zewnątrz: czy nazwa akcji w podpisie ma
// ukośnik na końcu i czy puste żądanie zapisuje się jako `{}` czy `[]`
// (biblioteka producenta jest w PHP, a tam pusta tablica koduje się jako `[]`).
// Zamiast zgadywać, przechodzimy kombinacje i patrzymy, która przechodzi.
//
//   cd /opt/marinero-frontend
//   APACZKA_APP_ID=… APACZKA_APP_SECRET=… node scripts/apaczka/podpis.mjs
//
// Skrypt pyta o `service_structure`, czyli **tylko czyta** listę usług —
// niczego nie nadaje i nie zmienia na koncie.

import crypto from "node:crypto"

const API = process.env.APACZKA_API_URL || "https://www.apaczka.pl/api/v2"
const APP_ID = process.env.APACZKA_APP_ID || ""
const APP_SECRET = process.env.APACZKA_APP_SECRET || ""

if (!APP_ID || !APP_SECRET) {
  console.error("Brak APACZKA_APP_ID / APACZKA_APP_SECRET — patrz nagłówek pliku.")
  process.exit(1)
}

const AKCJA = "service_structure"

// Co się może różnić: nazwa akcji w podpisie, zapis pustego żądania i to,
// czy podpis idzie hasłem szesnastkowym czy w base64.
const NAZWY = [AKCJA, `${AKCJA}/`, `/${AKCJA}/`]
const TRESCI = ["{}", "[]", ""]
const KODOWANIA = ["hex", "base64"]

let znalezione = null

for (const nazwa of NAZWY) {
  for (const tresc of TRESCI) {
    for (const kodowanie of KODOWANIA) {
      const expires = Math.floor(Date.now() / 1000) + 300
      const podpis = crypto
        .createHmac("sha256", APP_SECRET)
        .update(`${APP_ID}:${nazwa}:${tresc}:${expires}`)
        .digest(kodowanie)

      let komunikat = ""
      let status = null
      try {
        const odpowiedz = await fetch(`${API}/${AKCJA}/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            app_id: APP_ID,
            request: tresc,
            expires: String(expires),
            signature: podpis,
          }).toString(),
        })
        const tekst = await odpowiedz.text()
        try {
          const dane = JSON.parse(tekst)
          status = dane.status
          komunikat = dane.message || ""
        } catch {
          komunikat = tekst.slice(0, 80)
        }
      } catch (blad) {
        komunikat = blad.message
      }

      const opis =
        `nazwa=${JSON.stringify(nazwa).padEnd(22)} ` +
        `treść=${JSON.stringify(tresc).padEnd(6)} ` +
        `podpis=${kodowanie.padEnd(6)}`

      if (status === 200) {
        console.log(`✓ ${opis} → DZIAŁA`)
        znalezione = { nazwa, tresc, kodowanie }
      } else {
        console.log(`  ${opis} → ${status || ""} ${komunikat}`.trimEnd())
      }

      // Nie walimy w ich API bez przerwy.
      await new Promise((czekaj) => setTimeout(czekaj, 400))
    }
  }
}

if (znalezione) {
  console.log(
    `\nDziałający wariant: nazwa akcji ${JSON.stringify(znalezione.nazwa)}, ` +
      `puste żądanie ${JSON.stringify(znalezione.tresc)}, podpis ${znalezione.kodowanie}.`
  )
  console.log("Wklej tę linijkę — poprawię src/lib/apaczka.ts.")
} else {
  console.log(
    "\nŻaden wariant nie przeszedł. Jeżeli wszystkie mówią o podpisie, to znaczy,\n" +
      "że klucz aplikacji jest inny niż ten podany — w panelu Apaczki bywa osobny\n" +
      "sekret do środowiska testowego (APACZKA_API_URL=https://sandbox.apaczka.pl/api/v2)."
  )
  process.exit(1)
}
