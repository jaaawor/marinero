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
}

function money(value: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value || 0)
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
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
