// EAN-y ofert z Allegro, zapamiętane u nas.
//
// Lista ofert (`/sale/offers`) nie niesie EAN-u — trzeba o niego zapytać
// osobno, po jednej ofercie. Przy dwustu ofertach to dwieście żądań, czyli
// nie do zrobienia przy każdym wejściu w zakładkę Cen. Dlatego pytamy
// **raz na ofertę** i zapisujemy wynik w `panel_ustawienia`; kolejne wejścia
// czytają go z zapisu, a dopytujemy tylko o oferty jeszcze nieznane, po
// garstce na raz.
//
// Pusty EAN też zapisujemy — oferta, przy której producent go nie podał, nie
// może być pytana o to samo w kółko przy każdym odświeżeniu.

import { offerEan, type AllegroConfig } from "@/lib/allegro"
import { pobierzUstawienie, zapiszUstawienie } from "@/lib/panel-ustawienia"

const KLUCZ = "allegro-ean"

/**
 * Ile ofert dopytujemy w jednym przebiegu. Każde pytanie to osobne żądanie do
 * Allegro, a zakładka ma się otworzyć w kilka sekund, nie w minutę — reszta
 * dociągnie się przy kolejnych wejściach i po kilku będzie komplet.
 */
const NA_PRZEBIEG = 40

export type ZapisEan = Record<string, { ean: string; kiedy: string }>

export async function pobierzEany(): Promise<ZapisEan> {
  return (await pobierzUstawienie<ZapisEan>(KLUCZ)) || {}
}

/**
 * Uzupełnia zapis o oferty, których jeszcze w nim nie ma, i oddaje mapę
 * `id oferty → EAN` (bez pustych). `chetne` to oferty, przy których EAN jest
 * nam do czegoś potrzebny — pytamy w podanej kolejności, więc na początek
 * idą te bez pary.
 *
 * Nieudane pytanie nie przerywa niczego: zapisu wtedy nie robimy, żeby oferta
 * trafiła pod dopytanie przy następnym wejściu.
 */
export async function uzupelnijEany(
  config: AllegroConfig,
  chetne: string[]
): Promise<{ mapa: Map<string, string>; znane: number; dopytane: number }> {
  const zapis = await pobierzEany().catch(() => ({}) as ZapisEan)

  // Ta sama oferta bywa w liście dwa razy (raz jako pilna, raz jako reszta),
  // a dwukrotne pytanie o nią zmarnowałoby miejsce w przebiegu.
  const brakujace = [...new Set(chetne)].filter((id) => !(id in zapis)).slice(0, NA_PRZEBIEG)
  let dopytane = 0

  for (const id of brakujace) {
    try {
      const ean = await offerEan(config, id)
      zapis[id] = { ean, kiedy: new Date().toISOString() }
      dopytane++
    } catch {
      // Zostawiamy na następny raz — brak wpisu znaczy „jeszcze nie pytaliśmy".
    }
  }

  if (dopytane) await zapiszUstawienie(KLUCZ, zapis).catch(() => false)

  const mapa = new Map<string, string>()
  for (const [id, wpis] of Object.entries(zapis)) {
    if (wpis?.ean) mapa.set(id, wpis.ean)
  }

  return { mapa, znane: Object.keys(zapis).length, dopytane }
}
