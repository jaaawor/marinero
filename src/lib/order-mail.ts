// nodemailer nie ma typów w tym projekcie — konfigurator używa go z pliku .js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require("nodemailer")

// Maile do klienta po złożeniu zamówienia. Bez zmiennych SMTP nic nie wychodzi
// i zwracamy `email_skipped_no_smtp` — dokładnie tak jak przy ofertach
// z konfiguratora, żeby zachowanie było jedno i przewidywalne.
//
// Wymagane env na VPS: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
// `MAIL_FROM`, opcjonalnie `MAIL_TO` (kopia do sklepu).

export type OrderMailInput = {
  orderNumber: string
  email: string
  customerName?: string
  items: { title: string; quantity: number; total: number }[]
  total: number
  shippingMethod?: string
  paymentNote?: string
  /**
   * Dane do przelewu — **w tym samym mailu**, nie w obiecanym „osobnym".
   *
   * Mail mówił dotąd „dane do przelewu prześlemy w osobnej wiadomości", a tej
   * wiadomości nic nie wysyłało: klient zostawał z zamówieniem, za które nie
   * miał jak zapłacić. Numer konta i tytuł przelewu muszą stać tu, obok kwoty,
   * bo to jedyny list, który na pewno dochodzi.
   *
   * Puste, gdy zamówienie jest już opłacone (PayU) albo gdy w panelu nie
   * wpisano numeru konta — wtedy zamiast zmyślonego rachunku idzie telefon.
   */
  przelew?: {
    odbiorca: string
    konto: string
    bank?: string
    /** Telefon do sklepu — gdy numeru konta jeszcze nie ma w ustawieniach. */
    telefon?: string
  }
}

function money(value: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value || 0)
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

/**
 * Dane do przelewu z ustawień serwisu (Directus). Jedno miejsce dla obu
 * wołających: potwierdzenia z kasy i testu z panelu — inaczej test
 * sprawdzałby inny mail niż ten, który dostaje klient.
 */
export function daneDoPrzelewu(ustawienia: any): NonNullable<OrderMailInput["przelew"]> {
  return {
    odbiorca: ustawienia?.bank_odbiorca || ustawienia?.site_name || "Marinero",
    konto: String(ustawienia?.bank_konto || "").trim(),
    bank: ustawienia?.bank_nazwa || "",
    telefon: ustawienia?.phone_shop || ustawienia?.phone || "",
  }
}

// Adres logo — bezwzględny, bo w mailu nie ma „naszej" strony, z której
// dałoby się doliczyć ścieżkę względną. Znak wodny 1647 × 270 px pokazujemy
// przy 180 px szerokości; `alt` jest tu ważniejszy niż zwykle, bo połowa
// klientów pocztowych blokuje obrazki i wtedy zostaje sam tekst.
const LOGO = `${process.env.NEXT_PUBLIC_SITE_URL || "https://marinero.pl"}/logo-marinero.png`

const ATRAMENT = "#0E1A2B"
const PIASEK = "#F4F1EC"
const AKCENT = "#2E64A8"
const SZARY = "#6B7280"
const KRESKA = "#E5E2DC"

const KROJ = "'Helvetica Neue',Helvetica,Arial,sans-serif"

/**
 * Blok „Dane do przelewu". Bez numeru konta **nie zmyślamy rachunku** — idzie
 * wtedy prośba o kontakt z telefonem, bo pomyłka w tym miejscu to pieniądze
 * klienta wysłane w nieznane.
 */
function blokPrzelewu(input: OrderMailInput): string {
  const przelew = input.przelew
  if (!przelew) return ""

  const ramka = (tresc: string) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border-collapse:separate;border:1px solid ${AKCENT}33;border-radius:10px;background:#F7FAFD;margin:0 0 28px">
      <tr><td style="padding:22px 24px">${tresc}</td></tr>
    </table>`

  const naglowek = `
    <p style="margin:0 0 14px;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${AKCENT};font-weight:bold">
      Dane do przelewu
    </p>`

  if (!przelew.konto) {
    return ramka(`${naglowek}
      <p style="margin:0;font-size:15px;line-height:1.7;color:${ATRAMENT}">
        Prześlemy je osobną wiadomością. Jeśli nie dotrą w ciągu godziny,
        zadzwoń${przelew.telefon ? ` pod <strong>${przelew.telefon}</strong>` : ""} — nie chcemy,
        żebyś czekał na coś, co się zgubiło.
      </p>`)
  }

  const wiersz = (etykieta: string, wartosc: string, mocny = false) => `
    <tr>
      <td style="padding:5px 16px 5px 0;font-size:13px;color:${SZARY};white-space:nowrap;vertical-align:top">${etykieta}</td>
      <td style="padding:5px 0;font-size:${mocny ? "16px" : "15px"};font-weight:bold;color:${ATRAMENT}">${wartosc}</td>
    </tr>`

  return ramka(`${naglowek}
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${wiersz("Odbiorca", przelew.odbiorca)}
      ${wiersz("Numer konta", przelew.konto, true)}
      ${przelew.bank ? wiersz("Bank", przelew.bank) : ""}
      ${wiersz("Kwota", money(input.total), true)}
      ${wiersz("Tytuł przelewu", `Zamówienie ${input.orderNumber}`)}
    </table>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:${SZARY}">
      Po zaksięgowaniu wpłaty potwierdzimy termin wysyłki. Przy odbiorze osobistym
      możesz zapłacić na miejscu — napisz wtedy w odpowiedzi na tego maila.
    </p>`)
}

/**
 * Treść maila. Układ na **tabelach i stylach w atrybutach**, bo klienci
 * pocztowi nie mają dzisiejszego CSS-a: Outlook nie zna `flex`, Gmail wycina
 * `<style>` z nagłówka, a `max-width` na `<div>` bywa ignorowane. Stąd
 * ramka na `<table>` i szerokość podana dwa razy — atrybutem i stylem.
 */
function buildHtml(input: OrderMailInput): string {
  const rows = input.items
    .map(
      (item, numer) => `
        <tr>
          <td style="padding:14px 0;${numer ? `border-top:1px solid ${KRESKA};` : ""}font-size:15px;line-height:1.5;color:${ATRAMENT}">
            ${item.title}
            <span style="display:block;margin-top:3px;font-size:13px;color:${SZARY}">${item.quantity} szt.</span>
          </td>
          <td style="padding:14px 0;${numer ? `border-top:1px solid ${KRESKA};` : ""}text-align:right;white-space:nowrap;font-size:15px;font-weight:bold;color:${ATRAMENT}">
            ${money(item.total)}
          </td>
        </tr>`
    )
    .join("")

  const szczegol = (etykieta: string, wartosc: string) => `
    <tr>
      <td style="padding:4px 16px 4px 0;font-size:13px;color:${SZARY};white-space:nowrap">${etykieta}</td>
      <td style="padding:4px 0;font-size:14px;color:${ATRAMENT}">${wartosc}</td>
    </tr>`

  const szczegoly = [
    input.shippingMethod ? szczegol("Dostawa", input.shippingMethod) : "",
    input.paymentNote ? szczegol("Płatność", input.paymentNote) : "",
  ].join("")

  return `
<div style="background:${PIASEK};padding:32px 12px;font-family:${KROJ};-webkit-text-size-adjust:100%">
  <!-- Zajawka: to widać na liście wiadomości obok tematu. Bez niej klient
       pocztowy bierze tam pierwsze słowa treści, czyli „Marinero". -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    Zamówienie ${input.orderNumber} przyjęte — ${money(input.total)}.
  </div>

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center"
    style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse">

    <tr>
      <td style="padding:0 0 22px;text-align:center">
        <img src="${LOGO}" alt="Marinero" width="180"
          style="display:inline-block;width:180px;max-width:60%;height:auto;border:0" />
      </td>
    </tr>

    <tr>
      <td style="background:#ffffff;border-radius:14px;padding:36px 32px">

        <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${AKCENT};font-weight:bold">
          Zamówienie ${input.orderNumber}
        </p>

        <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;font-weight:bold;color:${ATRAMENT}">
          Dziękujemy za zamówienie
        </h1>

        <p style="margin:0 0 30px;font-size:15px;line-height:1.75;color:${SZARY}">
          ${input.customerName ? `${input.customerName}, przyjęliśmy` : "Przyjęliśmy"} Twoje zamówienie.
          Poniżej wszystko, co w nim jest. Odezwiemy się, gdy potwierdzimy termin wysyłki.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${rows}
          <tr>
            <td style="padding:18px 0 0;border-top:2px solid ${ATRAMENT};font-size:15px;color:${ATRAMENT}">
              <strong>Razem</strong>
            </td>
            <td style="padding:18px 0 0;border-top:2px solid ${ATRAMENT};text-align:right;font-size:22px;font-weight:bold;color:${ATRAMENT};white-space:nowrap">
              ${money(input.total)}
            </td>
          </tr>
        </table>

        ${
          szczegoly
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:26px 0 28px">${szczegoly}</table>`
            : `<div style="height:28px"></div>`
        }

        ${blokPrzelewu(input)}

        <p style="margin:0;font-size:14px;line-height:1.75;color:${SZARY}">
          Masz pytanie do zamówienia? Odpisz na tę wiadomość — czytamy każdą odpowiedź.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:24px 8px 0;text-align:center;font-size:12px;line-height:1.8;color:${SZARY}">
        <strong style="color:${ATRAMENT}">Marinero</strong> — sprzedaż i serwis łodzi, Gdynia<br />
        <a href="https://marinero.pl/sklep" style="color:${AKCENT};text-decoration:none">marinero.pl/sklep</a>
      </td>
    </tr>
  </table>
</div>`
}

export async function sendOrderConfirmation(
  input: OrderMailInput
): Promise<{ sent: boolean; reason?: string }> {
  if (!smtpConfigured()) {
    return { sent: false, reason: "email_skipped_no_smtp" }
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: input.email,
    // Kopia do sklepu, żeby zamówienie nie umknęło.
    bcc: process.env.MAIL_TO || undefined,
    subject: `Marinero — zamówienie ${input.orderNumber}`,
    html: buildHtml(input),
  })

  return { sent: true }
}
