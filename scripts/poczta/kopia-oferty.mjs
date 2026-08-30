#!/usr/bin/env node
//
// Sprawdzenie kopii oferty dla zespołu — bez wysyłania prawdziwej oferty
// i bez zaśmiecania panelu wpisem w „Zapytaniach ofertowych".
//
//   cd /opt/marinero-frontend
//   node --env-file=.env.local scripts/poczta/kopia-oferty.mjs
//
// Skrypt bierze adresy dokładnie tam, gdzie bierze je strona: `MAIL_TO`
// plus kolekcja `team` w Directusie (`offers` = tak). Jeśli list dojdzie,
// a kopia oferty nie dochodzi, problem jest w treści albo w filtrach
// odbiorcy — nie w adresach.
//
// Wysyłamy **jednym listem na `To:`**, tak samo jak strona. Kopie ofert
// ginęły wcześniej dlatego, że szły w BCC przy liście do klienta, a serwer
// pocztowy potrafi nie doręczyć BCC do skrzynki, z której list wychodzi.

import nodemailer from "nodemailer"

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT) || 587
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const from = process.env.MAIL_FROM || user
const toAdmin = process.env.MAIL_TO || ""
const directus = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL

if (!host || !user || !pass) {
  console.error("Brakuje danych SMTP w .env.local (SMTP_HOST, SMTP_USER, SMTP_PASS).")
  process.exit(1)
}

let zespol = []
if (directus) {
  try {
    const odpowiedz = await fetch(
      `${directus}/items/team?filter[status][_eq]=published&filter[offers][_eq]=true&fields=name,email&limit=50&sort=sort`
    )
    const dane = await odpowiedz.json()
    zespol = (dane?.data || []).map((osoba) => osoba.email).filter(Boolean)
  } catch (problem) {
    console.error("Nie udało się zapytać Directusa:", problem.message)
  }
}

const adresy = Array.from(new Set([toAdmin, ...zespol].filter(Boolean)))

console.log(`MAIL_TO:            ${toAdmin || "(nie ustawione)"}`)
console.log(`Zespół z Directusa: ${zespol.join(", ") || "(pusto)"}`)
console.log(`Kopia pójdzie do:   ${adresy.join(", ")}`)

if (!adresy.length) {
  console.error("\nNie ma do kogo wysłać. Ustaw MAIL_TO albo zaznacz „Przygotowuje oferty” komuś w panelu.")
  process.exit(1)
}

const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })

const info = await transport.sendMail({
  from,
  to: adresy.join(", "),
  subject: "Nowa oferta: XO DFNDR 8 — Jan Testowy (TEST)",
  html: `
    <p><strong>To jest test kopii oferty dla zespołu.</strong> Prawdziwa oferta wygląda tak samo.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:2px 14px 2px 0;color:#666">Model</td><td><strong>XO DFNDR 8</strong></td></tr>
      <tr><td style="padding:2px 14px 2px 0;color:#666">Klient</td><td><strong>Jan Testowy</strong></td></tr>
      <tr><td style="padding:2px 14px 2px 0;color:#666">Telefon</td><td><strong>600 100 200</strong></td></tr>
    </table>
    <p style="margin-top:14px;color:#666;font-size:13px">Przy prawdziwej ofercie w załączniku jest PDF.</p>
  `,
})

console.log(`\nWysłane (id: ${info.messageId})`)
console.log("Nie przyszło? Zajrzyj do spamu — i sprawdź, czy MAIL_FROM to ta sama")
console.log("skrzynka co adres odbiorcy: niektóre serwery nie doręczają listu do siebie samych.")
