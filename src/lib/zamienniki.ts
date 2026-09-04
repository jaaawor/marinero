// Numery katalogowe zamienników przy produkcie.
//
// U nas **numer katalogowy producenta to SKU wariantu** — ten sam ciąg idzie
// na stronę produktu, do danych strukturalnych (`sku` i `mpn`) i do feedu
// Google. Zamiennik jest czymś innym: to numer, pod którym ten sam towar
// chodził wcześniej albo chodzi u innego dostawcy. Klient ma go ze starej
// faktury, z instrukcji albo z katalogu serwisowego i szuka właśnie po nim.
//
// Zamienników bywa **kilka** (Mercury lubi łańcuszki: `8M0121966` zastąpiony
// przez `8M0208465`), więc pole przyjmuje listę.

/** Ile numerów najwyżej — dłuższa lista to już nie karta produktu, tylko katalog. */
const LIMIT = 12

/**
 * Rozbija wpisaną wartość na osobne numery.
 *
 * Rozdzielamy po przecinku, średniku, ukośniku, pionowej kresce i nowej linii,
 * bo tak ludzie zapisują je z głowy — `8M0121966/8M0208465` wpisane jednym
 * ciągiem ma dać dwa numery, a nie jeden dziwny. Ukośnik jest tu świadomym
 * wyborem: w numerach części zdarza się rzadziej niż jako separator, a to on
 * stoi w danych, które już mamy.
 *
 * Powtórzenia i puste kawałki odpadają; kolejność zostaje ta, którą wpisał
 * sprzedawca — pierwszy zwykle jest najważniejszy.
 */
export function czytajZamienniki(wartosc: unknown): string[] {
  if (typeof wartosc !== "string") return []

  const widziane = new Set<string>()
  const numery: string[] = []

  for (const kawalek of wartosc.split(/[,;/|\n\r]+/)) {
    const numer = kawalek.trim()
    if (!numer) continue

    // Porównujemy bez wielkości liter i bez myślników: `8M0-208465`
    // i `8m0208465` to ten sam numer wpisany dwa razy.
    const klucz = numer.toLowerCase().replace(/[\s-]/g, "")
    if (widziane.has(klucz)) continue

    widziane.add(klucz)
    numery.push(numer)
    if (numery.length >= LIMIT) break
  }

  return numery
}
