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

/**
 * Blok „Dane do przelewu". Bez numeru konta **nie zmyślamy rachunku** — idzie
 * wtedy prośba o kontakt z telefonem, bo pomyłka w tym miejscu to pieniądze
 * klienta wysłane w nieznane.
 */
function blokPrzelewu(input: OrderMailInput): string {
  const przelew = input.przelew
  if (!przelew) return ""

  const ramka = (tresc: string) =>
    `<div style="border:1px solid #2E64A8;border-radius:6px;padding:16px 18px;margin:0 0 24px">${tresc}</div>`

  if (!przelew.konto) {
    return ramka(`
      <p style="margin:0 0 8px;font-size:15px;font-weight:bold">Dane do przelewu</p>
      <p style="margin:0;line-height:1.7">
        Prześlemy je osobną wiadomością. Jeśli nie dotrą w ciągu godziny,
        zadzwoń${przelew.telefon ? `: <strong>${przelew.telefon}</strong>` : ""} — nie chcemy,
        żebyś czekał na coś, co się zgubiło.
      </p>`)
  }

  const wiersz = (etykieta: string, wartosc: string) =>
    `<tr>
      <td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap">${etykieta}</td>
      <td style="padding:4px 0;font-weight:bold">${wartosc}</td>
    </tr>`

  return ramka(`
    <p style="margin:0 0 12px;font-size:15px;font-weight:bold">Dane do przelewu</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${wiersz("Odbiorca", przelew.odbiorca)}
      ${wiersz("Numer konta", przelew.konto)}
      ${przelew.bank ? wiersz("Bank", przelew.bank) : ""}
      ${wiersz("Kwota", money(input.total))}
      ${wiersz("Tytuł przelewu", `Zamówienie ${input.orderNumber}`)}
    </table>
    <p style="margin:14px 0 0;line-height:1.7;font-size:13px;color:#6b7280">
      Po zaksięgowaniu wpłaty potwierdzimy termin wysyłki. Przy odbiorze osobistym
      możesz też zapłacić na miejscu — napisz wtedy w odpowiedzi na tego maila.
    </p>`)
}

function buildHtml(input: OrderMailInput): string {
  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e6e6e6">${item.title}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e6e6e6;text-align:center">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e6e6e6;text-align:right">${money(item.total)}</td>
        </tr>`
    )
    .join("")

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#0E1A2B;max-width:620px">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#2E64A8;margin:0 0 8px">
      Marinero
    </p>

    <h1 style="font-size:22px;margin:0 0 16px">Dziękujemy za zamówienie ${input.orderNumber}</h1>

    <p style="line-height:1.7;margin:0 0 20px">
      ${input.customerName ? `${input.customerName}, ` : ""}przyjęliśmy Twoje zamówienie.
      Skontaktujemy się, gdy tylko potwierdzimy termin wysyłki.
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">
          <th style="padding-bottom:8px">Produkt</th>
          <th style="padding-bottom:8px;text-align:center">Ilość</th>
          <th style="padding-bottom:8px;text-align:right">Wartość</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="font-size:18px;font-weight:bold;margin:18px 0 24px">Razem: ${money(input.total)}</p>

    ${input.shippingMethod ? `<p style="margin:0 0 6px"><strong>Dostawa:</strong> ${input.shippingMethod}</p>` : ""}
    ${input.paymentNote ? `<p style="margin:0 0 20px"><strong>Płatność:</strong> ${input.paymentNote}</p>` : ""}

    ${blokPrzelewu(input)}

    <p style="line-height:1.7;color:#6b7280;font-size:13px;margin-top:28px">
      Marinero — sprzedaż i serwis w Gdyni.<br />
      W razie pytań odpisz na tego maila albo zadzwoń.
    </p>
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
