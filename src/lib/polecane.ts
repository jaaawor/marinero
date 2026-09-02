// „Wybrane produkty" na stronie głównej sklepu.
//
// Do listopada 2026 ta sekcja rządziła się sama: brała sto najnowszych
// produktów, odsiewała te bez ceny i bez zdjęcia, sortowała po cenie malejąco
// i pokazywała pierwsze dziesięć. Wychodziło z tego „dziesięć najdroższych
// spośród ostatnio dodanych" — nikt tego nie wybierał i nie było jak wybrać.
//
// Teraz decyduje sprzedawca: znacznik przy produkcie (`polecany`) i liczba
// porządkowa (`polecany_kolejnosc`). Reguła sprzed zmiany **zostaje jako
// zapas** — gdy nikt nic nie zaznaczy, sekcja nie może stać pusta.
//
// Plik jest **wolny od sieci**: czyta go i panel, i strona sklepu.

/** Ile pozycji pokazujemy w szynie. Tyle samo co przed zmianą. */
export const ILE_POLECANYCH = 10

/** Cokolwiek, co ma metadane i cenę — pasuje i `ShopProduct`, i wiersz panelu. */
type ZMetadanymi = {
  metadata?: Record<string, unknown> | null
  price?: number | null
  thumbnail?: string | null
  title?: string
}

/**
 * Czy produkt jest wyróżniony ręcznie.
 *
 * Metadane Medusy **scalają się i nie da się skasować klucza** —
 * `{"polecany": null}` zostawia klucz z wartością `null`. Dlatego odznaczenie
 * zapisujemy jako `false`/`""` i tak samo to czytamy: liczy się wartość,
 * nie obecność klucza.
 */
export function czyPolecany(metadata: Record<string, unknown> | null | undefined): boolean {
  const wartosc = (metadata || {}).polecany
  return wartosc === true || wartosc === "1" || wartosc === "true"
}

/**
 * Liczba porządkowa. Mniejsza idzie pierwsza — jak przy zwykłej liście.
 * Brak liczby to koniec kolejki, nie początek: kto jej nie ustawił, ten nie
 * miał zdania, a nie „chciał być pierwszy".
 */
export function kolejnoscPolecanego(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  const surowa = (metadata || {}).polecany_kolejnosc
  if (surowa === null || surowa === undefined || surowa === "") return null
  const liczba = Number(surowa)
  return Number.isFinite(liczba) ? liczba : null
}

/**
 * Lista do sekcji „Wybrane produkty".
 *
 * Najpierw ręcznie wyróżnione, po kolejności. Gdy nie ma **ani jednego**,
 * wraca stara reguła — sekcja bez treści zniknęłaby ze strony głównej,
 * a to gorsze niż lista, której nikt nie ułożył.
 */
export function wybraneProdukty<T extends ZMetadanymi>(produkty: T[]): T[] {
  const wyroznione = produkty
    .filter((produkt) => czyPolecany(produkt.metadata))
    .sort((a, b) => {
      const kolejnoscA = kolejnoscPolecanego(a.metadata)
      const kolejnoscB = kolejnoscPolecanego(b.metadata)

      // Bez liczby na koniec, ale między sobą alfabetycznie — inaczej ich
      // kolejność zależałaby od tego, co akurat oddała Medusa.
      if (kolejnoscA === null && kolejnoscB === null) {
        return (a.title || "").localeCompare(b.title || "", "pl")
      }
      if (kolejnoscA === null) return 1
      if (kolejnoscB === null) return -1
      return kolejnoscA - kolejnoscB
    })

  if (wyroznione.length) return wyroznione.slice(0, ILE_POLECANYCH)

  return produkty
    .filter((produkt) => typeof produkt.price === "number" && produkt.thumbnail)
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, ILE_POLECANYCH)
}
