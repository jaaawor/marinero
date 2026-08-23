// Propozycja opisu produktu.
//
// Nie wymyśla faktów: bierze to, co już wiemy (nazwa, rozpoznane cechy,
// dotychczasowy opis) i układa z tego tekst, który mówi klientowi, do czego
// to pasuje i dlaczego kupić u nas. Dotychczasowe opisy były suchymi wypisami
// zgodności — prawdziwymi, ale nie pomagały wybrać.
//
// To dopiero **propozycja**: człowiek ją czyta, poprawia i dopiero wtedy
// zapisuje. Nic nie idzie do sklepu automatycznie.

import { parseProduct } from "@/lib/product-family"

export type DraftInput = {
  title: string
  description: string
  category: string
}

const ENGINE_BRANDS = /suzuki|mercury|quicksilver|torqeedo|honda|yamaha/i
const ELECTRONICS = /garmin|gpsmap|echomap|striker|lowrance|fusion|livescope|navionics/i
const SERVICE_PARTS = /olej|smar|filtr|świec|anod|uszczelk|zestaw serwisowy|maintenance|impeler|pompa wody/i

// Marki i skróty, które zostają wielkimi literami przy prostowaniu nazw
// pisanych CAPS LOCKIEM (a takich po imporcie z WooCommerce jest sporo).
const KEEP_UPPER = new Set([
  "NMEA", "GPS", "GPSMAP", "LED", "USB", "VHF", "AIS", "DC", "AC",
  "EFI", "XS", "HD", "UHD", "SD", "PRO", "XP", "RIB", "CE", "IP", "SIM",
])

const BRANDS: Record<string, string> = {
  suzuki: "Suzuki",
  mercury: "Mercury",
  quicksilver: "Quicksilver",
  torqeedo: "Torqeedo",
  garmin: "Garmin",
  lowrance: "Lowrance",
  fusion: "Fusion",
  honda: "Honda",
  yamaha: "Yamaha",
  navionics: "Navionics",
  echomap: "ECHOMAP",
  striker: "Striker",
  sika: "Sika",
  ecstar: "ECSTAR",
  avator: "Avator",
}

/**
 * „BATERIA E2.3KWH DO SILNIKA MERCURY AVATOR" → „Bateria E2.3KWH do silnika
 * Mercury AVATOR". Nazwy z importu bywają w całości wielkimi literami, a taki
 * tytuł wklejony w opis wygląda jak krzyk.
 */
export function humanizeTitle(title: string): string {
  const raw = String(title || "").trim()
  if (!raw) return ""

  const letters = raw.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, "")
  const upper = letters.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, "")
  // Tylko nazwy pisane niemal w całości wersalikami — resztę zostawiamy.
  if (!letters || upper.length / letters.length < 0.8) return raw

  const words = raw.split(/\s+/).map((word) => {
    const bare = word.replace(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż.-]/g, "")
    if (KEEP_UPPER.has(bare.toUpperCase())) return bare.toUpperCase()
    if (BRANDS[bare.toLowerCase()]) return BRANDS[bare.toLowerCase()]
    // Symbole i kody zostawiamy tak, jak są („E2.3KWH", „8M0123025").
    if (/\d/.test(word)) return word
    return word.toLowerCase()
  })

  const first = words[0]
  words[0] = first.charAt(0).toUpperCase() + first.slice(1)
  return words.join(" ")
}

/** Zdanie zamykające zależy od tego, co to za towar. */
function closing(title: string, category: string): string {
  const haystack = `${title} ${category}`

  if (/torqeedo/i.test(haystack)) {
    return "Jesteśmy dealerem Torqeedo — pomożemy dobrać baterię i śrubę, a serwis prowadzimy u siebie w Gdyni."
  }

  if (ELECTRONICS.test(haystack)) {
    return "Autoryzowany dealer — dobierzemy zestaw do Twojej łodzi i zamontujemy go na miejscu, w Gdyni."
  }

  if (SERVICE_PARTS.test(haystack)) {
    return "Część do przeglądu — jeśli nie masz pewności, jakiej potrzebujesz, podaj model silnika, a skompletujemy resztę."
  }

  if (ENGINE_BRANDS.test(haystack)) {
    return "Autoryzowany dealer i serwis — zakup, przegląd i gwarancję załatwiasz w jednym miejscu, w Gdyni."
  }

  return "Nie wiesz, czy pasuje do Twojej łodzi? Zadzwoń — doradzamy przy sprzęcie, który sami serwisujemy."
}

/** Dotychczasowy opis: zostaje, bo trzyma fakty o zgodności. */
function factual(description: string): string {
  const clean = String(description || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")

  // Opisy z danych przykładowych Medusy są po angielsku i o koszulkach —
  // do polskiego sklepu nie wnoszą nic.
  if (/Reimagine the feeling|everyday essentials/i.test(clean)) return ""

  return clean
}

export function draftDescription(input: DraftInput): string {
  const facts = factual(input.description)
  const parts: string[] = []

  // Zdanie otwierające dokładamy tylko wtedy, gdy opisu nie ma wcale —
  // przy istniejącym opisie powtarzałoby nazwę, która i tak stoi nad tekstem.
  if (!facts) {
    const parsed = parseProduct(input.title)
    // `display` to wersja dla człowieka („L — długa (20″)"), `value` to sam
    // kod — w opisie „Wersja: X, AP" nic nie znaczy.
    const traits = (parsed?.traits || [])
      .map((trait) => `${trait.label.toLowerCase()}: ${trait.display || trait.value}`)
      .filter((line) => !/:\s*$/.test(line))
      .slice(0, 3)

    const name = humanizeTitle(input.title)
    parts.push(traits.length ? `${name} — ${traits.join(", ")}.` : `${name}.`)
  } else {
    parts.push(facts)
  }

  parts.push(closing(input.title, input.category))
  return parts.filter(Boolean).join("\n\n")
}

/**
 * Czy opis w ogóle warto ruszać. Sam fakt, że jest krótki, wystarcza —
 * a pusty tym bardziej.
 */
export function needsWork(description: string): boolean {
  return factual(description).length < 180
}
