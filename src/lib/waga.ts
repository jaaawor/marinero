// Waga produktu — jedno miejsce dla feedu do Google, panelu i strony sklepu.
//
// Merchant Center pytał o wagę przy prawie każdej pozycji, choć **mamy ją
// w Medusie**: przy migracji z WooCommerce wpisała się na wariant
// (`variants[].weight`, w gramach), a nie na produkt — i nasz feed po prostu
// jej nie czytał. Na 388 produktów ma ją 280.
//
// Reszta (drobne części zamienne, zestawy naprawcze) nie ma jej nigdzie, więc
// da się ją dopisać przy produkcie jako metadana `waga`, **w kilogramach** —
// tak, jak podaje ją kurier i jak ma ją w głowie sprzedawca. Metadana wygrywa
// z Medusą: skoro ktoś wpisał ją ręcznie, to znaczy, że tamta była zła albo
// jej nie było.
//
// Plik jest **wolny od sieci**.

type ZWaga = {
  metadata?: Record<string, unknown> | null
  variants?: { weight?: number | null }[]
}

/**
 * Waga w kilogramach albo `null`, gdy nie znamy jej z żadnego źródła.
 *
 * `null` znaczy „nie wiemy" i **nic wtedy nie wypisujemy** — zmyślona waga
 * w feedzie kończy się źle policzoną dostawą u klienta, czyli gorzej niż jej
 * brak, który jest tylko ostrzeżeniem w Merchant Center.
 */
export function wagaKg(produkt: ZWaga): number | null {
  const reczna = liczba((produkt.metadata || {}).waga)
  if (reczna !== null && reczna > 0) return reczna

  // Medusa trzyma wagę wariantu w gramach.
  const gramy = produkt.variants?.[0]?.weight
  if (typeof gramy === "number" && gramy > 0) return gramy / 1000

  return null
}

/** Zapis do feedu: „3.0 kg". Google przyjmuje kropkę dziesiętną i jednostkę. */
export function wagaDoFeedu(produkt: ZWaga): string | null {
  const kg = wagaKg(produkt)
  if (kg === null) return null

  // Bez zaokrąglenia 1000 g / 1000 potrafi wyjść jako 1.0000000000000002.
  return `${Math.round(kg * 1000) / 1000} kg`
}

function liczba(wartosc: unknown): number | null {
  if (typeof wartosc === "number") return Number.isFinite(wartosc) ? wartosc : null
  if (typeof wartosc !== "string") return null

  // Sprzedawca wpisze „1,5" tak samo chętnie jak „1.5".
  const oczyszczona = wartosc.replace(/\s/g, "").replace(",", ".")
  if (!oczyszczona) return null

  const liczbowa = Number(oczyszczona)
  return Number.isFinite(liczbowa) ? liczbowa : null
}
