import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Item = { text: string; price: number | null }
type Group = { title: string; items: Item[] }

/**
 * Zapis wklejonego wyposażenia — dopiero po obejrzeniu podglądu.
 *
 * `tryb` = `dopisz` dokłada grupy do tego, co już jest; `zastap` najpierw
 * kasuje dotychczasowe wyposażenie tej łodzi. Domyślnie dopisujemy, bo
 * skasowanie cudzej pracy jednym kliknięciem powinno wymagać decyzji.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  let modelId: number | string | null = null
  let slug = ""
  let rodzaj: "standardowe" | "dodatkowe" = "standardowe"
  let tryb: "dopisz" | "zastap" = "dopisz"
  let grupy: Group[] = []

  try {
    const body = await request.json()
    modelId = body?.model ?? null
    slug = String(body?.konfigurator || "")
    rodzaj = body?.rodzaj === "dodatkowe" ? "dodatkowe" : "standardowe"
    tryb = body?.tryb === "zastap" ? "zastap" : "dopisz"
    grupy = Array.isArray(body?.grupy) ? body.grupy : []
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  grupy = grupy
    .map((g) => ({
      title: String(g?.title || "").trim().slice(0, 200),
      items: (Array.isArray(g?.items) ? g.items : [])
        .map((i) => ({
          text: String(i?.text || "").trim().slice(0, 500),
          price: i?.price === null || i?.price === undefined ? null : Number(i.price) || 0,
        }))
        .filter((i) => i.text),
    }))
    .filter((g) => g.title && g.items.length)

  if (!grupy.length) {
    return NextResponse.json({ error: "Nie ma czego zapisać" }, { status: 400 })
  }

  try {
    if (rodzaj === "standardowe") {
      if (!modelId) return NextResponse.json({ error: "Wybierz łódź" }, { status: 400 })
      const zapisane = await zapiszStandardowe(token, modelId, grupy, tryb)
      return NextResponse.json({ ok: true, ...zapisane })
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Ta łódź nie ma konfiguratora — wyposażenie dodatkowe nie ma gdzie usiąść." },
        { status: 400 }
      )
    }
    const zapisane = await zapiszDodatkowe(token, slug, grupy, tryb)
    return NextResponse.json({ ok: true, ...zapisane })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Zapis nieudany" }, { status: 500 })
  }
}

async function zapiszStandardowe(
  token: string,
  modelId: number | string,
  grupy: Group[],
  tryb: "dopisz" | "zastap"
) {
  const existing = await directusAs(
    token,
    `/items/equipment_groups?filter[boat_model][_eq]=${modelId}&limit=500&fields=id,sort,items.id`
  )
  const stare = existing?.data || []

  if (tryb === "zastap") {
    for (const g of stare) {
      for (const i of g.items || []) {
        await directusAs(token, `/items/equipment_items/${i.id}`, { method: "DELETE" })
      }
      await directusAs(token, `/items/equipment_groups/${g.id}`, { method: "DELETE" })
    }
  }

  let sort = tryb === "zastap" ? 0 : Math.max(0, ...stare.map((g: any) => Number(g.sort) || 0))
  let pozycji = 0

  for (const g of grupy) {
    sort += 1
    const created = await directusAs(token, "/items/equipment_groups", {
      method: "POST",
      body: JSON.stringify({ boat_model: modelId, title: g.title, sort }),
    })
    const gid = created?.data?.id
    // Pozycje idą jedną wsadową wstawką — przy trzystu wierszach osobne
    // żądania trwałyby minutę i część by się urwała.
    await directusAs(token, "/items/equipment_items", {
      method: "POST",
      body: JSON.stringify(
        g.items.map((item, index) => ({ group: gid, text: item.text, sort: index + 1 }))
      ),
    })
    pozycji += g.items.length
  }

  return { grup: grupy.length, pozycji }
}

async function zapiszDodatkowe(
  token: string,
  slug: string,
  grupy: Group[],
  tryb: "dopisz" | "zastap"
) {
  const found = await directusAs(
    token,
    `/items/configurators?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1&fields=id,groups.id,groups.title,groups.sort,groups.options.id`
  )
  const configurator = found?.data?.[0]
  if (!configurator) throw new Error("Nie ma takiego konfiguratora")

  const stare = configurator.groups || []
  // Zastępujemy tylko grupy z wyposażeniem dodatkowym — silników i pakietów
  // nikt tu nie wkleja, więc nie ma powodu ich ruszać.
  const dodatkowe = stare.filter((g: any) =>
    String(g.title || "").toLowerCase().includes("dodatkow")
  )

  if (tryb === "zastap") {
    for (const g of dodatkowe) {
      for (const o of g.options || []) {
        await directusAs(token, `/items/configurator_options/${o.id}`, { method: "DELETE" })
      }
      await directusAs(token, `/items/configurator_groups/${g.id}`, { method: "DELETE" })
    }
  }

  let sort = Math.max(0, ...stare.map((g: any) => Number(g.sort) || 0))
  let pozycji = 0

  for (const g of grupy) {
    sort += 1
    const created = await directusAs(token, "/items/configurator_groups", {
      method: "POST",
      body: JSON.stringify({
        configurator: configurator.id,
        title: g.title,
        type: "checkbox",
        sort,
      }),
    })
    const gid = created?.data?.id
    await directusAs(token, "/items/configurator_options", {
      method: "POST",
      body: JSON.stringify(
        g.items.map((item, index) => ({
          group: gid,
          name: item.text,
          price: item.price ?? 0,
          sort: index + 1,
        }))
      ),
    })
    pozycji += g.items.length
  }

  return { grup: grupy.length, pozycji }
}
