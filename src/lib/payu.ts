// Płatności online przez PayU (karta, BLIK, szybki przelew).
//
// Medusa stoi na tym VPS jako osobny kontener i nie da się do niej dołożyć
// wtyczki płatności z tego repozytorium. Dlatego PayU jest obsłużone
// **po stronie sklepu**: zamówienie powstaje w Medusie tak jak dotąd
// (dostawca `pp_system_default`), a zaraz po nim zakładamy zamówienie
// w PayU i odsyłamy klienta na jego stronę płatności. Wynik wraca
// powiadomieniem na `/api/payu/notify` i ląduje w metadanych zamówienia.
//
// Bez kompletu zmiennych środowiskowych **nic się nie dzieje**: opcja
// płatności online w ogóle się nie pokazuje, a sklep działa jak dziś
// (przelew / ustalenie po zamówieniu). Ta sama zasada co przy Chatwoocie
// i Analytics — kod może stać na produkcji, zanim klient założy konto.

import { createHash } from "node:crypto"

export type PayuConfig = {
  posId: string
  clientId: string
  clientSecret: string
  /** Drugi klucz (MD5) — nim PayU podpisuje powiadomienia. */
  md5Key: string
  base: string
}

/**
 * Konfiguracja albo `null`, gdy sklep nie ma jeszcze konta PayU.
 * `PAYU_ENV=sandbox` przełącza na środowisko testowe PayU.
 */
export function payuConfig(): PayuConfig | null {
  const posId = String(process.env.PAYU_POS_ID || "").trim()
  const clientSecret = String(process.env.PAYU_CLIENT_SECRET || "").trim()
  const md5Key = String(process.env.PAYU_MD5_KEY || "").trim()

  if (!posId || !clientSecret || !md5Key) return null

  return {
    posId,
    // W PayU `client_id` to zwykle ten sam numer co POS ID — ale bywa inny,
    // więc dajemy się go nadpisać osobno.
    clientId: String(process.env.PAYU_CLIENT_ID || posId).trim(),
    clientSecret,
    md5Key,
    base:
      String(process.env.PAYU_ENV || "").toLowerCase() === "sandbox"
        ? "https://secure.snd.payu.com"
        : "https://secure.payu.com",
  }
}

export function payuReady(): boolean {
  return payuConfig() !== null
}

/** Token OAuth. PayU wydaje go na ~12 h, ale bierzemy świeży przy każdym zamówieniu. */
async function payuToken(config: PayuConfig): Promise<string> {
  const response = await fetch(`${config.base}/pl/standard/user/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  })

  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.access_token) {
    throw new Error(`PayU nie wydał tokenu (${response.status})`)
  }

  return String(body.access_token)
}

export type PayuProduct = { name: string; unitPrice: number; quantity: number }

export type PayuOrderInput = {
  /** Numer zamówienia w Medusie — po nim rozpoznajemy płatność w powiadomieniu. */
  extOrderId: string
  description: string
  /** Kwota w GROSZACH. */
  totalAmount: number
  customerIp: string
  notifyUrl: string
  continueUrl: string
  buyer: { email: string; phone?: string; firstName?: string; lastName?: string }
  products: PayuProduct[]
}

/**
 * Zakłada zamówienie w PayU i zwraca adres, na który trzeba odesłać klienta.
 *
 * PayU odpowiada przekierowaniem 302 z treścią JSON — dlatego `redirect:
 * "manual"`. Domyślne podążanie za przekierowaniem gubi `redirectUri`
 * i kończy się HTML-em zamiast JSON-a.
 */
export async function createPayuOrder(input: PayuOrderInput) {
  const config = payuConfig()
  if (!config) throw new Error("PayU nie jest skonfigurowane")

  const token = await payuToken(config)

  const response = await fetch(`${config.base}/api/v2_1/orders`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notifyUrl: input.notifyUrl,
      continueUrl: input.continueUrl,
      customerIp: input.customerIp,
      merchantPosId: config.posId,
      description: input.description.slice(0, 255),
      currencyCode: "PLN",
      totalAmount: String(input.totalAmount),
      extOrderId: input.extOrderId,
      buyer: {
        email: input.buyer.email,
        ...(input.buyer.phone ? { phone: input.buyer.phone } : {}),
        ...(input.buyer.firstName ? { firstName: input.buyer.firstName } : {}),
        ...(input.buyer.lastName ? { lastName: input.buyer.lastName } : {}),
        language: "pl",
      },
      products: input.products.map((item) => ({
        name: item.name.slice(0, 255),
        unitPrice: String(item.unitPrice),
        quantity: String(item.quantity),
      })),
    }),
    cache: "no-store",
  })

  const text = await response.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`PayU odpowiedziało nie-JSON-em (${response.status})`)
  }

  const status = body?.status?.statusCode
  if (!body?.redirectUri || (status && status !== "SUCCESS")) {
    throw new Error(
      `PayU odrzuciło zamówienie: ${status || response.status} ${
        body?.status?.codeLiteral || ""
      }`.trim()
    )
  }

  return {
    redirectUri: String(body.redirectUri),
    payuOrderId: String(body.orderId || ""),
  }
}

/**
 * Sprawdza podpis powiadomienia. PayU liczy `md5(treść + drugi klucz)`
 * i wysyła go w nagłówku `OpenPayU-Signature`.
 *
 * Bez tej weryfikacji każdy mógłby wysłać nam „zapłacone" i zamówienie
 * zostałoby oznaczone jako opłacone bez pieniędzy.
 */
export function verifyPayuSignature(rawBody: string, header: string | null): boolean {
  const config = payuConfig()
  if (!config || !header) return false

  const parts = Object.fromEntries(
    header
      .split(";")
      .map((piece) => piece.split("="))
      .filter((pair) => pair.length === 2)
      .map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
  )

  const signature = parts.signature
  if (!signature) return false

  const algorithm = (parts.algorithm || "MD5").toUpperCase()
  if (algorithm !== "MD5") return false

  const expected = createHash("md5").update(rawBody + config.md5Key, "utf8").digest("hex")

  // Porównanie odporne na czas — długości są równe (32 znaki hex).
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index)
  }
  return diff === 0
}

/** Złotówki z Medusy → grosze dla PayU. */
export function toGrosze(amount: number): number {
  return Math.round(Number(amount) * 100)
}
