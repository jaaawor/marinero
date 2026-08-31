// Refresh token Allegro — trzymany tam, gdzie da się go **zapisać**.
//
// Allegro przy każdej wymianie unieważnia stary refresh token i oddaje nowy.
// Dopóki token siedział w `.env.local`, kod nie miał jak zapisać następnego:
// pierwsze zapytanie działało, a każde kolejne dostawało `invalid_grant`.
// Integracja psuła się więc natychmiast po pierwszym użyciu, a nie po trzech
// miesiącach, jak zakładaliśmy.
//
// Token leży w kolekcji `integration_tokens` w Directusie. Kolekcja **nie ma
// publicznego odczytu** — front pyta Directusa bez tokenu i gdyby ta kolekcja
// była otwarta, klucz do konta sprzedażowego wisiałby w internecie.
// `site_settings` z tego samego powodu odpada, choć byłoby wygodniej.

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const KLUCZ = "allegro_refresh"

function tokenDirectusa(): string {
  return process.env.DIRECTUS_ADMIN_TOKEN || ""
}

/**
 * Refresh token do użycia teraz.
 *
 * Zapisany w Directusie ma pierwszeństwo. `.env.local` zostaje jako **wejście
 * na start**: po pierwszej wymianie następny token ląduje już w Directusie
 * i zmienna środowiskowa przestaje mieć znaczenie.
 */
export async function pobierzRefreshToken(): Promise<string> {
  const token = tokenDirectusa()

  if (token) {
    try {
      const odpowiedz = await fetch(`${DIRECTUS}/items/integration_tokens/${KLUCZ}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (odpowiedz.ok) {
        const zapisany = (await odpowiedz.json())?.data?.wartosc
        if (typeof zapisany === "string" && zapisany.length > 20) return zapisany
      }
    } catch {
      // Directus nie odpowiada — spróbujemy tym z pliku, zamiast się poddawać.
    }
  }

  return process.env.ALLEGRO_REFRESH_TOKEN || ""
}

/** Zapisuje token oddany przez Allegro. Bez tego następna wymiana się nie uda. */
export async function zapiszRefreshToken(nowy: string): Promise<boolean> {
  const token = tokenDirectusa()
  if (!token || !nowy) return false

  try {
    const odpowiedz = await fetch(`${DIRECTUS}/items/integration_tokens/${KLUCZ}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ wartosc: nowy }),
      cache: "no-store",
    })

    if (odpowiedz.ok) return true

    // Wpisu jeszcze nie ma — zakładamy go.
    const utworzony = await fetch(`${DIRECTUS}/items/integration_tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ klucz: KLUCZ, wartosc: nowy }),
      cache: "no-store",
    })
    return utworzony.ok
  } catch {
    return false
  }
}
