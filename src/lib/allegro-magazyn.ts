import { pobierzUstawienie, zapiszUstawienie } from "@/lib/panel-ustawienia"
import type { AllegroZamowienie } from "@/lib/allegro"

/**
 * Migawka zamówień z Allegro, odświeżana **w tle**.
 *
 * Panel czyta zamówienia na żywo za każdym wejściem i tak zostaje — świeże
 * dane są warte tych dwóch sekund. Migawka odpowiada na inne pytanie:
 * **co przyszło nowego, odkąd ostatnio patrzyłem**. Bez niej sprzedawca musiał
 * pamiętać, co widział wczoraj; teraz nowe pozycje są podpisane, a data
 * ostatniego pobrania mówi wprost, czy automat w ogóle działa.
 *
 * Siedzi w `panel_ustawienia` (klucz → JSON), tak samo jak reguły cen
 * i przypisania modułów — nie zakładamy osobnej kolekcji na jedną listę.
 */

const KLUCZ = "allegro-zamowienia"

export type Migawka = {
  /** Kiedy automat ostatnio pobrał listę (ISO). */
  kiedy: string
  /** Identyfikatory wszystkich zamówień z ostatniego przebiegu. */
  wszystkie: string[]
  /** Te, których nie było w poprzednim przebiegu — czyli świeże. */
  nowe: string[]
  /** Ile zamówień naliczył ostatni przebieg. */
  ile: number
}

export async function pobierzMigawke(): Promise<Migawka | null> {
  return pobierzUstawienie<Migawka>(KLUCZ)
}

/**
 * Zapisuje nową migawkę i zwraca to, co w niej przybyło.
 *
 * **Pierwszy przebieg nie oznacza niczego jako nowe.** Gdyby oznaczał, po
 * wdrożeniu cała historia zapaliłaby się jako „nowe" i znacznik nie znaczyłby
 * nic — a od tego momentu nikt by na niego nie patrzył.
 */
export async function zapiszMigawke(zamowienia: AllegroZamowienie[]): Promise<Migawka> {
  const poprzednia = await pobierzMigawke()
  const wszystkie = zamowienia.map((z) => z.id)

  const znane = new Set(poprzednia?.wszystkie || [])
  const nowe = poprzednia ? wszystkie.filter((id) => !znane.has(id)) : []

  const migawka: Migawka = {
    kiedy: new Date().toISOString(),
    wszystkie,
    nowe,
    ile: wszystkie.length,
  }

  await zapiszUstawienie(KLUCZ, migawka)
  return migawka
}
