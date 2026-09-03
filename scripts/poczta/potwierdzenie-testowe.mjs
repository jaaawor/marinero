// Testowy mail z potwierdzeniem zamówienia — ten sam, który dostaje klient.
//
//   node scripts/poczta/potwierdzenie-testowe.mjs michal@marinero.pl
//
// Uruchamia się **na VPS-ie**: potrzebuje `ORDERS_API_TOKEN` (i SMTP-u, który
// i tak siedzi tylko tam). Woła `/api/zamowienia` — czyli dokładnie tę drogę,
// którą idzie prawdziwe potwierdzenie, z blokiem „Dane do przelewu"
// wypełnionym z ustawień w panelu. Osobny szablon do testów sprawdzałby maila,
// którego nikt nie dostaje.
//
// Zamówienie jest **zmyślone i nic nie zapisuje** — to jest wysyłka listu,
// nie założenie zamówienia w Medusie.

import "../lib/env.mjs"

const ADRES = process.argv[2] || ""
const BAZA = process.env.TEST_MAIL_URL || "https://marinero.pl"
const TOKEN = process.env.ORDERS_API_TOKEN || ""

if (!ADRES.includes("@")) {
  console.error("Podaj adres: node scripts/poczta/potwierdzenie-testowe.mjs michal@marinero.pl")
  process.exit(1)
}

const zamowienie = {
  orderNumber: `TEST-${new Date().toISOString().slice(0, 10)}`,
  email: ADRES,
  customerName: "Jan Testowy",
  items: [
    { title: "Suzuki DF 6 AS — silnik zaburtowy", quantity: 1, total: 8900 },
    { title: "Olej Suzuki Marine 10W-40, 4 l", quantity: 2, total: 360 },
  ],
  total: 9260,
  shippingMethod: "Kurier — dostawa pod adres",
  paymentNote: "Przelew tradycyjny — dane do przelewu poniżej.",
  // To włącza blok z numerem konta. Sam numer bierze się z `site_settings`,
  // nie stąd — danych do zapłaty nie podaje się z zewnątrz.
  przelew: true,
}

const odpowiedz = await fetch(`${BAZA}/api/zamowienia`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(TOKEN ? { "x-orders-token": TOKEN } : {}),
  },
  body: JSON.stringify(zamowienie),
})

const tekst = await odpowiedz.text()
let wynik
try {
  wynik = JSON.parse(tekst)
} catch {
  console.error(`Serwer oddał coś, co nie jest JSON-em (HTTP ${odpowiedz.status}):`)
  console.error(tekst.slice(0, 400))
  process.exit(1)
}

if (!odpowiedz.ok) {
  console.error(`HTTP ${odpowiedz.status}:`, wynik?.error || tekst.slice(0, 200))
  process.exit(1)
}

if (wynik?.mail?.sent) {
  console.log(`Wysłane na ${ADRES}. Sprawdź skrzynkę (i folder ze spamem).`)
} else {
  console.error("Mail NIE wyszedł:", wynik?.mail?.reason || wynik?.mail?.error || "nieznany powód")
  if (wynik?.mail?.reason === "email_skipped_no_smtp") {
    console.error("Brakuje SMTP_HOST / SMTP_USER / SMTP_PASS w .env.local na serwerze.")
  }
  process.exit(1)
}
