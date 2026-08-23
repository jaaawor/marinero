import { readSpreadsheet } from "@/lib/xlsx-read"
import type { SheetData } from "@/lib/xlsx-parse"

const MAX_BYTES = 8 * 1024 * 1024
const MAX_ROWS = 20_000
const MAX_COLUMNS = 60

export type ParsedRequest = {
  sheets: SheetData[]
  filename: string
  sheetIndex: number
  /** Dodatkowe pola formularza (np. `slug` przy cenniku jednej łodzi). */
  extra: Record<string, string>
}

/**
 * Narzędzie przyjmuje cennik na dwa sposoby:
 *
 * 1. jako gotowe wiersze w JSON-ie — przeglądarka rozbiera plik u siebie
 *    i wysyła sam tekst. To domyślna droga, bo nginx przepuszcza tylko 1 MB
 *    i większy plik kończył się HTML-owym błędem 413;
 * 2. jako plik (multipart) — zapas dla przeglądarek bez `DecompressionStream`.
 */
export async function readRequest(request: Request): Promise<ParsedRequest> {
  const type = request.headers.get("content-type") || ""

  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null)
    // Puste arkusze to poprawny stan: tak wygląda samo wskazanie łodzi,
    // bez pliku. O tym, czy to błąd, decyduje endpoint.
    const sheets = normalizeSheets(body?.arkusze)

    return {
      sheets,
      filename: String(body?.nazwa || "cennik"),
      sheetIndex: Number(body?.arkusz) || 0,
      extra: normalizeExtra(body),
    }
  }

  const form = await request.formData().catch(() => null)
  if (!form) throw new Error("Nie udało się odczytać przesłanych danych")

  const extra: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") extra[key] = value
  }

  const file = form.get("plik") as File | null
  if (!file || !file.size) {
    return { sheets: [], filename: "", sheetIndex: Number(form.get("arkusz")) || 0, extra }
  }
  if (file.size > MAX_BYTES) throw new Error("Plik jest większy niż 8 MB")

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    return {
      sheets: readSpreadsheet(buffer, file.name),
      filename: file.name,
      sheetIndex: Number(form.get("arkusz")) || 0,
      extra,
    }
  } catch (error: any) {
    throw new Error(
      `Nie umiem odczytać tego pliku (${error?.message || "nieznany format"}). Zapisz go jako .xlsx albo .csv.`
    )
  }
}

function normalizeExtra(body: any): Record<string, string> {
  const extra: Record<string, string> = {}
  for (const key of ["slug", "nazwa"]) {
    if (typeof body?.[key] === "string") extra[key] = body[key]
  }
  return extra
}

/** Ufamy przeglądarce co do treści, ale nie co do rozmiaru ani kształtu. */
function normalizeSheets(input: any): SheetData[] {
  if (!Array.isArray(input)) return []

  return input.slice(0, 20).map((sheet: any, index: number) => ({
    name: String(sheet?.name || `Arkusz ${index + 1}`).slice(0, 80),
    rows: (Array.isArray(sheet?.rows) ? sheet.rows : [])
      .slice(0, MAX_ROWS)
      .map((row: any) =>
        (Array.isArray(row) ? row : [])
          .slice(0, MAX_COLUMNS)
          .map((cell: any) => String(cell ?? "").slice(0, 400))
      ),
  }))
}
