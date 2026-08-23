import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"
import { buildProposals, extractRows, type ModelRef } from "@/lib/pricelist"
import { readSpreadsheet } from "@/lib/xlsx-read"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 8 * 1024 * 1024

/**
 * Wgrany cennik → propozycje zmian. Ten endpoint NICZEGO nie zapisuje;
 * zapis idzie osobnym wywołaniem, po obejrzeniu tabeli przez człowieka.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let file: File | null = null
  let sheetIndex = 0

  try {
    const form = await request.formData()
    file = form.get("plik") as File | null
    sheetIndex = Number(form.get("arkusz") || 0)
  } catch {
    return NextResponse.json({ error: "Nie udało się odczytać przesłanego pliku" }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: "Wybierz plik z cennikiem" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Plik jest większy niż 8 MB" }, { status: 400 })
  }

  let sheets
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    sheets = readSpreadsheet(buffer, file.name)
  } catch (error: any) {
    return NextResponse.json(
      { error: `Nie umiem odczytać tego pliku (${error?.message || "nieznany format"}). Zapisz go jako .xlsx albo .csv.` },
      { status: 400 }
    )
  }

  if (!sheets.length) {
    return NextResponse.json({ error: "Plik nie zawiera żadnego arkusza" }, { status: 400 })
  }

  // Domyślnie bierzemy pierwszy arkusz, w którym w ogóle da się znaleźć ceny —
  // producenci lubią zaczynać plik od strony tytułowej.
  let chosen = Math.min(Math.max(0, sheetIndex), sheets.length - 1)
  let rows = extractRows(sheets[chosen].rows)

  if (!rows.length && !sheetIndex) {
    for (let index = 0; index < sheets.length; index += 1) {
      const candidate = extractRows(sheets[index].rows)
      if (candidate.length) {
        chosen = index
        rows = candidate
        break
      }
    }
  }

  const models = await loadModels(token)
  const proposals = buildProposals(rows, models)

  return NextResponse.json({
    plik: file.name,
    arkusze: sheets.map((sheet, index) => ({ index, name: sheet.name, rows: sheet.rows.length })),
    arkusz: chosen,
    modele: models.map((model) => ({
      id: model.id,
      name: model.name,
      brand: model.brand,
      basePrice: model.basePrice,
      currency: model.currency,
    })),
    pozycje: proposals,
    ...(rows.length
      ? {}
      : {
          uwaga:
            "W tym arkuszu nie znalazłem kolumny z nazwą modelu i kolumną z ceną. Wybierz inny arkusz albo zapisz cennik tak, żeby nazwy i kwoty stały w osobnych kolumnach.",
        }),
  })
}

async function loadModels(token: string): Promise<ModelRef[]> {
  const body = await directusAs(
    token,
    "/items/boat_models?limit=300&fields=id,name,slug,base_price,currency,brand.name&filter[status][_neq]=archived"
  )

  return (body?.data || []).map((item: any) => ({
    id: item.id,
    name: item.name || "",
    slug: item.slug || "",
    brand: item.brand?.name || "",
    basePrice: item.base_price === null || item.base_price === undefined ? null : Number(item.base_price),
    currency: item.currency || "",
  }))
}
