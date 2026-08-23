import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import { draftDescription, needsWork } from "@/lib/description-draft"
import {
  hasAdminToken,
  listAdminCategories,
  listAdminProducts,
  updateAdminProduct,
} from "@/lib/medusa-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lista produktów z opisem obecnym i propozycją. Nic nie zapisuje. */
export async function GET(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  if (!hasAdminToken()) {
    return NextResponse.json(
      {
        error:
          "Brak klucza do Medusy. Dopisz MEDUSA_ADMIN_TOKEN do .env.local na serwerze i przebuduj stronę.",
      },
      { status: 503 }
    )
  }

  const url = new URL(request.url)
  const categoryId = url.searchParams.get("kategoria") || ""
  const query = url.searchParams.get("szukaj") || ""
  const offset = Number(url.searchParams.get("od")) || 0
  const onlyWeak = url.searchParams.get("slabe") === "1"

  try {
    const [{ products, count }, categories] = await Promise.all([
      listAdminProducts({ categoryId, query, offset, limit: 50 }),
      listAdminCategories(),
    ])

    const rows = products
      .filter((product) => (onlyWeak ? needsWork(product.description) : true))
      .map((product) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        category: product.category,
        thumbnail: product.thumbnail,
        description: product.description,
        // Propozycja zapisana wcześniej ma pierwszeństwo nad świeżo policzoną —
        // ktoś mógł ją już poprawić i odłożyć na później.
        proposal:
          product.proposal ||
          draftDescription({
            title: product.title,
            description: product.description,
            category: product.category,
          }),
        saved: Boolean(product.proposal),
        weak: needsWork(product.description),
      }))

    return NextResponse.json({
      produkty: rows,
      wszystkich: count,
      od: offset,
      kategorie: categories
        .filter((category) => !["shirts", "sweatshirts", "pants", "merch"].includes(category.handle))
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Medusa nie odpowiada" }, { status: 502 })
  }
}

/**
 * Zapis. `tryb: "opis"` wpisuje tekst do sklepu, `tryb: "szkic"` odkłada go
 * w metadanych jako propozycję do późniejszego zatwierdzenia.
 */
export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  if (!hasAdminToken()) {
    return NextResponse.json(
      { error: "Brak klucza do Medusy (MEDUSA_ADMIN_TOKEN)." },
      { status: 503 }
    )
  }

  let changes: { id: string; text: string }[] = []
  let mode = "opis"

  try {
    const body = await request.json()
    changes = Array.isArray(body?.zmiany) ? body.zmiany : []
    mode = body?.tryb === "szkic" ? "szkic" : "opis"
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  const clean = changes
    .map((change) => ({
      id: String(change?.id || ""),
      text: String(change?.text || "").trim().slice(0, 6000),
    }))
    .filter((change) => change.id && change.text)

  if (!clean.length) {
    return NextResponse.json({ error: "Nie ma czego zapisać" }, { status: 400 })
  }

  const saved: any[] = []
  const failed: any[] = []

  for (const change of clean) {
    try {
      const product = await updateAdminProduct(
        change.id,
        mode === "opis"
          ? // Zatwierdzony opis idzie do sklepu, a propozycja znika — inaczej
            // przy następnym wejściu narzędzie proponowałoby to samo.
            { description: change.text, metadata: { opis_propozycja: null } }
          : { metadata: { opis_propozycja: change.text } }
      )
      saved.push({ id: change.id, title: product.title })
    } catch (error: any) {
      failed.push({ id: change.id, error: error?.message || "nie udało się zapisać" })
    }
  }

  return NextResponse.json({ zapisane: saved, bledy: failed, tryb: mode })
}
