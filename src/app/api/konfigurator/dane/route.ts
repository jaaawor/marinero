import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { CIASTECZKO_DOSTEPU, czytajBilet } from "@/lib/konfigurator-dostep"
import { getConfigurator } from "@/lib/configurator-source"
import { getStandardEquipmentFor } from "@/lib/standard-equipment-source"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

/**
 * Odnotowanie wejścia do konfiguratora.
 *
 * To jest **jedyne miejsce**, przez które przechodzi każde otwarcie łodzi
 * z bramką — i pierwsze, i każde następne. Licznik przy zapisie kontaktu
 * rósłby tylko przy pierwszym razie, bo przy powrocie ciasteczko już jest
 * i formularz się nie pokazuje; wtedy „ile razy wchodzi" pokazywałoby przy
 * wszystkich jedynkę.
 *
 * Idzie bez czekania i bez wpływu na odpowiedź: statystyka nie może
 * opóźnić otwarcia kalkulatora ani go zablokować, gdy Directus kicha.
 */
async function odnotujWejscie(email: string, model: string) {
  if (!TOKEN || !email) return

  try {
    const szukaj = await fetch(
      `${DIRECTUS}/items/configurator_leads?filter[email][_eq]=${encodeURIComponent(email)}` +
        "&fields=id,wejsc&limit=1",
      { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
    )
    const wpis = (await szukaj.json())?.data?.[0]
    if (!wpis) return

    await fetch(`${DIRECTUS}/items/configurator_leads/${wpis.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        wejsc: Number(wpis.wejsc || 0) + 1,
        ostatnio: new Date().toISOString(),
        ...(model ? { ostatni_model: model.slice(0, 150) } : {}),
      }),
      cache: "no-store",
    })
  } catch {
    // Cisza jest tu właściwa: to licznik, nie zamówienie.
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Dane konfiguratora dla łodzi z bramką — wydawane dopiero po odblokowaniu.
 *
 * To jest powód, dla którego bramka nie jest samym zasłonięciem w CSS-ie:
 * gdyby strona modelu wysyłała opcje i ceny w HTML-u, wystarczyłoby zajrzeć
 * w źródło. Przy łodziach z bramką strona **nie dostaje tych danych w ogóle**,
 * a przeglądarka pyta o nie stąd — z ciasteczkiem, które sami podpisaliśmy.
 */
export async function GET(request: Request) {
  const bilet = czytajBilet((await cookies()).get(CIASTECZKO_DOSTEPU)?.value)
  if (!bilet) {
    return NextResponse.json({ ok: false, powod: "brak_dostepu" }, { status: 403 })
  }

  const slug = new URL(request.url).searchParams.get("slug") || ""
  if (!slug) return NextResponse.json({ ok: false, powod: "brak_slugu" }, { status: 400 })

  const [config, wyposazenie] = await Promise.all([
    getConfigurator(slug),
    getStandardEquipmentFor(slug),
  ])

  if (!config) return NextResponse.json({ ok: false, powod: "brak_konfiguratora" }, { status: 404 })

  void odnotujWejscie(bilet.email, slug)

  return NextResponse.json(
    { ok: true, config, wyposazenie, imie: bilet.imie, email: bilet.email },
    { headers: { "Cache-Control": "no-store" } }
  )
}
