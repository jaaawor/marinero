import { NextResponse } from "next/server"
import { directusAs, getAdminToken } from "@/lib/admin-auth"
import {
  KLUCZE_MODULOW,
  dostepZalogowanego,
  pobierzPrzypisania,
  zapiszPrzypisania,
} from "@/lib/panel-dostep"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NAZWA_ROLI = "Panel"

/** Kolekcje, które panel zapisuje **tokenem zalogowanej osoby**. */
const KOLEKCJE_PANELU = [
  "boat_models",
  "configurators",
  "configurator_groups",
  "configurator_options",
  "equipment_groups",
  "equipment_items",
]

/**
 * Rola „Panel": konto do narzędzi, bez wstępu do samego Directusa.
 *
 * Szukamy po nazwie i zakładamy, gdy jej nie ma — dzięki temu funkcja działa
 * także na świeżej instalacji, a identyfikatora roli nie trzeba trzymać
 * w kodzie ani w zmiennych środowiskowych.
 */
async function rolaPanelu(token: string): Promise<string> {
  const istniejaca = await directusAs(
    token,
    `/roles?filter[name][_eq]=${encodeURIComponent(NAZWA_ROLI)}&fields=id&limit=1`
  )
  const znaleziona = istniejaca?.data?.[0]?.id
  if (znaleziona) return znaleziona

  const polityka = await directusAs(token, "/policies", {
    method: "POST",
    body: JSON.stringify({
      name: NAZWA_ROLI,
      icon: "tune",
      description:
        "Konta do narzędzi wewnętrznych (/narzedzia-8f3a). Bez dostępu do panelu Directusa.",
      admin_access: false,
      app_access: false,
    }),
  })
  const politykaId = polityka?.data?.id

  for (const kolekcja of KOLEKCJE_PANELU) {
    for (const dzialanie of ["read", "create", "update", "delete"]) {
      await directusAs(token, "/permissions", {
        method: "POST",
        body: JSON.stringify({
          policy: politykaId,
          collection: kolekcja,
          action: dzialanie,
          fields: ["*"],
          permissions: {},
          validation: {},
        }),
      }).catch(() => null)
    }
  }

  // Bez odczytu własnego konta panel nie wie, kto jest zalogowany, i wyrzuca
  // do formularza logowania zaraz po zalogowaniu.
  await directusAs(token, "/permissions", {
    method: "POST",
    body: JSON.stringify({
      policy: politykaId,
      collection: "directus_users",
      action: "read",
      fields: ["id", "first_name", "last_name", "email", "role"],
      permissions: { id: { _eq: "$CURRENT_USER" } },
      validation: {},
    }),
  }).catch(() => null)

  const rola = await directusAs(token, "/roles", {
    method: "POST",
    body: JSON.stringify({
      name: NAZWA_ROLI,
      icon: "tune",
      description: "Konta do narzędzi wewnętrznych. Moduły wybiera się w panelu, nie tutaj.",
      policies: [{ policy: politykaId }],
    }),
  })

  return rola?.data?.id || ""
}

/** Lista kont panelu wraz z przypisanymi modułami. Tylko dla administratora. */
export async function GET() {
  const token = await getAdminToken()
  if (!token) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  const dostep = await dostepZalogowanego(token)
  if (!dostep?.glowny) {
    return NextResponse.json({ ok: false, blad: "Konta zakłada główny administrator." }, { status: 403 })
  }

  try {
    const osoby = await directusAs(
      token,
      "/users?limit=100&sort=email&fields=id,email,first_name,last_name,status,role.id,role.name"
    )
    const przypisania = await pobierzPrzypisania()

    return NextResponse.json({
      ok: true,
      osoby: (osoby?.data || []).map((osoba: any) => ({
        id: osoba.id,
        email: osoba.email || "",
        imie: [osoba.first_name, osoba.last_name].filter(Boolean).join(" "),
        stan: osoba.status || "",
        rola: osoba.role?.name || "—",
        // Administrator ma wszystko z definicji i nie da się mu tego odebrać
        // z panelu — inaczej dałoby się odciąć jedyne konto, które umie to
        // przywrócić.
        glowny: osoba.role?.name === "Administrator",
        moduly: przypisania[osoba.id] || [],
      })),
    })
  } catch (problem: any) {
    return NextResponse.json(
      { ok: false, blad: problem?.message || "Directus nie odpowiada." },
      { status: 502 }
    )
  }
}

export async function POST(request: Request) {
  const token = await getAdminToken()
  if (!token) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  const dostep = await dostepZalogowanego(token)
  if (!dostep?.glowny) {
    return NextResponse.json({ ok: false, blad: "Konta zakłada główny administrator." }, { status: 403 })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  try {
    if (dane?.co === "nowe") {
      const email = String(dane?.email || "").trim().toLowerCase()
      const haslo = String(dane?.haslo || "")

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ ok: false, blad: "Podaj poprawny e-mail." }, { status: 400 })
      }
      // Directus przyjmie i krótsze, ale to jest konto z dostępem do cen
      // i zamówień — nie ma powodu ułatwiać zgadywania.
      if (haslo.length < 10) {
        return NextResponse.json(
          { ok: false, blad: "Hasło musi mieć co najmniej 10 znaków." },
          { status: 400 }
        )
      }

      const rola = await rolaPanelu(token)

      const utworzony = await directusAs(token, "/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: haslo,
          first_name: String(dane?.imie || "").trim() || undefined,
          last_name: String(dane?.nazwisko || "").trim() || undefined,
          role: rola || undefined,
          status: "active",
        }),
      })

      const id = utworzony?.data?.id
      const moduly: string[] = Array.isArray(dane?.moduly)
        ? dane.moduly.filter((k: string) => KLUCZE_MODULOW.includes(k))
        : []

      if (id && moduly.length) {
        const przypisania = await pobierzPrzypisania()
        await zapiszPrzypisania({ ...przypisania, [id]: moduly })
      }

      return NextResponse.json({ ok: true, id })
    }

    if (dane?.co === "moduly") {
      const id = String(dane?.id || "")
      if (!id) return NextResponse.json({ ok: false, blad: "Brak konta." }, { status: 400 })

      const moduly: string[] = Array.isArray(dane?.moduly) ? dane.moduly : []
      const przypisania = await pobierzPrzypisania()

      if (!(await zapiszPrzypisania({ ...przypisania, [id]: moduly }))) {
        return NextResponse.json(
          {
            ok: false,
            blad: "Nie udało się zapisać. Sprawdź DIRECTUS_ADMIN_TOKEN w .env.local na serwerze.",
          },
          { status: 502 }
        )
      }

      return NextResponse.json({ ok: true })
    }

    if (dane?.co === "stan") {
      const id = String(dane?.id || "")
      const stan = dane?.aktywne ? "active" : "suspended"
      if (!id) return NextResponse.json({ ok: false, blad: "Brak konta." }, { status: 400 })

      // Konta **nie kasujemy** — zawieszamy. Skasowane zniknęłoby z historii
      // zmian w Directusie razem z tym, co ta osoba poprawiała.
      await directusAs(token, `/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: stan }),
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, blad: "Nieznane żądanie." }, { status: 400 })
  } catch (problem: any) {
    return NextResponse.json(
      { ok: false, blad: problem?.message || "Directus odrzucił zapytanie." },
      { status: 502 }
    )
  }
}
