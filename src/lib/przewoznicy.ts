/**
 * Przewoźnicy i śledzenie przesyłek.
 *
 * Numer przesyłki sam z siebie nic klientowi nie daje — trzeba jeszcze
 * wiedzieć, na czyjej stronie go wpisać. Dlatego przy numerze zapisujemy
 * **przewoźnika** (`metadata.przesylka_przewoznik`) i z tego budujemy odnośnik
 * wprost do śledzenia. Bez przewoźnika pokazujemy sam numer, bez linku:
 * zgadywanie firmy po kształcie numeru kończy się odesłaniem klienta do
 * cudzej wyszukiwarki, w której jego paczki nie ma.
 *
 * Plik jest **wolny od sieci i od `next/headers`** — czyta go i panel
 * w przeglądarce, i strona konta klienta.
 */

export type Przewoznik = {
  klucz: string
  nazwa: string
  /** Adres śledzenia; `null` = firma bez publicznej wyszukiwarki u nas. */
  sledzenie: ((numer: string) => string) | null
}

export const PRZEWOZNICY: Przewoznik[] = [
  {
    klucz: "inpost",
    nazwa: "InPost",
    sledzenie: (n) => `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(n)}`,
  },
  {
    klucz: "dpd",
    nazwa: "DPD",
    sledzenie: (n) => `https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(n)}`,
  },
  {
    klucz: "dhl",
    nazwa: "DHL",
    sledzenie: (n) =>
      `https://www.dhl.com/pl-pl/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encodeURIComponent(n)}`,
  },
  {
    klucz: "gls",
    nazwa: "GLS",
    sledzenie: (n) => `https://gls-group.com/PL/pl/sledzenie-paczki?match=${encodeURIComponent(n)}`,
  },
  {
    klucz: "ups",
    nazwa: "UPS",
    sledzenie: (n) => `https://www.ups.com/track?loc=pl_PL&tracknum=${encodeURIComponent(n)}`,
  },
  {
    klucz: "fedex",
    nazwa: "FedEx",
    sledzenie: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  },
  {
    klucz: "poczta",
    nazwa: "Poczta Polska",
    sledzenie: (n) => `https://emonitoring.poczta-polska.pl/?numer=${encodeURIComponent(n)}`,
  },
  { klucz: "inny", nazwa: "Inny przewoźnik", sledzenie: null },
]

export function przewoznik(klucz: string): Przewoznik | null {
  return PRZEWOZNICY.find((p) => p.klucz === klucz) || null
}

export function nazwaPrzewoznika(klucz: string): string {
  return przewoznik(klucz)?.nazwa || ""
}

/** Adres śledzenia albo `null`, gdy nie znamy przewoźnika. */
export function linkSledzenia(klucz: string, numer: string): string | null {
  const firma = przewoznik(klucz)
  if (!firma?.sledzenie || !numer.trim()) return null
  return firma.sledzenie(numer.trim())
}
