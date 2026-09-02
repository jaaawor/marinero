// Sztywne pary produkt ↔ oferta na Allegro.
//
// Bez tego pliku każde wejście w zakładkę Cen **liczyło pary od nowa**: po
// sygnaturze, a gdy nie pasowała — po EAN-ie i na luźno. Dopóki wszystko się
// zgadza, jest to niewidoczne, ale człowiek nie ma jak tego sprawdzić inaczej
// niż przejrzeniem czterystu wierszy po każdym odświeżeniu. Sprzedawca ma
// prawo raz powiedzieć „to jest ta oferta" i więcej do tego nie wracać.
//
// Para zapisana tutaj **wygrywa ze wszystkim** — także z dokładnym SKU.
// Zdejmuje się ją ręcznie („odepnij"), nigdy sama z siebie: zniknięcie oferty
// z Allegro to powód do ostrzeżenia, a nie do cichego szukania nowej.
//
// Trzymamy to w `panel_ustawienia`, nie w metadanych produktu: pary czytamy
// przy każdym zestawieniu, a to jeden odczyt Directusa zamiast czterystu
// zapisów do Medusy przy pierwszym przypięciu.

import { pobierzUstawienie, zapiszUstawienie } from "@/lib/panel-ustawienia"

const KLUCZ = "allegro-pary"

export type Para = {
  /** Identyfikator oferty na Allegro. */
  oferta: string
  /** Kiedy przypięto (ISO) — po to, żeby dało się dojść, skąd się wzięła. */
  kiedy: string
  /** Kto przypiął; puste przy parach z czasów sprzed logowania po imieniu. */
  kto?: string
}

/** Klucz to `wariantId` — cena i SKU należą w Medusie do wariantu, nie produktu. */
export type Pary = Record<string, Para>

export async function pobierzPary(): Promise<Pary> {
  const zapis = (await pobierzUstawienie<Pary>(KLUCZ)) || {}
  const czyste: Pary = {}

  for (const [wariantId, para] of Object.entries(zapis)) {
    const oferta = String((para as Para)?.oferta || "").trim()
    if (!wariantId || !oferta) continue
    czyste[wariantId] = {
      oferta,
      kiedy: String((para as Para)?.kiedy || ""),
      kto: String((para as Para)?.kto || "") || undefined,
    }
  }

  return czyste
}

/**
 * Przypięcie pary. Jedna oferta może stać przy **jednym** produkcie: gdyby
 * dwa wiersze wskazywały tę samą aukcję, oba dostałyby tę samą cenę i stan,
 * a zapis z drugiego nadpisywałby zapis z pierwszego. Dlatego wcześniejsze
 * przypięcie tej oferty gdzie indziej po prostu znika.
 */
export async function przypnij(
  wariantId: string,
  ofertaId: string,
  kto = ""
): Promise<boolean> {
  const pary = await pobierzPary()

  for (const [klucz, para] of Object.entries(pary)) {
    if (para.oferta === ofertaId && klucz !== wariantId) delete pary[klucz]
  }

  pary[wariantId] = { oferta: ofertaId, kiedy: new Date().toISOString(), kto: kto || undefined }
  return zapiszUstawienie(KLUCZ, pary)
}

/** Odpięcie — wiersz wraca do parowania po sygnaturze. */
export async function odepnij(wariantId: string): Promise<boolean> {
  const pary = await pobierzPary()
  if (!(wariantId in pary)) return true
  delete pary[wariantId]
  return zapiszUstawienie(KLUCZ, pary)
}
