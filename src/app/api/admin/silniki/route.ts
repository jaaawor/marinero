import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"
import { pobierzUstawienie, zapiszUstawienie } from "@/lib/panel-ustawienia"
import {
  kluczSilnika,
  ileSilnikow,
  policzZmiany,
  pustyCennik,
  type CennikSilnikow,
  type OpcjaDoPrzeliczenia,
} from "@/lib/silniki-cennik"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const KLUCZ = "silniki-cennik"
const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""

/** Marki, których silniki bierzemy pod uwagę. Reszta pozycji nas nie dotyczy. */
const SILNIKI = /suzuki|avator|torqeedo/i
/** Przygotowanie pod silnik to osobna pozycja, nie silnik — nie wyceniamy jej stąd. */
const ZESTAWY = /pre-?rigg|przygotowanie|wspomaganie|instalacyj/i

async function directus(sciezka: string) {
  const odpowiedz = await fetch(`${DIRECTUS}${sciezka}`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  })
  if (!odpowiedz.ok) {
    const tresc = await odpowiedz.text().catch(() => "")
    throw new Error(`Directus ${odpowiedz.status}: ${tresc.slice(0, 200)}`)
  }
  return odpowiedz.json()
}

/**
 * Opcje silnikowe z konfiguratorów, razem z ceną „bez silnika" przy każdej
 * łodzi.
 *
 * Przy XO cena bazowa wynosi 0, a cenę kadłuba niesie pozycja „Bez silnika" —
 * dlatego wariant silnikowy to kadłub **plus** silnik i tak trzeba go liczyć.
 * Gdy takiej pozycji nie ma (łódź z normalną ceną bazową), zostaje 0 i wariant
 * jest samym silnikiem.
 */
async function opcjeSilnikowe(marka?: string): Promise<{
  opcje: OpcjaDoPrzeliczenia[]
  lodzie: { slug: string; bezSilnika: number; bazowa: number }[]
}> {
  const body = await directus(
    "/items/configurator_options?limit=-1&fields=id,name,price," +
      "group.title,group.configurator.slug,group.configurator.base_price," +
      "group.configurator.currency,group.configurator.status"
  )

  const wszystkie = (body?.data || []).filter(
    (o: any) => o?.group?.configurator?.slug && o?.group?.configurator?.status !== "archived"
  )

  // Cena „bez silnika" na łódź — szukamy jej wśród wszystkich opcji, nie tylko
  // silnikowych, bo sama w sobie silnikiem nie jest.
  const bezSilnika = new Map<string, number>()
  const bazowa = new Map<string, number>()
  for (const o of wszystkie) {
    const slug = o.group.configurator.slug
    bazowa.set(slug, Number(o.group.configurator.base_price) || 0)
    if (/bez silnika/i.test(String(o.name || ""))) {
      bezSilnika.set(slug, Number(o.price) || 0)
    }
  }

  const opcje: OpcjaDoPrzeliczenia[] = []
  for (const o of wszystkie) {
    const nazwa = String(o.name || "").replace(/\s+/g, " ").trim()
    const slug = o.group.configurator.slug
    if (!SILNIKI.test(nazwa) || ZESTAWY.test(nazwa)) continue
    if (/bez silnika/i.test(nazwa)) continue
    if (marka && !slug.startsWith(`${marka}-`)) continue
    // Kolor silnika to nie silnik, choć ma markę w nazwie grupy.
    if (/kolor/i.test(String(o.group.title || ""))) continue

    opcje.push({
      id: Number(o.id),
      nazwa,
      cena: Number(o.price) || 0,
      slug,
      bezSilnika: bezSilnika.get(slug) || 0,
    })
  }

  const lodzie = [...new Set(opcje.map((o) => o.slug))].sort().map((slug) => ({
    slug,
    bezSilnika: bezSilnika.get(slug) || 0,
    bazowa: bazowa.get(slug) || 0,
  }))

  return { opcje, lodzie }
}

export async function GET(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }
  if (!TOKEN) {
    return NextResponse.json({ ok: false, blad: "Brak DIRECTUS_ADMIN_TOKEN na serwerze." })
  }

  const marka = new URL(request.url).searchParams.get("marka") || ""

  try {
    const [zapisany, { opcje, lodzie }] = await Promise.all([
      pobierzUstawienie<CennikSilnikow>(KLUCZ),
      opcjeSilnikowe(marka),
    ])

    const cennik: CennikSilnikow = zapisany?.pozycje ? zapisany : pustyCennik()

    // Pozycje, których w cenniku jeszcze nie ma — dokładamy je puste, żeby
    // sprzedawca zobaczył pełną listę do wypełnienia, a nie musiał zgadywać,
    // czego brakuje.
    const znane = new Set(cennik.pozycje.map((p) => p.klucz))
    for (const opcja of opcje) {
      const klucz = kluczSilnika(opcja.nazwa)
      if (znane.has(klucz)) continue
      znane.add(klucz)
      cennik.pozycje.push({
        klucz,
        nazwa: opcja.nazwa,
        sztuk: ileSilnikow(opcja.nazwa),
        silnikPln: null,
        zestawPln: null,
      })
    }
    cennik.pozycje.sort((a, b) => a.sztuk - b.sztuk || a.nazwa.localeCompare(b.nazwa, "pl"))

    const { zmiany, bezCeny } = policzZmiany(opcje, cennik)

    // Gdzie stoi każda pozycja cennika — bez tego nie widać, czego dotyczy
    // wpisana kwota.
    const gdzie: Record<string, string[]> = {}
    for (const opcja of opcje) {
      const klucz = kluczSilnika(opcja.nazwa)
      gdzie[klucz] = [...new Set([...(gdzie[klucz] || []), opcja.slug])].sort()
    }

    return NextResponse.json({ ok: true, cennik, zmiany, bezCeny, gdzie, lodzie })
  } catch (problem: any) {
    return NextResponse.json({ ok: false, blad: problem?.message || "Directus nie odpowiada." })
  }
}

/** Zapis samego cennika. Cen w konfiguratorach nie rusza. */
export async function POST(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  const cennik = dane?.cennik
  if (!cennik || !Array.isArray(cennik.pozycje)) {
    return NextResponse.json({ ok: false, blad: "Brak cennika do zapisania." }, { status: 400 })
  }

  const zapisany = await zapiszUstawienie(KLUCZ, {
    ...cennik,
    zaktualizowano: new Date().toISOString(),
  })

  return zapisany
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, blad: "Directus nie przyjął zapisu." }, { status: 502 })
}

/**
 * Zastosowanie cennika: przepisanie cen i nazw do konfiguratorów.
 *
 * Osobna droga od zapisu cennika, bo to są dwie różne decyzje. Cennik można
 * uzupełniać tygodniami; przeliczenie ofert to jedno kliknięcie, po którym
 * strona pokazuje nowe kwoty.
 *
 * Każdą pozycję zapisujemy **osobnym żądaniem i osobno zdajemy z niej raport**:
 * przy trzydziestu opcjach jedna odrzucona nie może przewrócić pozostałych ani
 * zostawić nas bez wiedzy, która to była.
 */
export async function PUT(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }
  if (!TOKEN) {
    return NextResponse.json({ ok: false, blad: "Brak DIRECTUS_ADMIN_TOKEN na serwerze." })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  const marka = String(dane?.marka || "")
  const zNazwami = dane?.nazwy !== false

  try {
    const zapisany = await pobierzUstawienie<CennikSilnikow>(KLUCZ)
    if (!zapisany?.pozycje?.length) {
      return NextResponse.json({ ok: false, blad: "Cennik jest pusty — nie ma czego zastosować." })
    }

    const { opcje } = await opcjeSilnikowe(marka)
    const { zmiany } = policzZmiany(opcje, zapisany)

    let zapisanych = 0
    const bledy: { pozycja: string; blad: string }[] = []

    for (const zmiana of zmiany) {
      const doZapisu: Record<string, unknown> = {}
      if (zmiana.nowaCena !== zmiana.staraCena) doZapisu.price = zmiana.nowaCena
      if (zNazwami && zmiana.nowaNazwa !== zmiana.staraNazwa) doZapisu.name = zmiana.nowaNazwa
      if (!Object.keys(doZapisu).length) continue

      try {
        const odpowiedz = await fetch(`${DIRECTUS}/items/configurator_options/${zmiana.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(doZapisu),
          signal: AbortSignal.timeout(20000),
        })
        if (!odpowiedz.ok) throw new Error(`HTTP ${odpowiedz.status}`)
        zapisanych += 1
      } catch (problem: any) {
        bledy.push({
          pozycja: `${zmiana.slug} · ${zmiana.staraNazwa}`,
          blad: problem?.message || "nie zapisano",
        })
      }
    }

    return NextResponse.json({ ok: true, zapisanych, bledy })
  } catch (problem: any) {
    return NextResponse.json({ ok: false, blad: problem?.message || "Directus nie odpowiada." })
  }
}
