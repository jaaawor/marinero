// Tłumaczenia treści redagowanych w panelach (Directus i Medusa).
//
// Słownik `i18n.ts` obsługuje interfejs — napisy, które piszemy w kodzie.
// Tu chodzi o coś innego: opisy modeli, aktualności, nazwy opcji konfiguratora,
// wyposażenie standardowe, nazwy produktów w sklepie. Tego nie da się trzymać
// w repozytorium, bo klient poprawia to w panelu.
//
// **Kluczem jest skrót polskiego tekstu, nie identyfikator rekordu.**
// Wygląda to nietypowo, ale rozwiązuje trzy rzeczy naraz:
//
//   1. Ten sam napis tłumaczy się **raz dla całego serwisu**. „Lodówka
//      szufladowa" stoi przy kilkunastu łodziach; przy kluczu po rekordzie
//      byłoby kilkanaście osobnych tłumaczeń do poprawienia.
//   2. Działa **tak samo dla Medusy**, do której nie da się dołożyć pól —
//      sklep stoi w osobnym kontenerze.
//   3. Poprawka polskiego tekstu **nie podmienia po cichu tłumaczenia**:
//      zmienia się skrót, więc wpis przestaje pasować i front pokazuje
//      oryginał, dopóki ktoś nie doda nowego tłumaczenia. Lepiej pokazać
//      polski akapit niż angielski, który mówi co innego niż polski obok.
//
// Ceną jest brak kontekstu: ten sam napis w dwóch miejscach dostanie to samo
// tłumaczenie. Przy nazwach wyposażenia i opcji to dokładnie to, czego chcemy.

import { createHash } from "node:crypto"

import { normalizeLocale, type Locale } from "@/lib/i18n"

const DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || "https://dms.marinero.150197.pl"

/** Ile trzymamy słownik w pamięci procesu, zanim spytamy Directusa ponownie. */
const CACHE_MS = 5 * 60 * 1000

/**
 * Skrót tekstu źródłowego. Białe znaki normalizujemy, bo redaktor potrafi
 * zostawić spację na końcu akapitu, a to nie jest inna treść.
 */
export function textHash(text: string): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  return createHash("md5").update(normalized, "utf8").digest("hex")
}

type Slownik = Map<string, string>

const cache = new Map<string, { at: number; data: Slownik }>()
const inFlight = new Map<string, Promise<Slownik>>()

async function pobierz(language: string): Promise<Slownik> {
  const slownik: Slownik = new Map()

  // Directus stronicuje po 100 wpisów; przy kilku tysiącach tekstów bierzemy
  // je hurtem, bo i tak trafiają do pamięci na pięć minut.
  for (let page = 1; page < 200; page++) {
    const url =
      `${DIRECTUS_URL}/items/content_translations` +
      `?fields=hash,value&limit=500&page=${page}` +
      `&filter[language][_eq]=${encodeURIComponent(language)}`

    const response = await fetch(url, { next: { revalidate: 300 } })
    if (!response.ok) break

    const rows = (await response.json())?.data || []
    for (const row of rows) {
      if (row?.hash && row?.value) slownik.set(row.hash, row.value)
    }
    if (rows.length < 500) break
  }

  return slownik
}

/**
 * Słownik dla jednego języka. Polski nie ma czego tłumaczyć — to jest język
 * źródłowy, więc zwracamy pustą mapę i nie ruszamy sieci.
 */
export async function getContentTranslations(locale: any): Promise<Slownik> {
  const language = normalizeLocale(locale)
  if (language === "pl") return new Map()

  const cached = cache.get(language)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data

  // Bez tego pierwsze wejście po wygaśnięciu cache'u odpalało tyle pobrań,
  // ile bloków renderuje się równolegle.
  const pending = inFlight.get(language)
  if (pending) return pending

  const promise = pobierz(language)
    .then((data) => {
      cache.set(language, { at: Date.now(), data })
      return data
    })
    .catch(() => cached?.data || new Map<string, string>())
    .finally(() => inFlight.delete(language))

  inFlight.set(language, promise)
  return promise
}

/** Tłumaczy jeden tekst; bez wpisu w słowniku zostaje oryginał. */
export function translate(slownik: Slownik, text: any): string {
  const raw = typeof text === "string" ? text : ""
  if (!raw.trim()) return raw

  return slownik.get(textHash(raw)) || raw
}

/**
 * Kopia obiektu z przetłumaczonymi wskazanymi polami. Pola, których nie ma
 * albo nie są tekstem, zostają bez zmian.
 */
export function translateFields<T extends Record<string, any>>(
  slownik: Slownik,
  item: T,
  fields: (keyof T)[]
): T {
  if (!slownik.size || !item) return item

  const out: Record<string, any> = { ...item }
  for (const field of fields) {
    const value = out[field as string]
    if (typeof value === "string") out[field as string] = translate(slownik, value)
  }
  return out as T
}

export function translateList<T extends Record<string, any>>(
  slownik: Slownik,
  items: T[],
  fields: (keyof T)[]
): T[] {
  if (!slownik.size) return items
  return (items || []).map((item) => translateFields(slownik, item, fields))
}

export type ContentDictionary = Slownik
export type { Locale }

/**
 * Konfigurator i wyposażenie standardowe w języku strony.
 *
 * Obie struktury są zagnieżdżone (grupa → pozycje), więc `translateList` samo
 * nie wystarczy. Typy zostawiamy luźne, bo ta warstwa nie ma powodu znać
 * kształtu konfiguratora — obchodzą ją tylko pola tekstowe.
 */
export function translateConfigurator<T extends Record<string, any>>(
  slownik: Slownik,
  config: T | null
): T | null {
  if (!config || !slownik.size) return config

  return {
    ...config,
    basePackageName: translate(slownik, config.basePackageName),
    basePriceIncludes: translate(slownik, config.basePriceIncludes),
    groups: (config.groups || []).map((group: any) => ({
      ...group,
      title: translate(slownik, group.title),
      options: (group.options || []).map((option: any) => ({
        ...option,
        name: translate(slownik, option.name),
        description: translate(slownik, option.description),
      })),
    })),
  }
}

export function translateEquipment<T extends { title: string; items: string[] }>(
  slownik: Slownik,
  groups: T[]
): T[] {
  if (!slownik.size) return groups

  return (groups || []).map((group) => ({
    ...group,
    title: translate(slownik, group.title),
    items: (group.items || []).map((item) => translate(slownik, item)),
  }))
}

/**
 * Produkty sklepu w języku strony.
 *
 * `title` **zostaje polski** — po nim rozpoznajemy moc silnika, długość
 * kolumny i rodzinę produktu, a filtry katalogu działają na tej samej nazwie.
 * Tłumaczenie ląduje w `titleDisplay`, po które sięgają komponenty rysujące
 * nazwę. Wywołuj to **po** filtrowaniu i sortowaniu.
 */
export function translateProducts<T extends Record<string, any>>(
  slownik: Slownik,
  products: T[]
): T[] {
  if (!slownik.size) return products

  return (products || []).map((product) => ({
    ...product,
    titleDisplay: translate(slownik, product.title),
    subtitle: translate(slownik, product.subtitle),
    description: translate(slownik, product.description),
  }))
}

/** Kategorie sklepu — nazwa i opis; uchwyt zostaje, bo jest w adresie. */
export function translateCategories<T extends Record<string, any>>(
  slownik: Slownik,
  categories: T[]
): T[] {
  return translateList(slownik, categories, ["name", "description"])
}
