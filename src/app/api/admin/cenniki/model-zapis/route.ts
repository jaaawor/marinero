import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Row = {
  /** Nasza opcja, jeśli pozycja z cennika ma już swój odpowiednik. */
  ourId?: number | string | null
  /** Kod katalogowy — zapisujemy go, żeby kolejny import był bezobsługowy. */
  code?: string
  /** Nazwa po polsku (albo angielska, gdy nikt jej jeszcze nie przetłumaczył). */
  name?: string
  price?: number
  /** Nazwa grupy z cennika — potrzebna tylko przy dokładaniu nowych pozycji. */
  group?: string
  groupType?: string
}

/**
 * Zapis planu przygotowanego w podglądzie. Przyjmuje wyłącznie to, co człowiek
 * zatwierdził: aktualizacje cen istniejących opcji, nowe pozycje do dołożenia
 * i cenę bazową.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let configuratorId: number | string | null = null
  let basePrice: number | null = null
  let updates: Row[] = []
  let additions: Row[] = []
  let note = ""

  try {
    const body = await request.json()
    configuratorId = body?.konfigurator ?? null
    basePrice =
      body?.cenaBazowa === null || body?.cenaBazowa === undefined ? null : Number(body.cenaBazowa)
    updates = Array.isArray(body?.aktualizacje) ? body.aktualizacje : []
    additions = Array.isArray(body?.nowe) ? body.nowe : []
    note = String(body?.notatka || "").slice(0, 300)
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  if (!configuratorId) {
    return NextResponse.json({ error: "Brak konfiguratora" }, { status: 400 })
  }

  const saved: any[] = []
  const failed: any[] = []

  if (basePrice !== null && Number.isFinite(basePrice) && basePrice >= 0) {
    try {
      await directusAs(token, `/items/configurators/${configuratorId}`, {
        method: "PATCH",
        body: JSON.stringify({
          base_price: Math.round(basePrice),
          ...(note ? { price_list_note: note } : {}),
        }),
      })
      saved.push({ what: "Cena bazowa", value: Math.round(basePrice) })
    } catch (error: any) {
      failed.push({ what: "Cena bazowa", error: error?.message || "nie udało się zapisać" })
    }
  } else if (note) {
    await directusAs(token, `/items/configurators/${configuratorId}`, {
      method: "PATCH",
      body: JSON.stringify({ price_list_note: note }),
    }).catch(() => undefined)
  }

  for (const row of updates) {
    if (!row?.ourId) continue
    const price = Number(row.price)
    if (!Number.isFinite(price) || price < 0) continue

    try {
      const body = await directusAs(token, `/items/configurator_options/${row.ourId}`, {
        method: "PATCH",
        body: JSON.stringify({
          price: Math.round(price),
          // Kod zapisujemy przy każdej aktualizacji — to on sprawia,
          // że następnym razem nie trzeba niczego potwierdzać.
          ...(row.code ? { code: String(row.code).slice(0, 40) } : {}),
          ...(row.name ? { name: String(row.name).slice(0, 400) } : {}),
        }),
      })
      saved.push({ what: body?.data?.name || row.name || row.ourId, value: Math.round(price) })
    } catch (error: any) {
      failed.push({ what: row.name || row.ourId, error: error?.message || "nie udało się zapisać" })
    }
  }

  if (additions.length) {
    const result = await addOptions(token, configuratorId, additions)
    saved.push(...result.saved)
    failed.push(...result.failed)
  }

  return NextResponse.json({ zapisane: saved, bledy: failed })
}

/**
 * Nowe pozycje z cennika. Grupę zakładamy tylko wtedy, gdy takiej nazwy
 * jeszcze nie ma — inaczej dokładamy do istniejącej.
 */
async function addOptions(token: string, configuratorId: number | string, rows: Row[]) {
  const saved: any[] = []
  const failed: any[] = []

  const body = await directusAs(
    token,
    `/items/configurator_groups?limit=200&filter[configurator][_eq]=${configuratorId}` +
      "&fields=id,title,sort,options.id"
  )

  const groups: { id: number; title: string; sort: number; count: number }[] = (
    body?.data || []
  ).map((group: any) => ({
    id: group.id,
    title: String(group.title || ""),
    sort: Number(group.sort) || 0,
    count: (group.options || []).length,
  }))

  const byTitle = new Map(groups.map((group) => [group.title.toLowerCase(), group]))
  let nextGroupSort = groups.reduce((max, group) => Math.max(max, group.sort), 0)

  for (const row of rows) {
    const price = Number(row.price)
    const name = String(row.name || "").trim()
    const title = String(row.group || "").trim() || "Wyposażenie dodatkowe"

    if (!name || !Number.isFinite(price) || price < 0) continue

    try {
      let group = byTitle.get(title.toLowerCase())

      if (!group) {
        nextGroupSort += 1
        const created = await directusAs(token, "/items/configurator_groups", {
          method: "POST",
          body: JSON.stringify({
            configurator: configuratorId,
            title: title.slice(0, 200),
            type: row.groupType === "radio" ? "radio" : "checkbox",
            sort: nextGroupSort,
          }),
        })
        group = { id: created?.data?.id, title, sort: nextGroupSort, count: 0 }
        byTitle.set(title.toLowerCase(), group)
      }

      group.count += 1
      await directusAs(token, "/items/configurator_options", {
        method: "POST",
        body: JSON.stringify({
          group: group.id,
          name: name.slice(0, 400),
          price: Math.round(price),
          ...(row.code ? { code: String(row.code).slice(0, 40) } : {}),
          sort: group.count,
        }),
      })

      saved.push({ what: `+ ${name.slice(0, 70)}`, value: Math.round(price) })
    } catch (error: any) {
      failed.push({ what: name, error: error?.message || "nie udało się dodać" })
    }
  }

  return { saved, failed }
}
