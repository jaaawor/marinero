import { NextResponse } from "next/server"
import { daneDoPrzelewu, sendOrderConfirmation, smtpConfigured } from "@/lib/order-mail"
import { getSiteSettings } from "@/lib/directus"
import { apaczkaConfigured, createShipment } from "@/lib/apaczka"

export const dynamic = "force-dynamic"

// Obsługa zamówienia po jego złożeniu: mail do klienta i (opcjonalnie)
// nadanie przesyłki w Apaczce.
//
// Bez SMTP zwracamy `email_skipped_no_smtp`, bez kluczy Apaczki przesyłka
// leci w trybie podglądu — oba stany są poprawne, nie błędne.
// Endpoint chroni `ORDERS_API_TOKEN` (nagłówek `x-orders-token`), żeby nie
// dało się nim wysyłać maili z zewnątrz.

export async function POST(request) {
  const token = process.env.ORDERS_API_TOKEN

  if (token && request.headers.get("x-orders-token") !== token) {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  const orderNumber = String(body.orderNumber || body.display_id || "").trim()
  const email = String(body.email || "").trim()

  if (!orderNumber || !email) {
    return NextResponse.json(
      { error: "Wymagane pola: orderNumber, email" },
      { status: 400 }
    )
  }

  const items = Array.isArray(body.items)
    ? body.items.map((item) => ({
        title: String(item.title || ""),
        quantity: Number(item.quantity) || 1,
        total: Number(item.total) || 0,
      }))
    : []

  const result = { orderNumber, email }

  // `przelew: true` dokłada blok z numerem konta — tym samym, który idzie do
  // klienta przy przelewie tradycyjnym. Dane biorą się z ustawień w panelu,
  // nie z treści żądania: numeru konta nie podaje się z zewnątrz.
  const przelew = body.przelew
    ? daneDoPrzelewu(await getSiteSettings().catch(() => null))
    : undefined

  // 1) Mail z potwierdzeniem
  try {
    const mail = await sendOrderConfirmation({
      orderNumber,
      email,
      customerName: body.customerName,
      items,
      total: Number(body.total) || 0,
      shippingMethod: body.shippingMethod,
      paymentNote: body.paymentNote,
      ...(przelew ? { przelew } : {}),
    })

    result.mail = mail.sent ? { sent: true } : { sent: false, reason: mail.reason }
  } catch (error) {
    result.mail = { sent: false, error: error?.message || "Nie udało się wysłać maila" }
  }

  // 2) Przesyłka — tylko gdy podano adres odbiorcy
  if (body.receiver?.line1 && body.receiver?.city) {
    const shipment = await createShipment({
      reference: orderNumber,
      receiver: {
        name: body.receiver.name || body.customerName || "",
        email,
        phone: body.receiver.phone,
        line1: body.receiver.line1,
        postalCode: body.receiver.postalCode || "",
        city: body.receiver.city,
        countryCode: body.receiver.countryCode,
      },
      weightKg: Number(body.weightKg) || undefined,
      // Kod automatu zapisuje sklep w metadanych zamówienia przy składaniu —
      // stąd bierze się przesyłka do paczkomatu zamiast kuriera pod adres.
      parcelLocker: body.parcelLocker || body.metadata?.paczkomat || undefined,
      comment: body.comment,
    })

    result.shipment = shipment
  }

  result.konfiguracja = {
    smtp: smtpConfigured(),
    apaczka: apaczkaConfigured(),
  }

  return NextResponse.json(result)
}
