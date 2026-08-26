import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"
import { countItems, parseEquipmentPaste, type PasteMode } from "@/lib/equipment-paste"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Łodzie do wyboru wraz z tym, co już mają wpisane. */
export async function GET() {
  const token = await getAdminToken()
  if (!token) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  const [models, groups, configurators] = await Promise.all([
    directusAs(token, "/items/boat_models?limit=300&sort=name&fields=id,name,slug,status"),
    directusAs(token, "/items/equipment_groups?limit=500&fields=id,boat_model,title,items.id"),
    directusAs(token, "/items/configurators?limit=300&fields=slug,boat_model,groups.title,groups.options.id"),
  ])

  const standard = new Map<string, number>()
  for (const g of groups?.data || []) {
    const key = String(g.boat_model?.id ?? g.boat_model ?? "")
    standard.set(key, (standard.get(key) || 0) + (g.items?.length || 0))
  }

  const extra = new Map<string, { slug: string; count: number }>()
  for (const c of configurators?.data || []) {
    const key = String(c.boat_model?.id ?? c.boat_model ?? "")
    const count = (c.groups || [])
      .filter((g: any) => String(g.title || "").toLowerCase().includes("dodatkow"))
      .reduce((sum: number, g: any) => sum + (g.options?.length || 0), 0)
    if (key) extra.set(key, { slug: c.slug, count })
  }

  return NextResponse.json({
    lodzie: (models?.data || [])
      .filter((m: any) => m.status !== "archived")
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        standardowe: standard.get(String(m.id)) || 0,
        dodatkowe: extra.get(String(m.id))?.count || 0,
        konfigurator: extra.get(String(m.id))?.slug || "",
      })),
  })
}

/** Podgląd: co ze wklejonego tekstu wyjdzie. Nic nie zapisuje. */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  let text = ""
  let mode: PasteMode = "standardowe"
  try {
    const body = await request.json()
    text = String(body?.tekst || "")
    mode = body?.rodzaj === "dodatkowe" ? "dodatkowe" : "standardowe"
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Wklej listę wyposażenia" }, { status: 400 })
  }

  const grupy = parseEquipmentPaste(text, mode)
  return NextResponse.json({ grupy, pozycji: countItems(grupy) })
}
