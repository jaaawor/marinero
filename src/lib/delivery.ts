import type { AvailabilityCode } from "@/lib/availability"

// Konkretny termin wysyłki i dostawy — to na x-kom.pl przekonuje do zakupu
// najbardziej („Dostawa: jutro, 20 sierpnia"). Liczymy w strefie Europe/Warsaw,
// bo serwer chodzi na UTC, i pomijamy weekendy.

const TZ = "Europe/Warsaw"

/** Godzina, do której paczka schodzi z magazynu tego samego dnia. */
export const CUTOFF_HOUR = 14

type Parts = { year: number; month: number; day: number; hour: number; weekday: number }

function warsawParts(date: Date): Parts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  ) as Record<string, string>

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    weekday: weekdays.indexOf(parts.weekday),
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Wielkanoc (algorytm Meeusa/Gaussa) — od niej liczą się święta ruchome. */
function easter(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

const FIXED_HOLIDAYS = [
  "01-01", // Nowy Rok
  "01-06", // Trzech Króli
  "05-01", // Święto Pracy
  "05-03", // Święto Konstytucji
  "08-15", // Wniebowzięcie NMP
  "11-01", // Wszystkich Świętych
  "11-11", // Święto Niepodległości
  "12-25",
  "12-26",
]

const holidayCache = new Map<number, Set<string>>()

function holidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const set = new Set(FIXED_HOLIDAYS)
  const { month, day } = easter(year)
  const base = Date.UTC(year, month - 1, day)

  // Poniedziałek Wielkanocny i Boże Ciało; Zielone Świątki wypadają w niedzielę.
  for (const offset of [1, 60]) {
    const date = new Date(base + offset * 24 * 60 * 60 * 1000)
    set.add(
      `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
    )
  }

  holidayCache.set(year, set)
  return set
}

/** Dzień wolny: sobota, niedziela albo święto ustawowe. */
function isDayOff(date: Date): boolean {
  const { weekday, year, month, day } = warsawParts(date)
  if (weekday === 0 || weekday === 6) return true

  const stamp = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return holidays(year).has(stamp)
}

/** Dodaje dni robocze, pomijając weekendy i święta. */
function addWorkingDays(from: Date, days: number): Date {
  let date = from
  let left = days

  while (left > 0) {
    date = addDays(date, 1)
    if (!isDayOff(date)) left -= 1
  }

  // Termin nigdy nie może wypaść w dzień wolny.
  while (isDayOff(date)) date = addDays(date, 1)
  return date
}

export type DeliveryEstimate = {
  /** Dzień nadania: 0 = dziś, 1 = jutro, dalej konkretna data. */
  dispatch: Date
  dispatchOffset: number
  /** Dzień u klienta — kurier jedzie jedną dobę roboczą. */
  delivery: Date
  deliveryOffset: number
  /** Ile godzin zostało do zamknięcia wysyłek, gdy paczka idzie dziś. */
  hoursLeft: number | null
}

/** Ile dni roboczych zajmuje skompletowanie paczki dla danego kodu dostępności. */
const LEAD_DAYS: Record<AvailabilityCode, number | null> = {
  "od-reki": 0,
  "2-3-dni": 2,
  "7-10-dni": 7,
  "14-dni": 12,
  "na-zamowienie": null,
  niedostepny: null,
}

/**
 * `now` wstrzykujemy w testach; w aplikacji liczy się przy odświeżeniu ISR,
 * więc data jest świeża co najwyżej z pięciu minut.
 */
export function getDeliveryEstimate(
  code: AvailabilityCode,
  now: Date = new Date()
): DeliveryEstimate | null {
  const lead = LEAD_DAYS[code]
  if (lead === null) return null

  const { hour } = warsawParts(now)

  // Po godzinie granicznej (i w weekend) paczka idzie następnego dnia roboczego.
  const sameDay = lead === 0 && hour < CUTOFF_HOUR && !isDayOff(now)

  const dispatch = sameDay ? now : addWorkingDays(now, Math.max(lead, 1))
  const delivery = addWorkingDays(dispatch, 1)

  const startOfDay = (date: Date) => {
    const p = warsawParts(date)
    return Date.UTC(p.year, p.month - 1, p.day)
  }

  const day = 24 * 60 * 60 * 1000

  return {
    dispatch,
    dispatchOffset: Math.round((startOfDay(dispatch) - startOfDay(now)) / day),
    delivery,
    deliveryOffset: Math.round((startOfDay(delivery) - startOfDay(now)) / day),
    hoursLeft: sameDay ? CUTOFF_HOUR - hour : null,
  }
}

/**
 * „jutro, 20 sierpnia" — dla dziś i jutra słowo, dalej data z dniem tygodnia.
 */
export function formatDeliveryDay(
  date: Date,
  offset: number,
  locale: string,
  words: { today: string; tomorrow: string }
): string {
  const stamp = new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  }).format(date)

  if (offset <= 0) return `${words.today}, ${stamp}`
  if (offset === 1) return `${words.tomorrow}, ${stamp}`

  const weekday = new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: "long" }).format(date)
  return `${weekday}, ${stamp}`
}
