// Zgłoszenie zakupu do Google Analytics 4 i Google Ads.
//
// Samo `gtag('config', 'AW-…')` z `Analytics.tsx` mierzy tylko wejścia. Żeby
// Ads wiedział, która reklama sprzedała, potrzebuje **zdarzenia konwersji**
// z wartością zamówienia — bez niego kampania optymalizuje się na kliknięcia,
// a nie na sprzedaż.
//
// Etykietę konwersji zakłada się w panelu Google Ads (Cele → Konwersje →
// zakup) i wkleja w Directusie, w `site_settings.google_ads_conversion`,
// w postaci `AW-16749670155/AbC-D_efGh`. Bez niej wysyłamy samo zdarzenie
// GA4 — a bez `gtag` na stronie nie dzieje się nic.

type Zakup = {
  /** Numer zamówienia — Google odsiewa po nim powtórki po odświeżeniu strony. */
  numer: string
  wartosc: number
  waluta?: string
  /** Pełna etykieta konwersji z Google Ads: `AW-…/…`. */
  etykietaAds?: string
}

export function zglosZakup({ numer, wartosc, waluta = "PLN", etykietaAds }: Zakup) {
  if (typeof window === "undefined") return

  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag !== "function") return

  gtag("event", "purchase", {
    transaction_id: numer,
    value: wartosc,
    currency: waluta,
  })

  if (etykietaAds) {
    gtag("event", "conversion", {
      send_to: etykietaAds,
      transaction_id: numer,
      value: wartosc,
      currency: waluta,
    })
  }
}
