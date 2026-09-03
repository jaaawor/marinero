// Dostęp do konfiguratora po podaniu kontaktu — podpisywanie i czytanie biletu.
//
// Przy łodziach za kilkaset tysięcy dolarów konfigurator jest **narzędziem
// handlowym**, nie tylko treścią: kto go wypełnia, ten kupuje w tym roku albo
// w następnym. Dlatego przy wybranych łodziach (`configurators.wymaga_kontaktu`,
// włączone przy Aquilach) kalkulator otwiera się dopiero po podaniu imienia
// i adresu — a my wiemy, kto wrócił i co klikał.
//
// **Bilet jest podpisany po stronie serwera.** Sam znacznik w przeglądarce
// dałoby się dopisać w konsoli w dziesięć sekund, a wtedy „bramka" byłaby
// dekoracją, która nie zbiera kontaktów, tylko drażni ludzi.
//
// Plik jest **wolny od sieci** — samo liczenie i format biletu.

import { createHmac, timingSafeEqual } from "node:crypto"

export const CIASTECZKO_DOSTEPU = "marinero_konfigurator"

/**
 * Rok. Kto raz zostawił kontakt, nie ma go zostawiać przy każdej wizycie —
 * człowiek dobierający łódź wraca do konfiguratora tygodniami, czasem
 * miesiącami, i formularz przy każdym wejściu czytałby się jak zarzut, że
 * poprzedni raz się nie liczył.
 */
export const WAZNOSC_SEKUNDY = 365 * 24 * 60 * 60

/**
 * Klucz do podpisu. Bierzemy ten, który i tak musi być na serwerze — bramka
 * bez `DIRECTUS_ADMIN_TOKEN` nie ma gdzie zapisać kontaktu, więc nowa zmienna
 * środowiskowa byłaby kolejną rzeczą do zapomnienia przy wdrożeniu.
 */
function klucz(): string {
  return process.env.STATYSTYKI_SOL || process.env.DIRECTUS_ADMIN_TOKEN || ""
}

export type Bilet = {
  /** Adres e-mail, na który wydano dostęp — po nim sklejamy wizyty w jedną osobę. */
  email: string
  /** Imię, żeby przy powrocie przywitać po imieniu zamiast pytać drugi raz. */
  imie: string
  /** Kiedy wydany (sekundy uniksowe). */
  kiedy: number
}

function podpis(tresc: string): string {
  return createHmac("sha256", klucz()).update(tresc).digest("base64url")
}

/** Bilet do ciasteczka: treść w base64url plus podpis, oddzielone kropką. */
export function zapiszBilet(bilet: Bilet): string {
  const tresc = Buffer.from(JSON.stringify(bilet), "utf8").toString("base64url")
  return `${tresc}.${podpis(tresc)}`
}

/**
 * Bilet z ciasteczka albo `null`. Odrzucamy wszystko, co nie zgadza się co do
 * bajta: zły podpis, przeterminowany, niezdatny do odczytu.
 */
export function czytajBilet(wartosc: string | undefined): Bilet | null {
  if (!wartosc || !klucz()) return null

  const [tresc, dany] = wartosc.split(".")
  if (!tresc || !dany) return null

  // Porównanie stałoczasowe — inaczej czas odpowiedzi zdradzałby, ile
  // pierwszych znaków podpisu zgadło się przy próbie podrobienia.
  const nasz = Buffer.from(podpis(tresc))
  const ich = Buffer.from(dany)
  if (nasz.length !== ich.length || !timingSafeEqual(nasz, ich)) return null

  try {
    const bilet = JSON.parse(Buffer.from(tresc, "base64url").toString("utf8")) as Bilet
    if (!bilet?.email) return null

    const wiek = Math.floor(Date.now() / 1000) - Number(bilet.kiedy || 0)
    if (wiek < 0 || wiek > WAZNOSC_SEKUNDY) return null

    return bilet
  } catch {
    return null
  }
}

/**
 * Adres wygląda na adres. Nie sprawdzamy, czy istnieje — od tego jest
 * pierwszy list, a nie wyrażenie regularne, które przy okazji odrzuca połowę
 * poprawnych domen.
 */
export function poprawnyEmail(wartosc: string): boolean {
  const email = wartosc.trim()
  return email.length >= 6 && email.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}
