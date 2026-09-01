// Ustawienia narzędzi wewnętrznych, zapisywane bez wdrożenia.
//
// Reguły cen na Allegro siedziały dotąd w `channel-pricing.ts`, czyli zmiana
// narzutu z 9 na 10 procent oznaczała commit, build i pięć minut czekania.
// Teraz żyją w Directusie (kolekcja `panel_ustawienia`, klucz → JSON),
// a plik w repozytorium zostaje **zapasem** — tak samo jak przy konfiguratorach
// i wyposażeniu standardowym: gdy Directus nie odpowie, panel liczy po staremu
// zamiast pokazać pustkę.
//
// Kolekcja **nie ma publicznego odczytu**: front pyta Directusa bez tokenu,
// a narzuty handlowe nie są niczyją sprawą poza naszą.

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const KOLEKCJA = "panel_ustawienia"

function tokenDirectusa(): string {
  return process.env.DIRECTUS_ADMIN_TOKEN || ""
}

// Odczyt idzie przy każdym wejściu do panelu i przy każdym eksporcie, więc
// trzymamy wynik przez chwilę — ta sama zasada co przy konfiguratorach.
const WAZNOSC_MS = 60_000
const zapamietane = new Map<string, { kiedy: number; dane: unknown }>()

/** Ustawienie spod klucza albo `null`, gdy go nie ma (albo Directus milczy). */
export async function pobierzUstawienie<T>(klucz: string): Promise<T | null> {
  const zapis = zapamietane.get(klucz)
  if (zapis && Date.now() - zapis.kiedy < WAZNOSC_MS) return zapis.dane as T | null

  const token = tokenDirectusa()
  if (!token) return null

  try {
    const odpowiedz = await fetch(`${DIRECTUS}/items/${KOLEKCJA}/${encodeURIComponent(klucz)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })

    // Brak wpisu to nie awaria — znaczy „jeszcze nikt nic nie ustawił".
    if (!odpowiedz.ok) {
      zapamietane.set(klucz, { kiedy: Date.now(), dane: null })
      return null
    }

    const surowa = (await odpowiedz.json())?.data?.wartosc
    const dane = typeof surowa === "string" && surowa.trim() ? JSON.parse(surowa) : null

    zapamietane.set(klucz, { kiedy: Date.now(), dane })
    return dane as T | null
  } catch {
    // Directus nie odpowiada albo zapisany JSON jest uszkodzony — wołający
    // ma wtedy sięgnąć po wartość zapasową z repozytorium.
    return null
  }
}

/** Zapisuje ustawienie. `false` znaczy „nie zapisano" — panel ma to pokazać. */
export async function zapiszUstawienie(klucz: string, dane: unknown): Promise<boolean> {
  const token = tokenDirectusa()
  if (!token) return false

  const wartosc = JSON.stringify(dane)
  const naglowki = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  try {
    const zmieniony = await fetch(`${DIRECTUS}/items/${KOLEKCJA}/${encodeURIComponent(klucz)}`, {
      method: "PATCH",
      headers: naglowki,
      body: JSON.stringify({ wartosc }),
      cache: "no-store",
    })

    // Wpisu jeszcze nie ma — zakładamy go.
    const ok = zmieniony.ok
      ? true
      : (
          await fetch(`${DIRECTUS}/items/${KOLEKCJA}`, {
            method: "POST",
            headers: naglowki,
            body: JSON.stringify({ klucz, wartosc }),
            cache: "no-store",
          })
        ).ok

    // Kasujemy pamięć dopiero po zapisie: inaczej nieudany zapis kazałby
    // pobierać od nowa to samo, co już mamy.
    if (ok) zapamietane.delete(klucz)
    return ok
  } catch {
    return false
  }
}
