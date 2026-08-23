import { NextResponse } from "next/server"
import { hasAdminToken, medusaAdmin } from "@/lib/medusa-admin"
import { createPayuOrder, payuReady, toGrosze } from "@/lib/payu"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Czy sklep ma już konto PayU — po tym zamówienie pokazuje wybór płatności. */
export async function GET() {
  return NextResponse.json({ wlaczone: payuReady() && hasAdminToken() })
}

/**
 * Rozpoczyna płatność PayU dla zamówienia, które już powstało w Medusie.
 *
 * **Kwotę bierzemy z Medusy, nigdy z przeglądarki.** Gdyby przychodziła
 * z formularza, każdy mógłby zapłacić za łódź złotówkę — a PayU
 * potwierdziłoby taką płatność bez mrugnięcia.
 */
export async function POST(request: Request) {
  if (!payuReady()) {
    return NextResponse.json(
      { error: "Płatności online nie są jeszcze włączone." },
      { status: 503 }
    )
  }

  if (!hasAdminToken()) {
    return NextResponse.json(
      { error: "Brak dostępu do zamówień (MEDUSA_ADMIN_TOKEN)." },
      { status: 503 }
    )
  }

  let orderId = ""
  try {
    const body = await request.json()
    orderId = String(body?.zamowienie || "").trim()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    return NextResponse.json({ error: "Brak numeru zamówienia" }, { status: 400 })
  }

  let order: any
  try {
    const body = await medusaAdmin(
      `/admin/orders/${orderId}?fields=id,display_id,email,total,currency_code,metadata,` +
        "*items,*shipping_address"
    )
    order = body?.order
  } catch {
    return NextResponse.json({ error: "Nie znalazłem zamówienia" }, { status: 404 })
  }

  if (!order) {
    return NextResponse.json({ error: "Nie znalazłem zamówienia" }, { status: 404 })
  }

  // Zapłacone raz nie może być opłacone drugi raz.
  if (order?.metadata?.payu_status === "COMPLETED") {
    return NextResponse.json({ error: "To zamówienie jest już opłacone." }, { status: 409 })
  }

  const total = toGrosze(Number(order.total) || 0)
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "Zamówienie ma zerową kwotę" }, { status: 400 })
  }

  const origin = siteOrigin(request)
  const address = order.shipping_address || {}

  // Pozycje muszą sumować się do kwoty zamówienia, inaczej PayU odrzuca
  // zamówienie. Wysyłka i podatki nie są osobnymi pozycjami w tej liście,
  // więc różnicę dokładamy jako jedną pozycję zbiorczą.
  const products = (order.items || [])
    .map((item: any) => ({
      name: String(item?.title || "Pozycja"),
      unitPrice: toGrosze(Number(item?.unit_price) || 0),
      quantity: Math.max(1, Number(item?.quantity) || 1),
    }))
    .filter((item: any) => item.unitPrice > 0)

  const itemsTotal = products.reduce(
    (sum: number, item: any) => sum + item.unitPrice * item.quantity,
    0
  )
  if (itemsTotal !== total) {
    products.length = 0
    products.push({
      name: `Zamówienie nr ${order.display_id ?? ""}`.trim(),
      unitPrice: total,
      quantity: 1,
    })
  }

  try {
    const { redirectUri, payuOrderId } = await createPayuOrder({
      extOrderId: String(order.id),
      description: `Marinero — zamówienie nr ${order.display_id ?? order.id}`,
      totalAmount: total,
      customerIp: clientIp(request),
      notifyUrl: `${origin}/api/payu/notify`,
      continueUrl: `${origin}/sklep/platnosc?zamowienie=${encodeURIComponent(order.id)}`,
      buyer: {
        email: String(order.email || ""),
        phone: String(address.phone || ""),
        firstName: String(address.first_name || ""),
        lastName: String(address.last_name || ""),
      },
      products,
    })

    // Zapisujemy od razu, żeby nieopłacone zamówienie dało się rozpoznać
    // w panelu, a nie tylko takie, za które ktoś zapłacił.
    await medusaAdmin(`/admin/orders/${order.id}`, {
      method: "POST",
      body: JSON.stringify({
        metadata: { payu_status: "PENDING", payu_order_id: payuOrderId },
      }),
    }).catch(() => undefined)

    return NextResponse.json({ redirect: redirectUri })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Nie udało się rozpocząć płatności" },
      { status: 502 }
    )
  }
}

/** Adres sklepu — pod niego PayU odeśle klienta i powiadomienie. */
function siteOrigin(request: Request): string {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim()
  if (configured) return configured.replace(/\/$/, "")
  return new URL(request.url).origin
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  const first = forwarded.split(",")[0]?.trim()
  // PayU wymaga adresu IP kupującego; przy braku nagłówka dajemy adres
  // lokalny, który PayU akceptuje, zamiast wywracać całą płatność.
  return first || "127.0.0.1"
}
