import { sendOrderConfirmation, smtpConfigured } from "@/lib/order-mail"

/**
 * Mail z potwierdzeniem zamówienia — jedno miejsce dla obu dróg zakupu.
 *
 * Zamówienie może się domknąć na dwa sposoby: przelewem (klient kończy
 * w sklepie i nikt więcej się nie odzywa) albo przez PayU (potwierdzenie
 * przychodzi z ich serwera, już po opuszczeniu naszej strony). Mail musi
 * wyjść w obu, więc treść i wysyłka siedzą tu, a nie w którejś ze ścieżek.
 *
 * Zamówienie czytamy **z Medusy**, nie z przeglądarki: kwoty i pozycje
 * w mailu mają być te same, co w zamówieniu, a nie te, które ktoś podał.
 *
 * Wysyłamy **raz**. Znacznik `mail_potwierdzenie` w metadanych pilnuje, żeby
 * ponowione powiadomienie z PayU (a te potrafią przyjść kilka razy) nie
 * zasypało klienta tą samą wiadomością.
 */

const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"

function basic(): string {
  const token = process.env.MEDUSA_ADMIN_TOKEN || ""
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`
}

async function admin(sciezka: string, init: RequestInit = {}) {
  const odpowiedz = await fetch(`${MEDUSA}${sciezka}`, {
    ...init,
    headers: { Authorization: basic(), "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  })
  if (!odpowiedz.ok) throw new Error(`${sciezka} → ${odpowiedz.status}`)
  return odpowiedz.json()
}

export type WynikPotwierdzenia = {
  wyslane: boolean
  powod?: string
}

export async function wyslijPotwierdzenie(
  orderId: string,
  opcje: { oplacone?: boolean; wymus?: boolean } = {}
): Promise<WynikPotwierdzenia> {
  if (!process.env.MEDUSA_ADMIN_TOKEN) return { wyslane: false, powod: "brak_tokenu_medusy" }
  if (!smtpConfigured()) return { wyslane: false, powod: "email_skipped_no_smtp" }

  let zamowienie: any
  try {
    const dane = await admin(
      `/admin/orders/${orderId}?fields=id,display_id,email,total,metadata,` +
        `*items,*shipping_methods,*shipping_address`
    )
    zamowienie = dane?.order
  } catch {
    return { wyslane: false, powod: "nieznane_zamowienie" }
  }

  if (!zamowienie?.email) return { wyslane: false, powod: "brak_adresu" }
  // `wymus` jest dla panelu: sprzedawca widzi, że klient maila nie dostał
  // (literówka w adresie, skrzynka pełna) i wysyła go ponownie ręcznie.
  // Automat dalej wysyła raz.
  if (!opcje.wymus && zamowienie.metadata?.mail_potwierdzenie === "wyslany") {
    return { wyslane: false, powod: "juz_wyslany" }
  }

  const adres = zamowienie.shipping_address || {}
  const wynik = await sendOrderConfirmation({
    orderNumber: String(zamowienie.display_id || zamowienie.id),
    email: zamowienie.email,
    customerName: [adres.first_name, adres.last_name].filter(Boolean).join(" "),
    items: (zamowienie.items || []).map((pozycja: any) => ({
      title: pozycja.product_title || pozycja.title || "",
      quantity: Number(pozycja.quantity) || 0,
      total: Number(pozycja.total) || 0,
    })),
    total: Number(zamowienie.total) || 0,
    shippingMethod: zamowienie.shipping_methods?.[0]?.name || "",
    paymentNote: opcje.oplacone
      ? "Płatność otrzymana — dziękujemy."
      : "Zamówienie przyjęte. Dane do przelewu prześlemy w osobnej wiadomości.",
  })

  if (!wynik.sent) return { wyslane: false, powod: wynik.reason }

  // Znacznik stawiamy dopiero po udanej wysyłce — inaczej przy błędzie SMTP
  // zamówienie zostałoby oznaczone jako obsłużone i klient nie dostałby nic.
  await admin(`/admin/orders/${orderId}`, {
    method: "POST",
    body: JSON.stringify({ metadata: { mail_potwierdzenie: "wyslany" } }),
  }).catch(() => undefined)

  return { wyslane: true }
}
