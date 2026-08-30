import { NextResponse } from "next/server"
import { hasAdminToken, medusaAdmin } from "@/lib/medusa-admin"
import { payuReady, toGrosze, verifyPayuSignature } from "@/lib/payu"
import { wyslijPotwierdzenie } from "@/lib/potwierdzenie-zamowienia"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Powiadomienie od PayU o statusie płatności.
 *
 * To jest jedyne miejsce, w którym zamówienie robi się „opłacone", więc
 * wszystko tutaj jest nieufne:
 *
 * 1. **Podpis** — `md5(treść + drugi klucz)`. Bez tego każdy mógłby wysłać
 *    nam „COMPLETED" i odebrać towar bez płacenia.
 * 2. **Kwota** — porównujemy z kwotą zamówienia w Medusie. Podpisane
 *    powiadomienie na 1 zł za zamówienie na 5 000 zł nie może przejść.
 * 3. **Odpowiadamy 200 nawet na sytuacje, których nie obsługujemy** —
 *    PayU ponawia powiadomienie tak długo, aż dostanie 200, a nie ma sensu
 *    zmuszać go do ponawiania czegoś, co się nie zmieni.
 */
export async function POST(request: Request) {
  if (!payuReady()) {
    return NextResponse.json({ ok: false, reason: "payu_off" }, { status: 503 })
  }

  // Podpis liczy się z DOKŁADNEJ treści żądania — parsowanie i ponowne
  // złożenie JSON-a zmieniłoby białe znaki i podpis przestałby się zgadzać.
  const raw = await request.text()

  if (!verifyPayuSignature(raw, request.headers.get("openpayu-signature"))) {
    return NextResponse.json({ ok: false, reason: "bad_signature" }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 })
  }

  const order = payload?.order
  const orderId = String(order?.extOrderId || "").trim()
  const status = String(order?.status || "").toUpperCase()

  if (!orderId || !status) {
    return NextResponse.json({ ok: true, reason: "nothing_to_do" })
  }

  if (!hasAdminToken()) {
    // 500, bo to stan przejściowy po naszej stronie — niech PayU ponowi.
    return NextResponse.json({ ok: false, reason: "no_admin_token" }, { status: 500 })
  }

  let medusaOrder: any
  try {
    const body = await medusaAdmin(`/admin/orders/${orderId}?fields=id,total,metadata`)
    medusaOrder = body?.order
  } catch {
    return NextResponse.json({ ok: true, reason: "unknown_order" })
  }

  if (!medusaOrder) {
    return NextResponse.json({ ok: true, reason: "unknown_order" })
  }

  // Zgodność kwoty sprawdzamy tylko przy płatności zakończonej — przy
  // anulowanej czy odrzuconej kwota nie ma znaczenia.
  if (status === "COMPLETED") {
    const expected = toGrosze(Number(medusaOrder.total) || 0)
    const paid = Number(order?.totalAmount)

    if (!Number.isFinite(paid) || paid !== expected) {
      await note(orderId, {
        payu_status: "AMOUNT_MISMATCH",
        payu_paid_amount: String(order?.totalAmount ?? ""),
        payu_expected_amount: String(expected),
      })
      return NextResponse.json({ ok: true, reason: "amount_mismatch" })
    }
  }

  await note(orderId, {
    payu_status: status,
    payu_order_id: String(order?.orderId || ""),
    payu_updated_at: new Date().toISOString(),
  })

  // Potwierdzenie dla klienta wychodzi dopiero po **udanej** płatności.
  // Wysyłka nie może wywrócić odpowiedzi dla PayU: gdyby poszła 500, PayU
  // ponawiałoby powiadomienie, a status w zamówieniu jest już zapisany.
  if (status === "COMPLETED") {
    await wyslijPotwierdzenie(orderId, { oplacone: true }).catch(() => undefined)
  }

  return NextResponse.json({ ok: true })
}

async function note(orderId: string, metadata: Record<string, string>) {
  await medusaAdmin(`/admin/orders/${orderId}`, {
    method: "POST",
    body: JSON.stringify({ metadata }),
  }).catch(() => undefined)
}
