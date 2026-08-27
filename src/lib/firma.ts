// Dane firmy po numerze NIP.
//
// Źródłem jest **wykaz podatników VAT Ministerstwa Finansów** („biała lista"),
// a nie API GUS: BIR1 z GUS wymaga klucza wydawanego na wniosek, a wykaz MF
// jest otwarty i zwraca to, czego potrzebujemy przy zamówieniu — nazwę firmy,
// adres siedziby i status VAT. Dane pochodzą z tych samych rejestrów.
//
// Adres przychodzi jednym ciągiem: „ARKADIUSZA RYBICKIEGO 4B/U1, 81-340 GDYNIA".
// Rozbijamy go na ulicę, kod i miasto, bo formularz ma trzy osobne pola.

export type Firma = {
  name: string
  street: string
  postalCode: string
  city: string
  /** „Czynny", „Zwolniony" albo puste, gdy firmy nie ma w wykazie. */
  vatStatus: string
}

const WYKAZ = "https://wl-api.mf.gov.pl/api/search/nip"

/** Same cyfry — klient wpisze „586-235-53-76" albo „PL5862355376". */
export function normalizeNip(value: string): string {
  const digits = String(value || "").replace(/\D/g, "")
  return digits.length === 10 ? digits : ""
}

/**
 * Suma kontrolna NIP-u. Sprawdzamy ją u siebie, żeby literówki nie leciały
 * do rejestru — a przy okazji od razu wiadomo, że numer jest nie ten.
 */
export function isValidNip(nip: string): boolean {
  const digits = normalizeNip(nip)
  if (!digits) return false

  const wagi = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const suma = wagi.reduce((total, waga, index) => total + waga * Number(digits[index]), 0)
  const kontrolna = suma % 11

  return kontrolna !== 10 && kontrolna === Number(digits[9])
}

/** „ARKADIUSZA RYBICKIEGO 4B/U1, 81-340 GDYNIA" → ulica + kod + miasto. */
export function splitAddress(value: string): { street: string; postalCode: string; city: string } {
  const raw = String(value || "").trim()
  if (!raw) return { street: "", postalCode: "", city: "" }

  // Ostatni przecinek oddziela adres od „kod miasto" — nazwa ulicy sama
  // przecinka nie ma, a numer lokalu bywa zapisany przez ukośnik.
  const cut = raw.lastIndexOf(",")
  const street = cut > 0 ? raw.slice(0, cut).trim() : raw
  const rest = cut > 0 ? raw.slice(cut + 1).trim() : ""

  const match = rest.match(/^(\d{2}-\d{3})\s+(.+)$/)
  if (!match) return { street, postalCode: "", city: rest }

  return { street, postalCode: match[1], city: match[2].trim() }
}

/** Dzisiejsza data w formacie, którego oczekuje wykaz (`YYYY-MM-DD`, czas UE). */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function lookupCompany(nip: string): Promise<Firma | null> {
  const digits = normalizeNip(nip)
  if (!digits) return null

  const response = await fetch(`${WYKAZ}/${digits}?date=${today()}`, { cache: "no-store" })
  if (!response.ok) throw new Error(`wykaz_mf_${response.status}`)

  const subject = (await response.json())?.result?.subject
  if (!subject?.name) return null

  const address = splitAddress(subject.workingAddress || subject.residenceAddress || "")

  return {
    name: String(subject.name).trim(),
    ...address,
    vatStatus: String(subject.statusVat || ""),
  }
}
