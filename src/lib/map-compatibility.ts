// Mapy morskie sprzedajemy w dwóch wariantach i to nie jest oczywiste przy
// zakupie: karty pod marką **Garmin Navionics** działają wyłącznie w sprzęcie
// Garmina, a karty **Navionics** (bez Garmina w nazwie) obsługuje też sprzęt
// innych producentów. Navionics należy do Garmina od 2017 roku, stąd zamieszanie.
//
// Sprzedawca może nadpisać wynik metadanymi produktu w Medusie:
// `mapy_kompatybilnosc` = `garmin` albo `uniwersalna`.

export type MapCompatibility = {
  scope: "garmin" | "uniwersalna"
  /** Krótka etykieta na kafelek i kartę produktu. */
  label: string
  /** Pełne zdanie do kolumny zakupu. */
  detail: string
  /** Marki ploterów, które czytają tę kartę. */
  brands: string[]
}

/** Producenci, których plotery czytają karty Navionics. */
const UNIVERSAL_BRANDS = ["Garmin", "Lowrance", "Simrad", "B&G", "Raymarine", "Humminbird"]

const DEFINITIONS: Record<MapCompatibility["scope"], Omit<MapCompatibility, "scope">> = {
  garmin: {
    label: "Tylko Garmin",
    detail: "Karta w wersji Garmin Navionics — działa wyłącznie w ploterach Garmin.",
    brands: ["Garmin"],
  },
  uniwersalna: {
    label: "Wiele marek",
    detail: "Karta Navionics — obsługiwana także przez plotery innych producentów.",
    brands: UNIVERSAL_BRANDS,
  },
}

/** Czy produkt jest mapą — po kategorii albo po nazwie. */
export function isMapProduct(title: string, categoryHandles: string[] = []): boolean {
  if (categoryHandles.includes("mapy")) return true
  return /\b(mapa|mapy|navionics)\b/i.test(title)
}

export function getMapCompatibility(
  title: string,
  metadata?: Record<string, unknown> | null,
  categoryHandles: string[] = []
): MapCompatibility | null {
  if (!isMapProduct(title, categoryHandles)) return null

  const raw = String(metadata?.mapy_kompatybilnosc || "").trim().toLowerCase()
  if (raw === "garmin" || raw === "uniwersalna") {
    return { scope: raw, ...DEFINITIONS[raw] }
  }

  // „Garmin Navionics" to wersja zamknięta na sprzęt Garmina; samo „Navionics"
  // (albo mapa bez marki w nazwie) traktujemy jako uniwersalną.
  const scope: MapCompatibility["scope"] = /garmin\s+navionics/i.test(title)
    ? "garmin"
    : "uniwersalna"

  return { scope, ...DEFINITIONS[scope] }
}
