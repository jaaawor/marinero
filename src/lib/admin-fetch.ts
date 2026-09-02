"use client"

import { canReadInBrowser, readSpreadsheetInBrowser } from "@/lib/xlsx-browser"

/**
 * Odpowiedź narzędzia admina. Serwery pośredniczące (nginx) potrafią oddać
 * HTML zamiast JSON-a — wtedy `response.json()` wywalał się komunikatem
 * „Unexpected token '<'", z którego nikt niczego nie wyczytał.
 */
export async function readJson(response: Response): Promise<any> {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    if (response.status === 413) {
      throw new Error(
        "Serwer odrzucił plik jako za duży. Spróbuj ponownie — nowa wersja narzędzia " +
          "czyta plik w przeglądarce i nie wysyła go w całości."
      )
    }

    if (RESTART.has(response.status)) {
      throw new Error(WYJASNIENIE_RESTARTU)
    }

    throw new Error(
      `Serwer odpowiedział czymś, co nie jest odpowiedzią narzędzia (HTTP ${response.status}). ` +
        "Odśwież stronę i spróbuj jeszcze raz."
    )
  }
}

/**
 * Kody, które nginx oddaje, gdy **nie dostał się do aplikacji**.
 *
 * 502 przy marinero.pl prawie zawsze znaczy jedno: właśnie wchodzi nowa wersja
 * strony. Wdrożenie zatrzymuje usługę, podmienia katalog builda i uruchamia ją
 * z powrotem, a Next potrzebuje kilku sekund na start — przez ten czas nginx
 * nie ma z czym rozmawiać i oddaje surową stronę „502 Bad Gateway". To nie
 * jest awaria, tylko okno przerwy, i wygląda tak samo jak zepsuty panel.
 */
const RESTART = new Set([502, 503, 504])

const WYJASNIENIE_RESTARTU =
  "Serwer właśnie się restartuje — zwykle wchodzi nowa wersja strony i trwa to " +
  "kilkanaście sekund. Spróbuj za chwilę."

/**
 * Pobranie, które **przeczeka restart**.
 *
 * Odczyt wolno ponowić: nic nie zapisuje, więc drugie podejście nie może
 * niczego zdublować. **Zapisów tak nie wołamy** — 502 potrafi wrócić także
 * wtedy, gdy aplikacja żądanie przyjęła i wykonała, a połączenie zerwało się
 * dopiero przy odpowiedzi; powtórzenie zapisałoby tę samą rzecz drugi raz.
 */
export async function pobierzZPonowieniem(
  url: string,
  init: RequestInit = {},
  { podejscia = 3, przerwaMs = 4000 }: { podejscia?: number; przerwaMs?: number } = {}
): Promise<Response> {
  let ostatni: unknown = null

  for (let podejscie = 1; podejscie <= podejscia; podejscie++) {
    try {
      const odpowiedz = await fetch(url, init)
      if (!RESTART.has(odpowiedz.status) || podejscie === podejscia) return odpowiedz
    } catch (problem) {
      // Przerwane przez nas (nowe pobranie, wyjście ze strony) — nie ponawiamy.
      if (init.signal?.aborted) throw problem
      ostatni = problem
      if (podejscie === podejscia) throw problem
    }

    await new Promise((gotowe) => setTimeout(gotowe, przerwaMs))
    if (init.signal?.aborted) throw ostatni ?? new Error("Przerwano")
  }

  throw new Error(WYJASNIENIE_RESTARTU)
}

/**
 * Wysyła cennik: jeśli przeglądarka umie rozpakować XLSX, robi to u siebie
 * i wysyła same wiersze. Plik idzie na serwer tylko wtedy, gdy nie umie.
 */
export async function sendSpreadsheet(
  url: string,
  file: File | null,
  extra: Record<string, string> = {},
  sheetIndex?: number
): Promise<any> {
  if (file && canReadInBrowser()) {
    const sheets = trim(await readSpreadsheetInBrowser(file))

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...extra,
        nazwa: file.name,
        arkusze: sheets,
        ...(typeof sheetIndex === "number" ? { arkusz: sheetIndex } : {}),
      }),
    })

    return finish(response)
  }

  // Bez pliku (samo wskazanie łodzi) też idzie JSON-em — jest lżejszy
  // i nie dotyka limitów na rozmiar żądania.
  if (!file) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extra, arkusze: [] }),
    })
    return finish(response)
  }

  const form = new FormData()
  form.set("plik", file)
  for (const [key, value] of Object.entries(extra)) form.set(key, value)
  if (typeof sheetIndex === "number") form.set("arkusz", String(sheetIndex))

  const response = await fetch(url, { method: "POST", body: form })
  return finish(response)
}

/**
 * Puste wiersze i puste kolumny z ogona arkusza tylko pompują żądanie —
 * Excel potrafi zapisać tysiąc pustych wierszy pod tabelą.
 */
function trim(sheets: { name: string; rows: string[][] }[]) {
  return sheets.map((sheet) => {
    const rows = sheet.rows
      .filter((row) => row.some((cell) => cell.trim()))
      .slice(0, 5000)
      .map((row) => row.slice(0, 40))

    return { name: sheet.name, rows }
  })
}

async function finish(response: Response) {
  const body = await readJson(response)
  if (!response.ok) throw new Error(body?.error || "Nie udało się odczytać pliku")
  return body
}
