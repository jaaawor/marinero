import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"
import { buildProposals, extractRows, type ModelRef } from "@/lib/pricelist"
import { readSpreadsheet } from "@/lib/xlsx-read"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 8 * 1024 * 1024
const OPTION_MIN_PRICE = 200

/** Lista łodzi, które mają konfigurator — do wyboru w narzędziu. */
export async function GET() {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  const body = await directusAs(
    token,
    "/items/configurators?limit=200&sort=slug&fields=slug,currency,base_price,boat_model.name"
  )

  return NextResponse.json({
    lodzie: (body?.data || []).map((item: any) => ({
      slug: item.slug,
      name: item.boat_model?.name || item.slug,
      currency: item.currency,
      basePrice: Number(item.base_price) || 0,
    })),
  })
}

/**
 * Cennik JEDNEJ łodzi: wgrany plik dopasowujemy do opcji jej konfiguratora,
 * a nie do listy modeli. Tak wygląda praca z cennikami producenta w praktyce —
 * przychodzą osobno dla każdej łodzi i zmieniają dopłaty za wyposażenie,
 * nie tylko cenę bazową.
 *
 * Jak wszędzie w tym narzędziu: ten endpoint niczego nie zapisuje.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let file: File | null = null
  let slug = ""
  let sheetIndex = 0

  try {
    const form = await request.formData()
    file = form.get("plik") as File | null
    slug = String(form.get("slug") || "")
    sheetIndex = Number(form.get("arkusz") || 0)
  } catch {
    return NextResponse.json({ error: "Nie udało się odczytać przesłanego pliku" }, { status: 400 })
  }

  if (!slug) {
    return NextResponse.json({ error: "Wybierz łódź" }, { status: 400 })
  }

  const configurator = await loadConfigurator(token, slug)
  if (!configurator) {
    return NextResponse.json(
      { error: "Ta łódź nie ma konfiguratora w Directusie." },
      { status: 404 }
    )
  }

  // Sam wybór łodzi, bez pliku — pokazujemy, co w niej dziś jest.
  if (!file || !file.size) {
    return NextResponse.json({ konfigurator: summarize(configurator), pozycje: [] })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Plik jest większy niż 8 MB" }, { status: 400 })
  }

  let sheets
  try {
    sheets = readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name)
  } catch (error: any) {
    return NextResponse.json(
      { error: `Nie umiem odczytać tego pliku (${error?.message || "nieznany format"}).` },
      { status: 400 }
    )
  }

  let chosen = Math.min(Math.max(0, sheetIndex), sheets.length - 1)
  // Dopłaty za wyposażenie bywają trzycyfrowe — przy cenniku jednej łodzi
  // próg z cennika marki (1000) wycinałby połowę pozycji.
  let rows = extractRows(sheets[chosen].rows, OPTION_MIN_PRICE)

  if (!rows.length && !sheetIndex) {
    for (let index = 0; index < sheets.length; index += 1) {
      const candidate = extractRows(sheets[index].rows, OPTION_MIN_PRICE)
      if (candidate.length) {
        chosen = index
        rows = candidate
        break
      }
    }
  }

  // Opcje konfiguratora udają „modele", żeby użyć tego samego dopasowania:
  // liczby muszą się zgadzać, marka liczy się na plus.
  const options: ModelRef[] = configurator.groups.flatMap((group: any) =>
    (group.options || []).map((option: any) => ({
      id: option.id,
      name: String(option.name || "").slice(0, 160),
      slug: String(group.title || ""),
      brand: "",
      basePrice: Number(option.price) || 0,
      currency: configurator.currency,
    }))
  )

  const proposals = buildProposals(rows, options)

  return NextResponse.json({
    plik: file.name,
    arkusze: sheets.map((sheet, index) => ({ index, name: sheet.name, rows: sheet.rows.length })),
    arkusz: chosen,
    konfigurator: summarize(configurator),
    opcje: options.map((option) => ({
      id: option.id,
      name: option.name,
      group: option.slug,
      price: option.basePrice,
    })),
    pozycje: proposals,
    ...(rows.length
      ? {}
      : { uwaga: "W tym arkuszu nie znalazłem kolumn z nazwą i ceną. Wybierz inny arkusz." }),
  })
}

function summarize(configurator: any) {
  return {
    id: configurator.id,
    slug: configurator.slug,
    name: configurator.boat_model?.name || configurator.slug,
    currency: configurator.currency,
    basePrice: Number(configurator.base_price) || 0,
    groups: configurator.groups.length,
    options: configurator.groups.reduce(
      (sum: number, group: any) => sum + (group.options?.length || 0),
      0
    ),
  }
}

async function loadConfigurator(token: string, slug: string) {
  const body = await directusAs(
    token,
    `/items/configurators?limit=1&filter[slug][_eq]=${encodeURIComponent(slug)}` +
      "&fields=id,slug,currency,base_price,boat_model.name," +
      "groups.id,groups.title,groups.sort,groups.options.id,groups.options.name," +
      "groups.options.price,groups.options.sort"
  )

  const item = body?.data?.[0]
  if (!item) return null

  const bySort = (a: any, b: any) => (Number(a.sort) || 0) - (Number(b.sort) || 0)
  item.groups = (item.groups || []).slice().sort(bySort)
  for (const group of item.groups) {
    group.options = (group.options || []).slice().sort(bySort)
  }

  return item
}
