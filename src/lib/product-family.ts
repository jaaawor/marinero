// Produkty przyszły z WooCommerce jako osobne wpisy — silnik w czarnym i białym
// kolorze albo ploter 9" i 12" to w Medusie różne produkty, nie warianty.
// Tutaj odczytujemy z tytułów, co je łączy (rodzina) i czym się różnią (cechy),
// żeby na stronie produktu dało się przeskoczyć do siostrzanej wersji —
// jak wybór rozmiaru koszulki.

export type ProductTrait = {
  /** Klucz cechy, np. „kolumna". */
  key: string
  /** Etykieta pokazywana nad wyborem. */
  label: string
  /** Wartość surowa — po niej porównujemy produkty. */
  value: string
  /** Wartość dla człowieka, np. „L — długa (20″)". */
  display: string
}

export type ParsedProduct = {
  /** Wspólny klucz rodziny, np. „suzuki-df-6". */
  family: string
  traits: ProductTrait[]
}

const SHAFT_LABEL: Record<string, string> = {
  S: 'S — krótka (15″)',
  L: 'L — długa (20″)',
  X: 'X — bardzo długa (25″)',
  XX: 'XX — ekstra długa (30″)',
  UL: 'UL — ultralekka',
}

function shaftTrait(value: string): ProductTrait {
  return {
    key: "kolumna",
    label: "Długość kolumny",
    value,
    display: SHAFT_LABEL[value] || value,
  }
}

function trait(key: string, label: string, value: string, display?: string): ProductTrait {
  return { key, label, value, display: display || value }
}

// Litery w oznaczeniach Suzuki: T — trym i podnoszenie, H — rumpel,
// R — manetka, E — rozrusznik elektryczny. Pierwsza litera to generacja.
const SUZUKI_FEATURES: Record<string, string> = {
  T: "trym elektryczny",
  H: "rumpel",
  R: "manetka",
  E: "rozruch elektryczny",
}

function describeSuzukiVersion(code: string): string {
  const features = code
    .slice(1)
    .split("")
    .map((letter) => SUZUKI_FEATURES[letter])
    .filter(Boolean)

  return features.length ? `${code} — ${features.join(", ")}` : code
}

function parseSuzuki(title: string): ParsedProduct | null {
  const match = title.match(/^Suzuki\s+DF\s?([\d.]+)\s?([A-Z]+)\s+(Czarny|Biały)$/i)
  if (!match) return null

  const [, hp, rawCode, color] = match
  const code = rawCode.toUpperCase()

  const shaft = code.endsWith("XX")
    ? "XX"
    : ["S", "L", "X"].includes(code.slice(-1))
      ? code.slice(-1)
      : ""

  const version = shaft ? code.slice(0, code.length - shaft.length) : code

  const traits: ProductTrait[] = [
    trait("wersja", "Wersja", version, describeSuzukiVersion(version)),
    trait("kolor", "Kolor", color.toLowerCase() === "biały" ? "Biały" : "Czarny"),
  ]
  if (shaft) traits.unshift(shaftTrait(shaft))

  return { family: `suzuki-df-${hp}`, traits }
}

// Mercury: [M|E] rozruch, [L|XL|XXL] kolumna, [H] rumpel, [PT] trym,
// [CT] Command Thrust. Przykład: „25 KM ELHPT FourStroke EFI".
function parseMercury(title: string): ParsedProduct | null {
  const match = title.match(
    /Mercury\s+([\d.]+)\s*KM\s+(.+?)\s+(FourStroke|ProXS|Pro XS|SeaPro|Verado|TwoStroke)/i
  )
  if (!match) return null

  const [, hp, rawCode, series] = match
  const code = rawCode.replace(/\s+/g, "").toUpperCase()

  const shape = code.match(/^(M|E)(XXL|XL|L)?(H)?(PT)?(CT)?(PK|PROKICKER)?$/)
  if (!shape) {
    return {
      family: `mercury-${hp}-${series.toLowerCase().replace(/\s+/g, "")}`,
      traits: [trait("wersja", "Wersja", code)],
    }
  }

  const [, start, shaft, tiller, powerTrim, commandThrust] = shape

  const features = [
    start === "E" ? "rozruch elektryczny" : "rozruch ręczny",
    tiller ? "rumpel" : "manetka",
    powerTrim ? "trym elektryczny" : "",
    commandThrust ? "Command Thrust" : "",
  ].filter(Boolean)

  // Kolumna jest osobną cechą, więc z kodu wersji ją usuwamy —
  // inaczej „E" i „EL" wyglądałyby na dwie różne wersje tego samego silnika.
  const version = [start, tiller, powerTrim, commandThrust].filter(Boolean).join("")

  const traits: ProductTrait[] = [
    shaftTrait(shaft === "XXL" ? "XX" : shaft === "XL" ? "X" : shaft === "L" ? "L" : "S"),
    trait("wersja", "Wersja", version, `${version} — ${features.join(", ")}`),
  ]

  return {
    family: `mercury-${hp}-${series.toLowerCase().replace(/\s+/g, "")}`,
    traits,
  }
}

// Torqeedo: końcówka TS/TL/RS/RL to sterowanie + kolumna,
// samo S/L to kolumna (Travel XP S / Travel XP L).
function parseTorqeedo(title: string): ParsedProduct | null {
  if (!/Torqeedo/i.test(title)) return null

  const name = title.replace(/^Silnik zaburtowy elektryczny\s+/i, "").trim()
  const match = name.match(/^Torqeedo\s+(.+?)\s+(TS|TL|RS|RL|S|L|UL)$/)
  if (!match) return null

  const [, model, suffix] = match
  const family = `torqeedo-${model.toLowerCase().replace(/\s+/g, "-")}`

  if (suffix === "UL") {
    return { family, traits: [shaftTrait("UL")] }
  }

  if (suffix.length === 2) {
    return {
      family,
      traits: [
        trait(
          "sterowanie",
          "Sterowanie",
          suffix[0] === "T" ? "rumpel" : "manetka",
          suffix[0] === "T" ? "Rumpel" : "Manetka"
        ),
        shaftTrait(suffix[1]),
      ],
    }
  }

  return { family, traits: [shaftTrait(suffix)] }
}

// Garmin GPSMAP: w czterocyfrowych numerach z serii 84xx/90xx dwie pierwsze
// cyfry to seria, a dwie ostatnie przekątna. W pozostałych odwrotnie:
// 723xsv to 7 cali z serii 23.
function parseGpsmap(title: string): ParsedProduct | null {
  const match = title.match(/GPSMAP\s+(\d{3,4})([a-z]*)/i)
  if (!match) return null

  const [, digits, suffix] = match
  const seriesFirst = digits.length === 4 && /^[89]/.test(digits)

  const series = seriesFirst ? digits.slice(0, 2) : digits.slice(-2)
  const size = seriesFirst ? digits.slice(2) : digits.slice(0, digits.length - 2)

  return {
    family: `gpsmap-${series}${suffix.toLowerCase()}`,
    traits: [trait("ekran", "Przekątna ekranu", size, `${size}″`)],
  }
}

// ECHOMAP: przekątna jest w tytule wprost, a przetwornik bywa w zestawie.
function parseEchomap(title: string): ParsedProduct | null {
  if (!/ECHOMAP/i.test(title)) return null

  const size = title.match(/(\d{1,2})\s*(?:″|"|''|”|’’)/)
  const model = title.match(/ECHOMAP\s+(.+?)(?:\s+(?:z przetwornikiem|bez przetwornika).*)?$/i)
  if (!size || !model) return null

  // z „Ultra 2 122sv" zostaje „Ultra 2" — numer modelu niesie tylko przekątną
  const line = model[1].replace(/\b\d{2,3}[a-z]{0,3}\b/gi, "").replace(/\s+/g, " ").trim()

  const traits: ProductTrait[] = [
    trait("ekran", "Przekątna ekranu", size[1], `${size[1]}″`),
  ]

  if (/z przetwornikiem/i.test(title)) {
    traits.push(trait("przetwornik", "Przetwornik", "tak", "Z przetwornikiem"))
  } else if (/bez przetwornika/i.test(title)) {
    traits.push(trait("przetwornik", "Przetwornik", "nie", "Bez przetwornika"))
  }

  return { family: `echomap-${line.toLowerCase().replace(/\s+/g, "-") || "seria"}`, traits }
}

const PARSERS = [parseSuzuki, parseMercury, parseTorqeedo, parseGpsmap, parseEchomap]

export function parseProduct(title: string): ParsedProduct | null {
  for (const parser of PARSERS) {
    const parsed = parser(title)
    if (parsed && parsed.traits.length) return parsed
  }
  return null
}

export type FamilyChoice = {
  value: string
  display: string
  handle: string
  current: boolean
}

export type FamilySelector = {
  key: string
  label: string
  choices: FamilyChoice[]
}

type FamilyInput = { handle: string; title: string }

/**
 * Buduje wybory „jak rozmiar koszulki": dla każdej cechy pokazuje dostępne
 * wartości w rodzinie i link do produktu, który różni się tylko tą cechą.
 */
export function buildFamilySelectors(
  product: FamilyInput,
  candidates: FamilyInput[]
): FamilySelector[] {
  const current = parseProduct(product.title)
  if (!current) return []

  const siblings = candidates
    .map((item) => ({ item, parsed: parseProduct(item.title) }))
    .filter(
      (entry): entry is { item: FamilyInput; parsed: ParsedProduct } =>
        Boolean(entry.parsed && entry.parsed.family === current.family)
    )

  const selectors: FamilySelector[] = []

  for (const own of current.traits) {
    const byValue = new Map<string, { display: string; handle: string; score: number }>()

    for (const sibling of siblings) {
      const value = sibling.parsed.traits.find((item) => item.key === own.key)
      if (!value) continue

      // im więcej pozostałych cech się zgadza, tym lepszy kandydat na link
      const score = sibling.parsed.traits.filter(
        (item) =>
          item.key !== own.key &&
          current.traits.some((mine) => mine.key === item.key && mine.value === item.value)
      ).length

      const existing = byValue.get(value.value)
      if (!existing || score > existing.score) {
        byValue.set(value.value, {
          display: value.display,
          handle: sibling.item.handle,
          score,
        })
      }
    }

    if (byValue.size < 2) continue

    selectors.push({
      key: own.key,
      label: own.label,
      choices: [...byValue.entries()]
        .map(([value, entry]) => ({
          value,
          display: entry.display,
          handle: entry.handle,
          current: value === own.value,
        }))
        .sort((a, b) => a.value.localeCompare(b.value, "pl", { numeric: true })),
    })
  }

  return selectors
}
