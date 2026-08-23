import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"
import { findOrderForm } from "@/lib/order-form"
import { pairOptions, type OurOption } from "@/lib/order-form-match"
import { readRequest } from "@/lib/pricelist-request"
import type { SheetData } from "@/lib/xlsx-parse"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lista łodzi, które mają konfigurator — do wyboru w narzędziu. */
export async function GET() {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  const body = await directusAs(
    token,
    "/items/configurators?limit=200&sort=slug&fields=slug,currency,base_price,price_list_note,boat_model.name"
  )

  return NextResponse.json({
    lodzie: (body?.data || []).map((item: any) => ({
      slug: item.slug,
      name: item.boat_model?.name || item.slug,
      currency: item.currency,
      basePrice: Number(item.base_price) || 0,
      note: item.price_list_note || "",
    })),
  })
}

/**
 * Cennik JEDNEJ łodzi.
 *
 * Cennik producenta jest źródłem prawdy: to on ma komplet pozycji, ich ceny
 * i **kody katalogowe**. Nasz konfigurator jest po polsku i przepisany ręcznie
 * ze starej strony, więc dopasowanie po nazwach zawodzi (sprawdzone na XO
 * DFNDR 8: 17 trafień na 99, w tym błędne). Dlatego:
 *
 * 1. przy pozycjach, które mają już zapisany kod — dopasowanie jest pewne;
 * 2. przy pierwszym imporcie proponujemy pary po cenie i nazwach własnych,
 *    ale tylko jako podpowiedź do potwierdzenia;
 * 3. po zapisie kod zostaje przy opcji i kolejna aktualizacja jest bezobsługowa.
 *
 * Ten endpoint niczego nie zapisuje.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let sheets: SheetData[] = []
  let filename = ""
  let slug = ""

  try {
    const parsed = await readRequest(request)
    sheets = parsed.sheets
    filename = parsed.filename
    slug = parsed.extra.slug || ""
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Nie udało się odczytać danych" },
      { status: 400 }
    )
  }

  if (!slug) {
    return NextResponse.json({ error: "Wybierz łódź" }, { status: 400 })
  }

  const configurator = await loadConfigurator(token, slug)
  if (!configurator) {
    return NextResponse.json({ error: "Ta łódź nie ma konfiguratora w Directusie." }, { status: 404 })
  }

  const ours: OurOption[] = configurator.groups.flatMap((group: any) =>
    (group.options || []).map((option: any) => ({
      id: option.id,
      name: String(option.name || ""),
      price: Number(option.price) || 0,
      group: String(group.title || ""),
      code: String(option.code || ""),
    }))
  )

  // Sam wybór łodzi, bez pliku — pokazujemy, co w niej dziś jest.
  if (!sheets.length) {
    return NextResponse.json({ konfigurator: summarize(configurator, ours) })
  }

  const found = findOrderForm(sheets)
  if (!found) {
    return NextResponse.json(
      {
        konfigurator: summarize(configurator, ours),
        error:
          "Nie rozpoznałem w tym pliku tabeli z cennikiem. Potrzebna jest kolumna z opisem " +
          "pozycji i kolumna z ceną — najlepiej też z kodem katalogowym.",
      },
      { status: 400 }
    )
  }

  const { form } = found
  const pairs = pairOptions(form.options, ours)

  return NextResponse.json({
    plik: filename,
    arkusz: sheets[found.sheet]?.name || "",
    konfigurator: summarize(configurator, ours),
    cennik: {
      boat: form.boat,
      currency: form.currency,
      basePrice: form.basePrice,
      groups: form.groups,
      pozycje: pairs.map((pair) => ({
        line: pair.option.line,
        code: pair.option.code,
        name: pair.option.name,
        price: pair.option.price,
        group: pair.option.group,
        groupType: pair.option.groupType,
        ourId: pair.ourId,
        ourName: pair.ourName,
        ourPrice: pair.ourPrice,
        score: pair.score,
        by: pair.by,
      })),
    },
    // Komplet naszych opcji — z niego człowiek wybiera parę dla pozycji,
    // której nie udało się dopasować automatycznie. Bez tej listy jedynym
    // wyjściem byłoby dołożenie duplikatu.
    nasze: ours.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      group: item.group,
    })),
  })
}

function summarize(configurator: any, ours: OurOption[]) {
  return {
    id: configurator.id,
    slug: configurator.slug,
    name: configurator.boat_model?.name || configurator.slug,
    currency: configurator.currency,
    basePrice: Number(configurator.base_price) || 0,
    groups: configurator.groups.map((group: any) => ({
      id: group.id,
      title: group.title,
      type: group.type,
      count: (group.options || []).length,
    })),
    options: ours.length,
    withCode: ours.filter((item) => item.code).length,
    note: configurator.price_list_note || "",
  }
}

async function loadConfigurator(token: string, slug: string) {
  const body = await directusAs(
    token,
    `/items/configurators?limit=1&filter[slug][_eq]=${encodeURIComponent(slug)}` +
      "&fields=id,slug,currency,base_price,price_list_note,boat_model.name," +
      "groups.id,groups.title,groups.type,groups.sort,groups.options.id,groups.options.name," +
      "groups.options.price,groups.options.code,groups.options.sort"
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
