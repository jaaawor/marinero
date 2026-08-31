#!/usr/bin/env node
//
// Sprawdzenie poczty wychodzącej — zanim klient wyśle pierwszą ofertę.
//
//   cd /opt/marinero-frontend
//   node scripts/poczta/test.mjs adres@docelowy.pl
//
// Skrypt czyta te same zmienne co strona (`SMTP_HOST`, `SMTP_PORT`,
// `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`), więc jeśli tu przejdzie, przejdzie
// i formularz kontaktowy, i wysyłka oferty z konfiguratora.
//
// Hasła nie wypisujemy nigdzie — ani w logu, ani w treści maila.

import nodemailer from "nodemailer"
import { wczytajSrodowisko } from "../lib/env.mjs"

// Czytamy `.env.local`, `.env.production` i `.env` — tak jak strona.
// Samo `--env-file=.env.local` widziało tylko jeden z nich, więc klucz
// ustawiony gdzie indziej wyglądał na nieistniejący.
wczytajSrodowisko()


const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT) || 587
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const from = process.env.MAIL_FROM || user
const to = process.argv[2] || process.env.MAIL_TO

if (!host || !user || !pass) {
  console.error(
    "Brakuje danych SMTP w .env.local. Potrzebne:\n" +
      "  SMTP_HOST=mail.marinero.pl\n" +
      "  SMTP_PORT=587\n" +
      "  SMTP_USER=biuro@marinero.pl\n" +
      "  SMTP_PASS=<hasło skrzynki>\n" +
      "  MAIL_FROM=biuro@marinero.pl\n" +
      "  MAIL_TO=biuro@marinero.pl"
  )
  process.exit(1)
}

if (!to) {
  console.error("Podaj adres docelowy: node scripts/poczta/test.mjs ktos@example.com")
  process.exit(1)
}

// `secure` tylko na 465 — na 587 idzie STARTTLS, czyli połączenie zaczyna się
// jawnie i szyfruje po komendzie. Ustawione odwrotnie wiesza się bez błędu.
const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
})

console.log(`Łączę się z ${host}:${port} jako ${user}…`)

try {
  await transport.verify()
  console.log("  serwer przyjmuje logowanie")
} catch (error) {
  console.error("  logowanie odrzucone:", error.message)
  console.error(
    "\nNajczęstsze przyczyny:\n" +
      "  • hasło skrzynki inne niż w .env.local,\n" +
      "  • port 465 zamiast 587 (albo odwrotnie),\n" +
      "  • serwer pocztowy blokuje logowanie z adresu IP tego serwera —\n" +
      "    wtedy trzeba go odblokować w panelu hostingu poczty."
  )
  process.exit(1)
}

const info = await transport.sendMail({
  from,
  to,
  subject: "Marinero — test poczty wychodzącej",
  text:
    "Jeśli czytasz tę wiadomość, wysyłka ze strony marinero.pl działa.\n\n" +
    `Serwer: ${host}:${port}\nNadawca: ${from}\n`,
})

console.log(`Wysłane do ${to} (id: ${info.messageId})`)
console.log("\nSprawdź, czy wiadomość nie wpadła do spamu — jeśli tak, trzeba")
console.log("dopisać serwer do SPF-a albo wysyłać z tego samego hosta co MX.")
