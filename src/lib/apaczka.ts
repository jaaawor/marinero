import crypto from "node:crypto"

// Integracja z Apaczką (nadawanie przesyłek i etykiety).
//
// UWAGA: pełna specyfikacja API v2 jest u Apaczki za logowaniem do panelu,
// więc schemat podpisu poniżej trzeba potwierdzić przy pierwszym teście na
// koncie klienta. Bez zmiennych środowiskowych moduł działa w TRYBIE PODGLĄDU:
// buduje żądanie, ale nie wysyła go nigdzie i nie tworzy przesyłki.
//
// Wymagane env na VPS: `APACZKA_APP_ID`, `APACZKA_APP_SECRET`.

const API = process.env.APACZKA_API_URL || "https://www.apaczka.pl/api/v2"
const APP_ID = process.env.APACZKA_APP_ID || ""
const APP_SECRET = process.env.APACZKA_APP_SECRET || ""

export function apaczkaConfigured(): boolean {
  return Boolean(APP_ID && APP_SECRET)
}

/**
 * Podpis żądania. Apaczka podpisuje sklejkę `app_id:route:data:expires`
 * kluczem aplikacji (HMAC-SHA256).
 */
function sign(route: string, data: string, expires: number): string {
  const payload = `${APP_ID}:${route}:${data}:${expires}`
  return crypto.createHmac("sha256", APP_SECRET).update(payload).digest("hex")
}

export type ApaczkaResult = {
  ok: boolean
  /** `true`, gdy nic nie poszło do Apaczki (brak konfiguracji). */
  preview: boolean
  route: string
  request: Record<string, unknown>
  response?: unknown
  error?: string
}

async function call(route: string, data: Record<string, unknown>): Promise<ApaczkaResult> {
  const body = JSON.stringify(data)
  const expires = Math.floor(Date.now() / 1000) + 300

  const request = { app_id: APP_ID, request: body, expires, route }

  if (!apaczkaConfigured()) {
    // Bez kluczy pokazujemy, co POSZŁOBY do Apaczki — bez wysyłania.
    return { ok: true, preview: true, route, request: { ...request, app_id: "(brak)" } }
  }

  const form = new URLSearchParams({
    app_id: APP_ID,
    request: body,
    expires: String(expires),
    signature: sign(route, body, expires),
  })

  try {
    const response = await fetch(`${API}/${route}/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false,
        preview: false,
        route,
        request,
        error: `Apaczka odpowiedziała ${response.status}`,
        response: payload,
      }
    }

    return { ok: true, preview: false, route, request, response: payload }
  } catch (error) {
    return {
      ok: false,
      preview: false,
      route,
      request,
      error: error instanceof Error ? error.message : "Błąd połączenia z Apaczką",
    }
  }
}

export type ShipmentInput = {
  /** Numer zamówienia z Medusy — trafia do opisu przesyłki. */
  reference: string
  receiver: {
    name: string
    email?: string
    phone?: string
    line1: string
    postalCode: string
    city: string
    countryCode?: string
  }
  /** Waga całej paczki w kilogramach. */
  weightKg?: number
  /** Kwota pobrania w złotych; brak = przesyłka bez pobrania. */
  codAmount?: number
  comment?: string
}

/** Lista usług kurierskich dostępnych na koncie — do wyboru przewoźnika. */
export function getServices() {
  return call("service_structure", {})
}

/** Nadanie przesyłki dla zamówienia ze sklepu. */
export function createShipment(input: ShipmentInput) {
  const receiver = input.receiver

  return call("order_send", {
    order: {
      service_id: process.env.APACZKA_SERVICE_ID || "",
      address: {
        receiver: {
          name: receiver.name,
          line1: receiver.line1,
          postal_code: receiver.postalCode,
          city: receiver.city,
          country_code: receiver.countryCode || "PL",
          email: receiver.email || "",
          phone: receiver.phone || "",
        },
      },
      option: {},
      notification: receiver.email ? { email: receiver.email } : {},
      shipment: [
        {
          dimension1: 40,
          dimension2: 30,
          dimension3: 20,
          weight: input.weightKg || 5,
          is_nonstandard: false,
          shipment_type_code: "PACZKA",
        },
      ],
      cod: input.codAmount ? { amount: input.codAmount, bankaccount: process.env.APACZKA_IBAN || "" } : undefined,
      comment: input.comment || `Zamówienie ${input.reference}`,
      content: `Zamówienie ${input.reference}`,
    },
  })
}

/** Etykieta (list przewozowy) do wydruku. */
export function getWaybill(orderId: string) {
  return call("waybill", { order_id: orderId })
}
