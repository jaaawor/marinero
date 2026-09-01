// Widoki listy zamówień i nazwy rynków — same stałe, bez sekretów.
//
// Osobny plik, bo czyta je **panel w przeglądarce**, a `allegro.ts` ciągnie
// za sobą klucze konta sprzedażowego i token z Directusa. Importowanie go
// z komponentu klienckiego wciągnęłoby to wszystko do paczki wysyłanej
// przeglądarce.

/**
 * **`status` i `fulfillment.status` to dwie różne rzeczy** i pomylenie ich było
 * realnym błędem: `status=READY_FOR_PROCESSING` znaczy tylko tyle, że kupujący
 * wypełnił formularz zakupu — a nie, że zamówienie czeka na nas. Wpadały tam
 * także paczki dawno wysłane i odebrane, więc zakładka „do obsłużenia"
 * pokazywała robotę, której nie było. Tym, co sprzedawca prowadzi ręcznie,
 * jest `fulfillment.status`, i to po nim filtrujemy.
 */
export const WIDOKI_ZAMOWIEN = [
  {
    klucz: "do-obsluzenia",
    nazwa: "Do obsłużenia",
    // Wszystko, co nie jest jeszcze wysłane, odebrane ani anulowane.
    realizacja: ["NEW", "PROCESSING", "READY_FOR_SHIPMENT", "READY_FOR_PICKUP"],
  },
  { klucz: "nowe", nazwa: "Nowe", realizacja: ["NEW"] },
  { klucz: "w-realizacji", nazwa: "W realizacji", realizacja: ["PROCESSING"] },
  {
    klucz: "gotowe",
    nazwa: "Gotowe do wysyłki",
    realizacja: ["READY_FOR_SHIPMENT", "READY_FOR_PICKUP"],
  },
  { klucz: "wyslane", nazwa: "Wysłane", realizacja: ["SENT"] },
  { klucz: "odebrane", nazwa: "Odebrane", realizacja: ["PICKED_UP"] },
  { klucz: "wszystkie", nazwa: "Wszystkie", realizacja: [] },
] as const

export type KluczWidoku = (typeof WIDOKI_ZAMOWIEN)[number]["klucz"]

/**
 * Rynki Allegro. Zamówienia przychodzą **ze wszystkich naraz** — API nie ma
 * ustawienia „tylko Polska", a oferta wystawiona w Polsce jest widoczna także
 * u sąsiadów. Dlatego rynek pokazujemy przy zamówieniu i dajemy po nim
 * filtrować, zamiast udawać, że wszystko jest polskie.
 */
export const RYNKI: Record<string, string> = {
  "allegro-pl": "Polska",
  "allegro-cz": "Czechy",
  "allegro-sk": "Słowacja",
  "allegro-hu": "Węgry",
}

/** Nazwa rynku dla człowieka; nieznany identyfikator pokazujemy jak jest. */
export function nazwaRynku(id: string): string {
  return RYNKI[id] || id
}
