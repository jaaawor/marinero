import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Change = {
  modelId: number | string
  price: number
  currency: string
}

/**
 * Zapis zatwierdzonych zmian cen. Przyjmuje tylko to, co człowiek zaznaczył
 * w podglądzie — endpoint sam z siebie niczego nie dopasowuje.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let changes: Change[] = []
  try {
    const body = await request.json()
    changes = Array.isArray(body?.zmiany) ? body.zmiany : []
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  const clean = changes
    .map((change) => ({
      modelId: change?.modelId,
      price: Number(change?.price),
      currency: String(change?.currency || "").toUpperCase().slice(0, 3),
    }))
    .filter((change) => change.modelId && Number.isFinite(change.price) && change.price > 0)

  if (!clean.length) {
    return NextResponse.json({ error: "Nie ma czego zapisać" }, { status: 400 })
  }

  const saved: any[] = []
  const failed: any[] = []

  for (const change of clean) {
    try {
      const body = await directusAs(token, `/items/boat_models/${change.modelId}`, {
        method: "PATCH",
        body: JSON.stringify({
          base_price: Math.round(change.price),
          ...(change.currency ? { currency: change.currency } : {}),
        }),
      })

      saved.push({ id: change.modelId, name: body?.data?.name || "", price: change.price })
    } catch (error: any) {
      failed.push({ id: change.modelId, error: error?.message || "nie udało się zapisać" })
    }
  }

  return NextResponse.json({ zapisane: saved, bledy: failed })
}
