import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

/**
 * Reset hasła klienta — przekazanie tokenu do marinero.pl.
 *
 * Ten plik należy do **Medusy**, nie do frontu. Kopiuje się go do projektu
 * Medusy w `/opt/marinero` jako `src/subscribers/haslo-reset.ts`.
 *
 * Po co: `POST /auth/customer/emailpass/reset-password` nie oddaje tokenu
 * w odpowiedzi — Medusa emituje zdarzenie `auth.password_reset` u siebie
 * w środku. Bez odbiorcy token przepada i klient nigdy nie dostaje maila
 * (zgłoszenie kończy się na „201 Created" i na tym koniec).
 *
 * Mail wysyła front, bo tam siedzi SMTP, szablon i adresy — jedno miejsce
 * zamiast dwóch rozjeżdżających się.
 *
 * Wymagane zmienne po stronie Medusy:
 *   MARINERO_URL       — np. https://marinero.pl
 *   MARINERO_RESET_KEY — ten sam sekret co `RESET_HOOK_TOKEN` we froncie
 */
type Dane = {
  entity_id: string
  token: string
  actor_type: string
}

export default async function resetHasla({ event }: SubscriberArgs<Dane>) {
  // Zdarzenie leci także dla resetów konta administratora — tamtych nie
  // wysyłamy do sklepowej skrzynki klienta.
  if (event.data.actor_type !== "customer") return

  const adres = process.env.MARINERO_URL
  const klucz = process.env.MARINERO_RESET_KEY

  if (!adres || !klucz) {
    console.warn("[reset-hasla] brak MARINERO_URL albo MARINERO_RESET_KEY — mail nie poszedł")
    return
  }

  const odpowiedz = await fetch(`${adres}/api/konto/reset-mail`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-reset-token": klucz },
    body: JSON.stringify({
      // Przy `emailpass` `entity_id` to adres e-mail klienta.
      email: event.data.entity_id,
      token: event.data.token,
    }),
  }).catch((problem) => {
    console.error("[reset-hasla] nie udało się połączyć z frontem:", problem?.message)
    return null
  })

  if (odpowiedz && !odpowiedz.ok) {
    console.error("[reset-hasla] front odrzucił zgłoszenie:", odpowiedz.status, await odpowiedz.text())
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
