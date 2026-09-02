// Klient Admin API Medusy — tylko do narzędzi wewnętrznych.
//
// Klucz jest sekretem i **nie może** znaleźć się w repozytorium: siedzi
// w `MEDUSA_ADMIN_TOKEN` w `.env.local` na VPS-ie. Bez niego narzędzie
// pokazuje czytelny komunikat zamiast się wywracać.
//
// Medusa 2 uwierzytelnia klucz `sk_…` przez HTTP Basic (klucz jako login,
// puste hasło). Nagłówek `x-medusa-access-token` zwraca 401 — to ślepa uliczka,
// na którą łatwo wpaść, bo tak wygląda dokumentacja Medusy 1.

import { MEDUSA_KEY, MEDUSA_URL } from "@/lib/medusa"
import { parametryZMetadanych } from "@/lib/parametry"
import { cenaDetaliczna, przekreslonaWlaczona } from "@/lib/cena-detaliczna"
import { czyPolecany, kolejnoscPolecanego } from "@/lib/polecane"
import { historiaCen, najnizszaZ30Dni, type WpisHistorii } from "@/lib/historia-cen"
import { wagaKg } from "@/lib/waga"

export function adminToken(): string {
  return process.env.MEDUSA_ADMIN_TOKEN || ""
}

export function hasAdminToken(): boolean {
  return Boolean(adminToken())
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${adminToken()}:`).toString("base64")}`
}

/**
 * Ograniczenie czasu jednego żądania do Medusy.
 *
 * `fetch` **nie ma własnego limitu**: gdy Medusa przestanie odpowiadać, czeka
 * bez końca. Panel cen stawał wtedy na pasku „Pytam sklep o produkty…" i nie
 * ruszał — bez błędu, bez danych, bez niczego. Dwadzieścia sekund z zapasem
 * wystarcza na stronę stu produktów; dłuższa cisza to awaria, o której trzeba
 * powiedzieć, a nie czekać na nią w nieskończoność.
 */
const LIMIT_MS = 20_000

export async function medusaAdmin(path: string, init: RequestInit = {}): Promise<any> {
  const token = adminToken()
  if (!token) {
    throw new Error(
      "Brak klucza do Medusy. Dopisz MEDUSA_ADMIN_TOKEN do .env.local na serwerze i przebuduj stronę."
    )
  }

  // Odczyt ponawiamy raz. Kontener sklepu potrafi się zamyślić na kilkanaście
  // sekund (Medusa rośnie w pamięci i bywa, że akurat zbiera śmieci), a jedno
  // takie potknięcie kładło całą zakładkę Cen — mimo że druga próba wchodzi
  // od ręki. **Zapisów nie ponawiamy**: żądanie mogło dojść i zostać wykonane,
  // a druga cena albo drugi stan to gorzej niż komunikat o błędzie.
  const czytanie = !init.method || String(init.method).toUpperCase() === "GET"
  const podejscia = czytanie && !init.signal ? 2 : 1

  let response: Response | null = null
  let ostatni: any = null

  for (let podejscie = 1; podejscie <= podejscia; podejscie++) {
    try {
      response = await fetch(`${MEDUSA_URL}${path}`, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: authHeader(),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: init.signal ?? AbortSignal.timeout(LIMIT_MS),
      })
      break
    } catch (problem: any) {
      ostatni = problem
      // Klient przerwał sam (zamknięta karta, nowe pobranie) — nie ponawiamy.
      if (init.signal?.aborted) throw problem
      if (podejscie < podejscia) await new Promise((gotowe) => setTimeout(gotowe, 1500))
    }
  }

  if (!response) {
    if (ostatni?.name === "TimeoutError" || ostatni?.name === "AbortError") {
      throw new Error(
        `Medusa nie odpowiedziała w ${LIMIT_MS / 1000} s (${path.split("?")[0]}), ` +
          `mimo ${podejscia === 2 ? "dwóch prób" : "próby"}. ` +
          "Najczęstszy powód to nie awaria, tylko zajęta maszyna: build strony " +
          "(marinero-deploy.sh) potrafi na kilka minut zabrać procesor i pamięć " +
          "całemu serwerowi. Sprawdź kolejno: pgrep -af 'next build', " +
          "docker stats --no-stream, free -h."
      )
    }
    throw ostatni
  }

  const text = await response.text()
  const body = text ? safeJson(text) : {}

  if (!response.ok) {
    const message =
      body?.message || body?.error || `Medusa odpowiedziała ${response.status}`
    throw new Error(message)
  }

  return body
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 200) }
  }
}

export type AdminProduct = {
  id: string
  title: string
  handle: string
  description: string
  subtitle: string
  category: string
  thumbnail: string
  /** Propozycja opisu czekająca na zatwierdzenie (metadane produktu). */
  proposal: string
  metadata: Record<string, unknown>
}

const FIELDS =
  "id,title,handle,description,subtitle,thumbnail,+metadata,categories.id,categories.name"

function mapProduct(item: any): AdminProduct {
  const metadata = (item?.metadata || {}) as Record<string, unknown>
  return {
    id: item.id,
    title: item.title || "",
    handle: item.handle || "",
    description: item.description || "",
    subtitle: item.subtitle || "",
    category: item.categories?.[0]?.name || "",
    thumbnail: item.thumbnail || "",
    proposal: typeof metadata.opis_propozycja === "string" ? metadata.opis_propozycja : "",
    metadata,
  }
}

export async function listAdminProducts(options: {
  categoryId?: string
  query?: string
  limit?: number
  offset?: number
}): Promise<{ products: AdminProduct[]; count: number }> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
    fields: FIELDS,
    order: "title",
  })

  if (options.categoryId) params.append("category_id[]", options.categoryId)
  if (options.query) params.set("q", options.query)

  const body = await medusaAdmin(`/admin/products?${params.toString()}`)

  return {
    products: (body?.products || []).map(mapProduct),
    count: Number(body?.count) || 0,
  }
}

export async function updateAdminProduct(
  id: string,
  patch: { description?: string; metadata?: Record<string, unknown> }
): Promise<AdminProduct> {
  const body = await medusaAdmin(`/admin/products/${id}`, {
    method: "POST",
    body: JSON.stringify(patch),
  })
  return mapProduct(body?.product || {})
}

export async function listAdminCategories(): Promise<{ id: string; name: string; handle: string }[]> {
  const body = await medusaAdmin(
    "/admin/product-categories?limit=100&fields=id,name,handle"
  )
  return (body?.product_categories || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    handle: item.handle,
  }))
}


// — Zamówienia ze sklepu —
//
// Do tej pory zamówienia oglądało się wyłącznie w panelu Medusy: po angielsku,
// bez naszego stanu płatności z PayU i bez tego, co dopisujemy w metadanych.
// Panel ma je pokazywać tak, jak sprzedawca ich potrzebuje.
//
// Stan **obsługi** trzymamy w metadanych zamówienia (`obsluga`), a nie
// w polu `fulfillment_status` Medusy. Medusa liczy realizację przez osobne
// zasoby (fulfillments, shipments), zakładające magazyn i rezerwacje —
// czego tu nie prowadzimy. Metadane są dla nas źródłem prawdy w codziennej
// pracy, a `fulfillment_status` zostawiamy Medusie takim, jaki jest.
//
// Uwaga na metadane Medusy: **scalają się i nie da się skasować klucza** —
// `{"klucz": null}` zostawia klucz z wartością `null`. Dlatego wszędzie
// sprawdzamy wartość, nie samą obecność.

export const STANY_OBSLUGI = ["nowe", "w-realizacji", "wyslane", "anulowane"] as const
export type StanObslugi = (typeof STANY_OBSLUGI)[number]

export const OPISY_STANOW: Record<StanObslugi, string> = {
  nowe: "Nowe",
  "w-realizacji": "W realizacji",
  wyslane: "Wysłane",
  anulowane: "Anulowane",
}

export type AdminOrderItem = {
  id: string
  tytul: string
  wariant: string
  sku: string
  ile: number
  cena: number
  razem: number
  /** Adres produktu w sklepie — z migawki przy pozycji, więc działa i po zdjęciu towaru. */
  handle: string
}

export type AdminOrder = {
  id: string
  numer: string
  kiedy: string
  email: string
  klient: string
  telefon: string
  adres: string
  /** NIP albo VAT UE podany w zamówieniu — leży w metadanych koszyka. */
  nip: string
  /** Czy klient poprosił o fakturę (znacznik z kasy). */
  faktura: boolean
  /** Kod paczkomatu InPost, gdy klient wybrał taką dostawę. */
  paczkomat: string
  /** Adres paczkomatu opisem — sprzedawca nie musi go szukać po kodzie. */
  paczkomatAdres: string
  /** Adres dostawy rozbity na pola — do pokazania w panelu wiersz po wierszu. */
  adresPelny: {
    imie: string
    nazwisko: string
    firma: string
    ulica: string
    kod: string
    miasto: string
    kraj: string
    telefon: string
  } | null
  waluta: string
  razem: number
  dostawa: string
  dostawaKoszt: number
  /** Stan płatności widziany przez Medusę (`captured`, `not_paid`, …). */
  platnosc: string
  /** Nasz zapis z PayU — Medusa nie wie o płatnościach spoza swojego modułu. */
  payu: string
  oplacone: boolean
  realizacja: string
  obsluga: StanObslugi
  /** Czy poszedł mail z potwierdzeniem (znacznik z `potwierdzenie-zamowienia.ts`). */
  mailWyslany: boolean
  numerPrzesylki: string
  /** Klucz przewoźnika (`PRZEWOZNICY` w `przewoznicy.ts`) — do linku śledzenia. */
  przewoznikPrzesylki: string
  uwagi: string
  pozycje: AdminOrderItem[]
  metadata: Record<string, unknown>
}

const POLA_ZAMOWIENIA = [
  "id",
  "display_id",
  "status",
  "email",
  "currency_code",
  "total",
  "payment_status",
  "fulfillment_status",
  "created_at",
  "+metadata",
  "*items",
  "*shipping_methods",
  "*shipping_address",
].join(",")

function tekst(wartosc: unknown): string {
  return typeof wartosc === "string" ? wartosc : ""
}

function mapOrder(zam: any): AdminOrder {
  const meta = (zam?.metadata || {}) as Record<string, unknown>
  const adres = zam?.shipping_address || {}
  const payu = tekst(meta.payu_status)

  const obsluga = STANY_OBSLUGI.includes(tekst(meta.obsluga) as StanObslugi)
    ? (tekst(meta.obsluga) as StanObslugi)
    : "nowe"

  return {
    id: zam?.id || "",
    numer: String(zam?.display_id || zam?.id || ""),
    kiedy: zam?.created_at || "",
    email: zam?.email || "",
    klient: [adres.first_name, adres.last_name].filter(Boolean).join(" "),
    telefon: adres.phone || "",
    adres: [adres.address_1, [adres.postal_code, adres.city].filter(Boolean).join(" "), adres.country_code?.toUpperCase()]
      .filter(Boolean)
      .join(", "),
    nip: tekst(meta.vat_id) || tekst(meta.nip),
    // Fakturę poznajemy po znaczniku z kasy. Starsze zamówienia go nie mają,
    // więc uznajemy je za „na fakturę", gdy klient podał NIP albo firmę —
    // po to je wtedy podawał.
    faktura:
      meta.faktura === true ||
      (meta.faktura === undefined && Boolean(tekst(meta.vat_id) || adres.company)),
    paczkomat: tekst(meta.paczkomat),
    paczkomatAdres: tekst(meta.paczkomat_adres),
    adresPelny: zam?.shipping_address
      ? {
          imie: adres.first_name || "",
          nazwisko: adres.last_name || "",
          firma: adres.company || "",
          ulica: [adres.address_1, adres.address_2].filter(Boolean).join(", "),
          kod: adres.postal_code || "",
          miasto: adres.city || "",
          kraj: String(adres.country_code || "").toUpperCase(),
          telefon: adres.phone || "",
        }
      : null,
    waluta: (zam?.currency_code || "pln").toUpperCase(),
    razem: Number(zam?.total) || 0,
    dostawa: zam?.shipping_methods?.[0]?.name || "",
    dostawaKoszt: Number(zam?.shipping_methods?.[0]?.total) || 0,
    platnosc: zam?.payment_status || "",
    payu,
    // Zapłacone znaczy: albo Medusa pobrała płatność, albo PayU potwierdziło.
    // Samo `payu_order_id` nie wystarcza — zamówienie może być założone
    // w PayU i nieopłacone.
    oplacone: zam?.payment_status === "captured" || payu === "COMPLETED",
    realizacja: zam?.fulfillment_status || "",
    obsluga,
    mailWyslany: tekst(meta.mail_potwierdzenie) === "wyslany",
    numerPrzesylki: tekst(meta.przesylka_numer),
    przewoznikPrzesylki: tekst(meta.przesylka_przewoznik),
    uwagi: tekst(meta.uwagi_obslugi),
    pozycje: (zam?.items || []).map((p: any) => ({
      id: p.id,
      tytul: p.product_title || p.title || "",
      wariant: p.variant_title || "",
      sku: p.variant_sku || p.variant?.sku || "",
      ile: Number(p.quantity) || 0,
      cena: Number(p.unit_price) || 0,
      razem: Number(p.total) || 0,
      handle: p.product_handle || p.product?.handle || "",
    })),
    metadata: meta,
  }
}

export async function listAdminOrders(opcje: {
  limit?: number
  offset?: number
  query?: string
} = {}): Promise<{ zamowienia: AdminOrder[]; ile: number }> {
  const parametry = new URLSearchParams({
    limit: String(opcje.limit ?? 50),
    offset: String(opcje.offset ?? 0),
    order: "-created_at",
    fields: POLA_ZAMOWIENIA,
  })
  if (opcje.query) parametry.set("q", opcje.query)

  const body = await medusaAdmin(`/admin/orders?${parametry.toString()}`)

  return {
    zamowienia: (body?.orders || []).map(mapOrder),
    ile: Number(body?.count) || 0,
  }
}

export async function getAdminOrder(id: string): Promise<AdminOrder> {
  const body = await medusaAdmin(`/admin/orders/${id}?fields=${POLA_ZAMOWIENIA}`)
  return mapOrder(body?.order || {})
}

/**
 * Dopisuje do metadanych zamówienia. Medusa **scala** metadane, więc podajemy
 * tylko to, co zmieniamy — reszta zostaje nietknięta.
 */
export async function zmienMetadaneZamowienia(
  id: string,
  zmiany: Record<string, unknown>
): Promise<AdminOrder> {
  const body = await medusaAdmin(`/admin/orders/${id}`, {
    method: "POST",
    body: JSON.stringify({ metadata: zmiany }),
  })
  return mapOrder(body?.order || {})
}


// — Produkty: ceny, dostępność, EAN —
//
// Cena w Medusie 2 nie siedzi przy produkcie, tylko przy **wariancie**,
// i to w osobnym zbiorze cen (price set) na walutę. Produkt bez wariantów
// nie ma więc żadnej ceny — a u nas prawie każdy produkt ma dokładnie jeden
// wariant, bo po migracji z WooCommerce silnik czarny i biały to dwa osobne
// produkty, nie dwa warianty jednego.
//
// Dostępność i liczba sztuk to **metadane produktu** (`dostepnosc`, `sztuki`),
// nie stany magazynowe Medusy — sklep nie prowadzi magazynu, sprzedawca podaje
// termin wysyłki. Czyta je `src/lib/availability.ts`.

export type AdminWariant = {
  id: string
  tytul: string
  sku: string
  cena: number
  /** Identyfikator wpisu cenowego w złotych, gdy istnieje. */
  cenaId?: string
}

export type AdminProductRow = {
  id: string
  tytul: string
  handle: string
  kategoria: string
  zdjecie: string
  dostepnosc: string
  sztuki: number | null
  ean: string
  warianty: AdminWariant[]
  metadata: Record<string, unknown>
}

// Bierzemy `variants.prices` — **zapisaną** cenę ze zbioru cen wariantu, a nie
// `calculated_price`. To drugie jest ceną policzoną dla konkretnego regionu
// i waluty; bez pełnego kontekstu wyceny Medusa odbija zapytanie („Method
// calculatePrices requires currency_code in the pricing context"), a do
// edycji i tak chcemy widzieć to, co jest w bazie, nie wynik promocji.
const POLA_PRODUKTU =
  "id,title,handle,thumbnail,+metadata,categories.id,categories.name," +
  "variants.id,variants.title,variants.sku,*variants.prices"

function liczba(wartosc: unknown): number | null {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null
  const n = Number(wartosc)
  return Number.isFinite(n) ? n : null
}

function mapProductRow(item: any): AdminProductRow {
  const metadata = (item?.metadata || {}) as Record<string, unknown>

  return {
    id: item.id,
    tytul: item.title || "",
    handle: item.handle || "",
    kategoria: item.categories?.[0]?.name || "",
    zdjecie: item.thumbnail || "",
    dostepnosc: typeof metadata.dostepnosc === "string" ? metadata.dostepnosc : "",
    sztuki: liczba(metadata.sztuki),
    ean: typeof metadata.ean === "string" ? metadata.ean : "",
    warianty: (item.variants || []).map((w: any) => {
      const ceny = Array.isArray(w.prices) ? w.prices : []
      const pln = ceny.find((c: any) => String(c.currency_code).toLowerCase() === "pln")
      return {
        id: w.id,
        tytul: w.title || "",
        sku: w.sku || "",
        // Zapasowo `calculated_price`, gdyby kiedyś przyszło z kontekstem wyceny.
        cena: Number(pln?.amount ?? w.calculated_price?.calculated_amount) || 0,
        cenaId: pln?.id || "",
      }
    }),
    metadata,
  }
}

export async function listProductRows(opcje: {
  categoryId?: string
  query?: string
  limit?: number
  offset?: number
} = {}): Promise<{ produkty: AdminProductRow[]; ile: number }> {
  const parametry = new URLSearchParams({
    limit: String(opcje.limit ?? 50),
    offset: String(opcje.offset ?? 0),
    fields: POLA_PRODUKTU,
    order: "title",
  })
  if (opcje.categoryId) parametry.append("category_id[]", opcje.categoryId)
  if (opcje.query) parametry.set("q", opcje.query)

  const body = await medusaAdmin(`/admin/products?${parametry.toString()}`)

  return {
    produkty: (body?.products || []).map(mapProductRow),
    ile: Number(body?.count) || 0,
  }
}

/** Dostępność, liczba sztuk i EAN — wszystko trzy siedzi w metadanych produktu. */
export async function zmienMetadaneProduktu(
  id: string,
  zmiany: Record<string, unknown>
): Promise<AdminProductRow> {
  const body = await medusaAdmin(`/admin/products/${id}`, {
    method: "POST",
    body: JSON.stringify({ metadata: zmiany }),
  })
  return mapProductRow(body?.product || {})
}

/**
 * Zmiana ceny wariantu.
 *
 * Idzie przez **endpoint pojedynczego wariantu**, nie przez produkt. Aktualizacja
 * produktu przyjmuje tablicę `variants` i potrafi ją potraktować jak komplet —
 * czyli podanie jednego wariantu skasowałoby pozostałe. Przy produkcie z trzema
 * wersjami byłaby to strata nie do odtworzenia, a zysku z tego żadnego.
 *
 * Ceny podajemy w złotych — jednostka główna Medusy 2, ta sama, którą pokazuje
 * sklep (`formatPrice` nic nie dzieli).
 */
/**
 * Zmiana SKU wariantu.
 *
 * SKU łączy nasz produkt z ofertą na Allegro (`external.id`), więc sama jego
 * zmiana rozspójniłaby integrację — dlatego wołający **musi** przy okazji
 * poprawić sygnaturę oferty, jeśli produkt jakąś ma. Robi to `/api/admin/ceny`
 * w jednym zapisie: inaczej oferta zostałaby ze starym SKU i od następnego
 * pobrania wyglądałaby jak „na Allegro, ale nie u nas".
 */
export async function zmienSkuWariantu(
  produktId: string,
  wariantId: string,
  sku: string
): Promise<void> {
  await medusaAdmin(`/admin/products/${produktId}/variants/${wariantId}`, {
    method: "POST",
    body: JSON.stringify({ sku }),
  })
}

export async function zmienCeneWariantu(
  produktId: string,
  wariantId: string,
  cena: number
): Promise<void> {
  await medusaAdmin(`/admin/products/${produktId}/variants/${wariantId}`, {
    method: "POST",
    body: JSON.stringify({ prices: [{ amount: cena, currency_code: "pln" }] }),
  })
}


// — Pojedynczy produkt: edycja i zakładanie —

export type AdminProductPelny = {
  id: string
  tytul: string
  podtytul: string
  opis: string
  handle: string
  status: string
  miniatura: string
  zdjecia: { id: string; url: string }[]
  kategorie: string[]
  dostepnosc: string
  sztuki: number | null
  ean: string
  /**
   * Waga w **kilogramach** — do feedu produktowego Google (`g:shipping_weight`).
   * Przy migracji z WooCommerce wpisała się na wariant w Medusie, więc tu
   * pokazujemy to, co już jest, a zapis idzie do metadanej `waga`.
   */
  waga: number | null
  /** Parametry techniczne (moc, kolumna, sterowanie…) — patrz `parametry.ts`. */
  parametry: Record<string, string>
  /** Sugerowana cena detaliczna od dostawcy. */
  cenaDetaliczna: number | null
  /** Czy pokazujemy ją klientowi jako przekreśloną. */
  przekreslona: boolean
  /** Wyróżniony w sekcji „Wybrane produkty" na stronie głównej sklepu. */
  polecany: boolean
  /** Kolejność w tej sekcji — mniejsza liczba idzie pierwsza. */
  polecanyKolejnosc: number | null
  /** Historia cen sklepowych — źródło najniższej ceny z 30 dni. */
  historia: WpisHistorii[]
  /** Najniższa cena z 30 dni przed dzisiaj albo `null`, gdy brak historii. */
  najnizsza30: number | null
  warianty: AdminWariant[]
}

const POLA_PELNE =
  "id,title,subtitle,description,handle,status,thumbnail,+metadata," +
  "images.id,images.url,categories.id,categories.name," +
  "variants.id,variants.title,variants.sku,variants.weight,*variants.prices"

function mapProductPelny(item: any): AdminProductPelny {
  const metadata = (item?.metadata || {}) as Record<string, unknown>

  return {
    id: item.id,
    tytul: item.title || "",
    podtytul: item.subtitle || "",
    opis: item.description || "",
    handle: item.handle || "",
    status: item.status || "draft",
    miniatura: item.thumbnail || "",
    zdjecia: (item.images || []).map((z: any) => ({ id: z.id, url: z.url })),
    kategorie: (item.categories || []).map((k: any) => k.id),
    dostepnosc: typeof metadata.dostepnosc === "string" ? metadata.dostepnosc : "",
    sztuki: liczba(metadata.sztuki),
    ean: typeof metadata.ean === "string" ? metadata.ean : "",
    waga: wagaKg({ metadata, variants: item.variants || [] }),
    parametry: parametryZMetadanych(metadata),
    cenaDetaliczna: cenaDetaliczna(metadata),
    przekreslona: przekreslonaWlaczona(metadata),
    polecany: czyPolecany(metadata),
    polecanyKolejnosc: kolejnoscPolecanego(metadata),
    historia: historiaCen(metadata),
    najnizsza30: najnizszaZ30Dni(metadata),
    warianty: (item.variants || []).map((w: any) => {
      const ceny = Array.isArray(w.prices) ? w.prices : []
      const pln = ceny.find((c: any) => String(c.currency_code).toLowerCase() === "pln")
      return {
        id: w.id,
        tytul: w.title || "",
        sku: w.sku || "",
        cena: Number(pln?.amount) || 0,
        cenaId: pln?.id || "",
      }
    }),
  }
}

export async function pobierzProdukt(id: string): Promise<AdminProductPelny> {
  const body = await medusaAdmin(`/admin/products/${id}?fields=${POLA_PELNE}`)
  return mapProductPelny(body?.product || {})
}

export async function zapiszProdukt(
  id: string,
  zmiany: {
    tytul?: string
    podtytul?: string
    opis?: string
    handle?: string
    status?: string
    miniatura?: string
    zdjecia?: string[]
    kategorie?: string[]
    metadata?: Record<string, unknown>
  }
): Promise<AdminProductPelny> {
  const patch: Record<string, unknown> = {}

  if (zmiany.tytul !== undefined) patch.title = zmiany.tytul
  if (zmiany.podtytul !== undefined) patch.subtitle = zmiany.podtytul
  if (zmiany.opis !== undefined) patch.description = zmiany.opis
  if (zmiany.handle !== undefined) patch.handle = zmiany.handle
  if (zmiany.status !== undefined) patch.status = zmiany.status
  if (zmiany.miniatura !== undefined) patch.thumbnail = zmiany.miniatura
  if (zmiany.metadata) patch.metadata = zmiany.metadata

  // Zdjęcia i kategorie Medusa traktuje jak **komplet**: wysyłamy pełną listę,
  // bo podanie części skasowałoby resztę. To jest różnica wobec metadanych,
  // które się scalają — łatwo się na tym przejechać.
  if (zmiany.zdjecia) patch.images = zmiany.zdjecia.map((url) => ({ url }))
  if (zmiany.kategorie) patch.categories = zmiany.kategorie.map((id) => ({ id }))

  const body = await medusaAdmin(`/admin/products/${id}`, {
    method: "POST",
    body: JSON.stringify(patch),
  })
  return mapProductPelny(body?.product || {})
}

/**
 * Domyślny kanał sprzedaży i profil wysyłki.
 *
 * Produkt **niepodpięty do kanału sprzedaży nie pokazuje się w sklepie** —
 * Store API filtruje po kanale i nowy towar po prostu znika, mimo że w panelu
 * Medusy wygląda poprawnie. Profil wysyłki jest z kolei wymagany przy
 * zakładaniu produktu. Oba pobieramy sami, żeby sprzedawca nie musiał znać
 * żadnych identyfikatorów.
 */
async function ustawieniaSklepu(): Promise<{ kanal: string; profil: string }> {
  const [kanal, profile] = await Promise.all([
    kanalSklepu(),
    medusaAdmin("/admin/shipping-profiles?limit=1&fields=id").catch(() => null),
  ])

  return { kanal, profil: profile?.shipping_profiles?.[0]?.id || "" }
}

/**
 * Kanał sprzedaży, z którego **naprawdę czyta sklep**.
 *
 * Wcześniej braliśmy pierwszy kanał, jaki oddała Medusa — a to jest „Default
 * Sales Channel", instalacyjny kanał, do którego nie zagląda nic. Produkt
 * założony z panelu lądował w nim i po prostu **nie pokazywał się w sklepie**:
 * Store API filtruje po kanale przypiętym do klucza publikowalnego, więc towar
 * znikał, choć w panelu Medusy wyglądał poprawnie. Tak zniknął silnik
 * DF 300 BMDXX i tak zniknąłby każdy następny.
 *
 * Pytamy więc **klucza publikowalnego, którym front rozmawia ze sklepem**,
 * o jego kanały: to jest ta sama droga, którą idzie prawdziwy klient, więc
 * odpowiedź nie może się rozjechać z rzeczywistością. Wynik pamiętamy —
 * kanał zmienia się raz na nigdy, a przy każdym zakładaniu produktu to dwa
 * dodatkowe żądania.
 */
let zapamietanyKanal = ""

async function kanalSklepu(): Promise<string> {
  if (zapamietanyKanal) return zapamietanyKanal

  const klucz = MEDUSA_KEY
  if (klucz) {
    const klucze = await medusaAdmin(
      "/admin/api-keys?type=publishable&limit=50&fields=id,token,*sales_channels"
    ).catch(() => null)

    const nasz = (klucze?.api_keys || []).find(
      (wpis: { token?: string }) => wpis?.token === klucz
    )
    const zKlucza = nasz?.sales_channels?.[0]?.id
    if (zKlucza) {
      zapamietanyKanal = zKlucza
      return zapamietanyKanal
    }
  }

  // Klucz mógł nie mieć podpiętego kanału albo Medusa mogła nie odpowiedzieć.
  // Wtedy bierzemy **pierwszy kanał, który nie jest domyślnym** — nazwa
  // „Default Sales Channel" jest instalacyjna i Medusa nadaje ją sama.
  const kanaly = await medusaAdmin("/admin/sales-channels?limit=50&fields=id,name").catch(
    () => null
  )
  const lista: { id: string; name?: string }[] = kanaly?.sales_channels || []
  const wlasny = lista.find((wpis) => !/^default sales channel$/i.test(wpis.name || ""))

  zapamietanyKanal = wlasny?.id || lista[0]?.id || ""
  return zapamietanyKanal
}

export async function zalozProdukt(dane: {
  tytul: string
  handle: string
  opis: string
  sku: string
  cena: number
  kategoria: string
  dostepnosc: string
  ean: string
  parametry: Record<string, string>
  miniatura: string
  opublikuj: boolean
}): Promise<{ id: string }> {
  const { kanal, profil } = await ustawieniaSklepu()

  const body: Record<string, unknown> = {
    title: dane.tytul,
    handle: dane.handle || undefined,
    description: dane.opis || undefined,
    status: dane.opublikuj ? "published" : "draft",
    thumbnail: dane.miniatura || undefined,
    images: dane.miniatura ? [{ url: dane.miniatura }] : undefined,
    metadata: {
      ...(dane.dostepnosc ? { dostepnosc: dane.dostepnosc } : {}),
      ...(dane.ean ? { ean: dane.ean } : {}),
      ...dane.parametry,
    },
    // Jeden wariant, bo tak wygląda cały nasz katalog po migracji
    // z WooCommerce: silnik czarny i biały to dwa produkty, nie dwa warianty.
    options: [{ title: "Wersja", values: ["Standard"] }],
    variants: [
      {
        title: "Standard",
        sku: dane.sku || undefined,
        options: { Wersja: "Standard" },
        prices: [{ amount: dane.cena, currency_code: "pln" }],
        manage_inventory: false,
      },
    ],
    ...(dane.kategoria ? { categories: [{ id: dane.kategoria }] } : {}),
    ...(kanal ? { sales_channels: [{ id: kanal }] } : {}),
    ...(profil ? { shipping_profile_id: profil } : {}),
  }

  const wynik = await medusaAdmin("/admin/products", {
    method: "POST",
    body: JSON.stringify(body),
  })

  return { id: wynik?.product?.id || "" }
}

/** Wgranie pliku do Medusy. Pole nazywa się `files` — inne nazwy wracają z 400. */
export async function wgrajZdjecie(plik: File): Promise<string> {
  const token = adminToken()
  if (!token) throw new Error("Brak klucza do Medusy.")

  const dane = new FormData()
  dane.append("files", plik)

  const odpowiedz = await fetch(`${MEDUSA_URL}/admin/uploads`, {
    method: "POST",
    headers: { Authorization: authHeader() },
    body: dane,
  })

  if (!odpowiedz.ok) {
    throw new Error(`Medusa odrzuciła plik (${odpowiedz.status})`)
  }

  const wynik = await odpowiedz.json()
  const url = wynik?.files?.[0]?.url || wynik?.uploads?.[0]?.url || ""
  if (!url) throw new Error("Medusa nie oddała adresu wgranego pliku.")
  return url
}
