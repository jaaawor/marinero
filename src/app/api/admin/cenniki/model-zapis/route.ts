import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Change = { optionId: number | string; price: number }

/**
 * Zapis cen opcji jednej łodzi (plus opcjonalnie jej cena bazowa).
 * Przyjmuje wyłącznie to, co człowiek zatwierdził w podglądzie.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let changes: Change[] = []
  let configuratorId: number | string | null = null
  let basePrice: number | null = null

  try {
    const body = await request.json()
    changes = Array.isArray(body?.zmiany) ? body.zmiany : []
    configuratorId = body?.konfigurator ?? null
    basePrice =
      body?.cenaBazowa === null || body?.cenaBazowa === undefined
        ? null
        : Number(body.cenaBazowa)
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  const clean = changes
    .map((change) => ({ optionId: change?.optionId, price: Number(change?.price) }))
    .filter((change) => change.optionId && Number.isFinite(change.price) && change.price >= 0)

  if (!clean.length && basePrice === null) {
    return NextResponse.json({ error: "Nie ma czego zapisać" }, { status: 400 })
  }

  const saved: any[] = []
  const failed: any[] = []

  if (configuratorId && basePrice !== null && Number.isFinite(basePrice) && basePrice >= 0) {
    try {
      await directusAs(token, `/items/configurators/${configuratorId}`, {
        method: "PATCH",
        body: JSON.stringify({ base_price: Math.round(basePrice) }),
      })
      saved.push({ id: configuratorId, name: "Cena bazowa", price: Math.round(basePrice) })
    } catch (error: any) {
      failed.push({ id: configuratorId, error: error?.message || "nie udało się zapisać" })
    }
  }

  for (const change of clean) {
    try {
      const body = await directusAs(token, `/items/configurator_options/${change.optionId}`, {
        method: "PATCH",
        body: JSON.stringify({ price: Math.round(change.price) }),
      })
      saved.push({
        id: change.optionId,
        name: String(body?.data?.name || "").slice(0, 90),
        price: Math.round(change.price),
      })
    } catch (error: any) {
      failed.push({ id: change.optionId, error: error?.message || "nie udało się zapisać" })
    }
  }

  return NextResponse.json({ zapisane: saved, bledy: failed })
}
