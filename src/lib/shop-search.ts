import { getAllShopProducts } from "@/lib/medusa"

// Indeks podpowiedzi dla obu wyszukiwarek sklepu: tej pod etykietami działów
// i tej w nagłówku. Szukanie jest po stronie przeglądarki, bo `q` w Store API
// dopasowuje całą frazę — „suzuki 20" nie trafiłoby w „Silnik Suzuki DF 20".

export type SearchItem = {
  title: string
  handle: string
  price: number | null
  category: string
  /** Miniatura na liście podpowiedzi — bez niej lista była ścianą tekstu. */
  thumbnail?: string
  /**
   * Kod producenta (SKU). Nie pokazujemy go na liście podpowiedzi, ale
   * **szukamy po nim**: klient z fakturą albo z instrukcją w ręku wpisuje
   * „010-02367-02", a nie „ploter nawigacyjny".
   */
  sku?: string
  /**
   * Numer katalogowy **zamiennika** — kod, pod którym producent sprzedaje
   * następcę wycofanej pozycji. Też go nie pokazujemy, ale szukamy po nim:
   * klient ma w ręku stary numer, a my mamy towar pod nowym.
   */
  zamiennik?: string
}

/** Do przeglądarki idzie tylko to, czego potrzebuje podpowiadanie. */
export async function getSearchIndex(): Promise<SearchItem[]> {
  const products = await getAllShopProducts()

  return products.map((product) => ({
    title: product.title,
    handle: product.handle,
    price: product.price,
    category: product.categories[0]?.name || "",
    thumbnail: product.thumbnail || "",
    sku: product.variants[0]?.sku || "",
    zamiennik:
      typeof product.metadata?.zamiennik === "string" ? product.metadata.zamiennik : "",
  }))
}

/** Bez polskich znaków i wielkości liter — „śruba" ma się znaleźć po „sruba". */
export function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
}

type IndexedItem = { item: SearchItem; title: string; key: string }

export function buildIndex(items: SearchItem[]): IndexedItem[] {
  return items.map((item) => ({
    item,
    title: normalizeQuery(item.title),
    key: normalizeQuery(
      `${item.title} ${item.category} ${item.sku || ""} ${item.zamiennik || ""}`
    ),
  }))
}

export function searchIndex(index: IndexedItem[], query: string, limit = 8): SearchItem[] {
  const needle = normalizeQuery(query.trim())
  if (needle.length < 2) return []

  // Wszystkie słowa zapytania muszą trafić — „suzuki 20" znajdzie DF 20.
  const words = needle.split(/\s+/)
  const hits = index.filter((entry) => words.every((word) => entry.key.includes(word)))

  // Bez punktacji „suzuki 20" wyrzucało filtry „200-350KM" przed silnik DF 20,
  // bo zwykłe `includes` nie odróżnia liczby od jej fragmentu.
  const score = (entry: IndexedItem) => {
    let value = 0
    if (entry.title.startsWith(needle)) value += 100

    for (const word of words) {
      if (new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(entry.title)) value += 40
      else if (entry.title.includes(word)) value += 10
    }

    // Przy równej trafności krótsza nazwa jest zwykle tym właściwym modelem.
    return value - entry.title.length / 100
  }

  return hits
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
    .map((entry) => entry.item)
}
