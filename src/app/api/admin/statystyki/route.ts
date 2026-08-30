import { NextResponse } from "next/server"
import { getAdminToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

type Wpis = { fraza: string; gdzie: string; wynikow: number | null; date_created: string }

function odIlu(dni: number) {
  return new Date(Date.now() - dni * 24 * 60 * 60 * 1000).toISOString()
}

async function szukania(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/search_queries` +
    `?limit=-1&fields=fraza,gdzie,wynikow,date_created` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const wpisy: Wpis[] = (await odpowiedz.json())?.data || []

  // Zliczamy po frazie **znormalizowanej** (małe litery, zbite spacje), ale
  // pokazujemy pierwszy oryginalny zapis — inaczej „Nordkapp" i „nordkapp"
  // byłyby dwoma osobnymi wierszami.
  function podsumuj(gdzie: string) {
    const kubelki = new Map<string, { fraza: string; ile: number; bezWynikow: number }>()
    for (const wpis of wpisy) {
      if (wpis.gdzie !== gdzie) continue
      const klucz = wpis.fraza.toLowerCase().replace(/\s+/g, " ").trim()
      const kubelek = kubelki.get(klucz) || { fraza: wpis.fraza, ile: 0, bezWynikow: 0 }
      kubelek.ile += 1
      if (wpis.wynikow === 0) kubelek.bezWynikow += 1
      kubelki.set(klucz, kubelek)
    }
    return [...kubelki.values()].sort((a, b) => b.ile - a.ile)
  }

  const lodzie = podsumuj("lodzie")
  const sklep = podsumuj("sklep")

  return {
    dostepne: true as const,
    dni,
    razem: wpisy.length,
    lodzie: lodzie.slice(0, 40),
    sklep: sklep.slice(0, 40),
    // Frazy bez ani jednego wyniku to najkonkretniejszy sygnał, jaki daje
    // wyszukiwarka: ludzie szukają czegoś, czego nie mamy albo co nazywa się
    // u nas inaczej.
    bezWynikow: [...lodzie.map((w) => ({ ...w, gdzie: "lodzie" })), ...sklep.map((w) => ({ ...w, gdzie: "sklep" }))]
      .filter((w) => w.bezWynikow > 0)
      .sort((a, b) => b.bezWynikow - a.bezWynikow)
      .slice(0, 30),
  }
}

type Odslona = {
  sciezka: string
  gdzie: string
  tytul: string
  skad: string
  gosc: string
  odcisk: string
}

/**
 * Klucz odwiedzającego: ciasteczko, a gdy go nie ma — odcisk dnia.
 *
 * Kolejność nie jest przypadkowa. Ciasteczko trzyma się przeglądarki przez rok,
 * więc powrót po tygodniu widać jako tę samą osobę. Odcisk zmienia się co dobę
 * i skleja ludzi za jednym firmowym łączem, ale jest jedynym, co zostaje
 * w trybie prywatnym. Wpis bez obu (starsze dane) liczymy jako osobne wejście —
 * inaczej wszystkie zlałyby się w jedno.
 */
function ktoOdwiedzil(wpis: { gosc?: string; odcisk?: string }, numer: number): string {
  return wpis.gosc || wpis.odcisk || `bez-znacznika-${numer}`
}

/**
 * Odsłony stron — ile razy która strona została otwarta, osobno dla łodzi
 * i dla sklepu.
 *
 * Liczymy odsłony, nie ludzi: nie zapisujemy adresu IP ani ciasteczka, więc
 * nie da się z tego odtworzyć, kto co oglądał. Sprzedawcy potrzebna jest
 * odpowiedź na jedno pytanie — które łodzie i produkty przyciągają uwagę.
 */
async function odslony(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/page_views` +
    `?limit=-1&fields=sciezka,gdzie,tytul,skad,gosc,odcisk` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const wpisy: Odslona[] = (await odpowiedz.json())?.data || []

  function podsumuj(gdzie: string) {
    const kubelki = new Map<
      string,
      { sciezka: string; tytul: string; ile: number; osoby: Set<string> }
    >()

    for (const [numer, wpis] of wpisy.entries()) {
      if (wpis.gdzie !== gdzie) continue
      const kubelek = kubelki.get(wpis.sciezka) || {
        sciezka: wpis.sciezka,
        // Tytuł bierzemy z pierwszej odsłony — po zmianie nazwy modelu starsze
        // wpisy miałyby inny, a to jedna i ta sama strona.
        tytul: wpis.tytul || "",
        ile: 0,
        osoby: new Set<string>(),
      }
      if (!kubelek.tytul && wpis.tytul) kubelek.tytul = wpis.tytul
      kubelek.ile += 1
      kubelek.osoby.add(ktoOdwiedzil(wpis, numer))
      kubelki.set(wpis.sciezka, kubelek)
    }

    return [...kubelki.values()]
      .map(({ osoby, ...reszta }) => ({ ...reszta, unikalnych: osoby.size }))
      .sort((a, b) => b.ile - a.ile)
  }

  // Skąd przychodzą — pusty wpis to wejście bezpośrednie albo z zakładki.
  const zrodla = new Map<string, number>()
  for (const wpis of wpisy) {
    const klucz = wpis.skad || "wejście bezpośrednie"
    zrodla.set(klucz, (zrodla.get(klucz) || 0) + 1)
  }

  const lodzie = podsumuj("lodzie")
  const sklep = podsumuj("sklep")

  const wszyscy = new Set(wpisy.map((wpis, numer) => ktoOdwiedzil(wpis, numer)))

  return {
    dostepne: true as const,
    dni,
    razem: wpisy.length,
    unikalnych: wszyscy.size,
    razemLodzie: lodzie.reduce((suma, wpis) => suma + wpis.ile, 0),
    razemSklep: sklep.reduce((suma, wpis) => suma + wpis.ile, 0),
    lodzie: lodzie.slice(0, 40),
    sklep: sklep.slice(0, 40),
    zrodla: [...zrodla.entries()]
      .map(([nazwa, ile]) => ({ nazwa, ile }))
      .sort((a, b) => b.ile - a.ile)
      .slice(0, 12),
  }
}

type Sesja = {
  model_slug: string
  model_name: string
  etap: string
  opcji: number
  wartosc: number
  waluta: string
  gosc: string
  odcisk: string
  klient_imie: string
  klient_email: string
  klient_telefon: string
  uwagi: string
  date_updated: string
  date_created: string
}

/**
 * Konfiguratory: kto doszedł do końca, a kto się rozmyślił.
 *
 * Sama liczba wysłanych ofert tego nie pokaże — konfiguracja, która nie doszła
 * do wysyłki, nie zostawia po sobie nic, a to właśnie ona jest ciekawa.
 * Ktoś poskładał łódź za pół miliona i zamknął kartę: to sygnał, że warto
 * spojrzeć na cenę, opis albo na to, czy formularz nie odstrasza.
 */
async function konfiguratory(dni: number) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  const adres =
    `${DIRECTUS}/items/configurator_sessions` +
    `?limit=-1&fields=model_slug,model_name,etap,opcji,wartosc,waluta,gosc,odcisk,` +
    `klient_imie,klient_email,klient_telefon,uwagi,date_updated,date_created` +
    `&filter[date_created][_gte]=${encodeURIComponent(odIlu(dni))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const sesje: Sesja[] = (await odpowiedz.json())?.data || []

  const modele = new Map<
    string,
    {
      model: string
      slug: string
      zaczete: number
      wyslane: number
      porzucone: number
      waluta: string
      wartoscPorzuconych: number
      osoby: Set<string>
    }
  >()

  for (const [numer, sesja] of sesje.entries()) {
    const klucz = sesja.model_slug || sesja.model_name
    const wpis = modele.get(klucz) || {
      model: sesja.model_name || klucz,
      slug: sesja.model_slug || "",
      zaczete: 0,
      wyslane: 0,
      porzucone: 0,
      waluta: sesja.waluta || "",
      wartoscPorzuconych: 0,
      osoby: new Set<string>(),
    }

    wpis.zaczete += 1
    wpis.osoby.add(ktoOdwiedzil(sesja, numer))
    if (sesja.etap === "wyslana") {
      wpis.wyslane += 1
    } else {
      wpis.porzucone += 1
      wpis.wartoscPorzuconych += Number(sesja.wartosc) || 0
    }

    modele.set(klucz, wpis)
  }

  const lista = [...modele.values()]
    .map(({ osoby, ...wpis }) => ({
      ...wpis,
      unikalnych: osoby.size,
      // Średnia z porzuconych, nie suma: suma rośnie z ruchem i nic nie mówi
      // o tym, jak drogie łodzie ludzie składają.
      sredniaPorzuconych: wpis.porzucone ? Math.round(wpis.wartoscPorzuconych / wpis.porzucone) : 0,
    }))
    .sort((a, b) => b.porzucone - a.porzucone || b.zaczete - a.zaczete)

  // Do wglądu: ostatnie porzucone konfiguracje, od najświeższej. Przy takiej
  // można jeszcze zadzwonić, jeżeli klient zostawił dane.
  const ostatnie = sesje
    .filter((sesja) => sesja.etap !== "wyslana")
    .sort((a, b) => (b.date_updated || b.date_created).localeCompare(a.date_updated || a.date_created))
    .slice(0, 25)
    .map((sesja) => ({
      model: sesja.model_name || sesja.model_slug,
      slug: sesja.model_slug,
      etap: sesja.etap,
      opcji: Number(sesja.opcji) || 0,
      wartosc: Number(sesja.wartosc) || 0,
      waluta: sesja.waluta || "",
      kiedy: sesja.date_updated || sesja.date_created,
      imie: sesja.klient_imie || "",
      email: sesja.klient_email || "",
      telefon: sesja.klient_telefon || "",
      uwagi: (sesja.uwagi || "").slice(0, 300),
    }))

  return {
    dostepne: true as const,
    zaczete: sesje.length,
    unikalnych: new Set(sesje.map((sesja, numer) => ktoOdwiedzil(sesja, numer))).size,
    wyslane: sesje.filter((sesja) => sesja.etap === "wyslana").length,
    modele: lista.slice(0, 30),
    ostatnie,
  }
}

async function koszyki() {
  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""
  if (!token) return { dostepne: false, powod: "brak_tokenu_directus" as const }

  // Medusa 2 nie wystawia listy koszyków przez API (`/admin/carts` odpowiada 404),
  // więc czytamy własne migawki z kolekcji `active_carts` — zapisuje je sklep
  // przy każdej zmianie koszyka i przy wypełnianiu zamówienia.
  const adres =
    `${DIRECTUS}/items/active_carts` +
    `?limit=60&sort=-date_updated&fields=id,cart_id,pozycje,sztuk,wartosc,email,etap,date_updated,date_created` +
    `&filter[etap][_neq]=zlozone` +
    `&filter[date_updated][_gte]=${encodeURIComponent(odIlu(14))}`

  const odpowiedz = await fetch(adres, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!odpowiedz.ok) return { dostepne: false, powod: `directus_${odpowiedz.status}` }

  const lista = ((await odpowiedz.json())?.data || [])
    .filter((wpis: any) => Number(wpis.sztuk) > 0)
    .map((wpis: any) => ({
      id: String(wpis.id),
      email: wpis.email || "",
      zmieniony: wpis.date_updated || wpis.date_created,
      suma: Number(wpis.wartosc) || 0,
      waluta: "PLN",
      sztuk: Number(wpis.sztuk) || 0,
      etap: wpis.etap || "koszyk",
      pozycje: String(wpis.pozycje || ""),
    }))

  return { dostepne: true as const, koszyki: lista }
}

export async function GET(request: Request) {
  const zalogowany = await getAdminToken()
  if (!zalogowany) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })

  const dni = Number(new URL(request.url).searchParams.get("dni")) || 30

  const [wyszukiwania, aktywne, wejscia, konfigi] = await Promise.all([
    szukania(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    koszyki().catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    odslony(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
    konfiguratory(dni).catch((error) => ({ dostepne: false as const, powod: String(error).slice(0, 120) })),
  ])

  return NextResponse.json({
    szukania: wyszukiwania,
    koszyki: aktywne,
    odslony: wejscia,
    konfiguratory: konfigi,
  })
}
