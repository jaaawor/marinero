// Dostępność produktu jest sterowana metadanymi w Medusie — pole `dostepnosc`
// (i opcjonalnie `sztuki`) przy produkcie, edytowalne w panelu admina.
// Kody trzymamy krótkie, żeby dało się je wpisać ręcznie bez pomyłki.

export type AvailabilityCode =
  | "od-reki"
  | "2-3-dni"
  | "7-10-dni"
  | "14-dni"
  | "na-zamowienie"
  | "niedostepny"

export type Availability = {
  code: AvailabilityCode
  /** Krótko, na kartę produktu. */
  short: string
  /** Pełny opis do kolumny zakupu. */
  label: string
  /** Kolor kropki: zielony = od ręki, bursztyn = na termin, szary = na zapytanie. */
  tone: "green" | "amber" | "grey"
  /** Liczba sztuk, gdy sprzedawca ją poda. */
  quantity: number
}

const DEFINITIONS: Record<AvailabilityCode, Omit<Availability, "code" | "quantity">> = {
  "od-reki": {
    short: "Dostępny od ręki",
    label: "Dostępny od ręki — wysyłka w 24 h",
    tone: "green",
  },
  "2-3-dni": {
    short: "Wysyłka 2–3 dni",
    label: "Dostępny — wysyłka w 2–3 dni robocze",
    tone: "green",
  },
  "7-10-dni": {
    short: "Wysyłka 7–10 dni",
    label: "Dostępny — wysyłka w 7–10 dni roboczych",
    tone: "amber",
  },
  "14-dni": {
    short: "Wysyłka do 14 dni",
    label: "Dostępny — wysyłka do 14 dni roboczych",
    tone: "amber",
  },
  "na-zamowienie": {
    short: "Na zamówienie",
    label: "Na zamówienie — termin potwierdzamy po kontakcie",
    tone: "amber",
  },
  niedostepny: {
    short: "Chwilowo niedostępny",
    label: "Chwilowo niedostępny — zapytaj o najbliższy termin",
    tone: "grey",
  },
}

/** Wszystkie kody dostępności — czyta je też panel (tabela Cen i arkusz). */
export const CODES = Object.keys(DEFINITIONS) as AvailabilityCode[]

const ELECTRONICS = ["garmin", "gpsmap", "echomap", "striker", "fusion", "lowrance", "livescope"]

/**
 * Czyta dostępność z metadanych produktu. Bez wpisu w panelu zgaduje po marce:
 * Suzuki wysyłamy w 2–3 dni, elektronikę w 7–10 dni.
 */
export function getAvailability(
  metadata: Record<string, unknown> | null | undefined,
  title = ""
): Availability {
  const raw = String(metadata?.dostepnosc || "").trim() as AvailabilityCode
  const quantity = Number(metadata?.sztuki) || 0

  const code: AvailabilityCode = CODES.includes(raw)
    ? raw
    : title.toLowerCase().includes("suzuki")
      ? "2-3-dni"
      : ELECTRONICS.some((word) => title.toLowerCase().includes(word))
        ? "7-10-dni"
        : "7-10-dni"

  return { code, quantity, ...DEFINITIONS[code] }
}

export function availabilityDotClass(tone: Availability["tone"]): string {
  return tone === "green"
    ? "bg-emerald-500"
    : tone === "amber"
      ? "bg-amber-500"
      : "bg-[#0E1A2B]/25"
}
