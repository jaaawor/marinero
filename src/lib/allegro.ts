// Klient REST API Allegro — tyle, ile potrzeba do synchronizacji cen i stanów.
//
// Allegro wymaga tokenu użytkownika (zgoda właściciela konta sprzedażowego).
// Ścieżka: raz przechodzimy „device flow", zapisujemy refresh token w env
// (`ALLEGRO_REFRESH_TOKEN`), a potem odświeżamy go przy każdej synchronizacji.
// Bez kompletu zmiennych funkcje zwracają `null` i synchronizacja idzie
// w tryb podglądu — nic nie wysyła.

import { pobierzRefreshToken, zapiszRefreshToken } from "@/lib/allegro-token"
import { WIDOKI_ZAMOWIEN } from "@/lib/allegro-widoki"

const AUTH_URL = "https://allegro.pl/auth/oauth"
const API_URL = "https://api.allegro.pl"

// Allegro wymaga, żeby integracja się przedstawiała. Bez tego nagłówka część
// zapytań wraca z błędem, a przy przekroczeniu limitów nie mają jak nas
// namierzyć — i wtedy blokują całe konto, a nie jedną integrację.
const UA = process.env.ALLEGRO_USER_AGENT || "marinero-sklep/1 (+marinero.pl)"

/**
 * Ograniczenie czasu jednego żądania do Allegro.
 *
 * `fetch` nie ma własnego limitu — zawieszone połączenie czekałoby bez końca
 * i zatrzymywałoby cały panel cen w połowie paska postępu.
 */
const LIMIT_MS = 20_000

export type AllegroConfig = {
  clientId: string
  clientSecret: string
  /** Zostaje dla zgodności — token bierzemy z `allegro-token.ts`, nie stąd. */
  refreshToken: string
}

export function readAllegroConfig(): AllegroConfig | null {
  const clientId = process.env.ALLEGRO_CLIENT_ID
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET

  // Refresh tokenu nie sprawdzamy tutaj: leży w Directusie i zmienia się przy
  // każdej wymianie. Wystarczy para kluczy aplikacji, żeby uznać Allegro za
  // podpięte — brak samego tokenu zgłosi dopiero próba wymiany, z komunikatem
  // mówiącym, co zrobić.
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, refreshToken: "" }
}

// Token dostępowy żyje 12 godzin, więc trzymamy go w pamięci procesu i sięgamy
// po refresh raz na pół doby. To nie jest optymalizacja, tylko warunek
// działania: każda wymiana unieważnia poprzedni refresh token, a dwa zapytania
// wymieniające go równocześnie unieważniłyby go sobie nawzajem.
let wPamieci: { token: string; wygasa: number } | null = null
let wTrakcie: Promise<string> | null = null

async function accessToken(config: AllegroConfig): Promise<string> {
  if (wPamieci && wPamieci.wygasa > Date.now()) return wPamieci.token
  if (wTrakcie) return wTrakcie

  wTrakcie = (async () => {
    const refresh = await pobierzRefreshToken()
    if (!refresh) {
      throw new Error(
        "Brak refresh tokenu Allegro. Przejdź autoryzację: node --env-file=.env.local scripts/allegro/autoryzuj.mjs"
      )
    }

    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")

    const response = await fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
      cache: "no-store",
      signal: AbortSignal.timeout(LIMIT_MS),
    })

    if (!response.ok) {
      const tresc = await response.text()
      // Nie wypisujemy treści odpowiedzi: Allegro wkleja w nią cały odrzucony
      // token, a ten komunikat trafia na ekran panelu.
      if (/invalid_grant/.test(tresc)) {
        throw new Error(
          "Allegro odrzuciło refresh token — został już zużyty albo wygasł. " +
            "Przejdź autoryzację od nowa: node --env-file=.env.local scripts/allegro/autoryzuj.mjs"
        )
      }
      throw new Error(`Allegro auth: ${response.status}`)
    }

    const data = await response.json()

    // Allegro unieważnia stary refresh token przy każdej wymianie i oddaje
    // nowy. Zapis jest tu warunkiem działania, nie usprawnieniem: bez niego
    // następne zapytanie dostanie `invalid_grant`.
    if (data.refresh_token) await zapiszRefreshToken(data.refresh_token)

    // Minuta zapasu, żeby nie trafić w token wygasający w locie.
    const zycie = (Number(data.expires_in) || 3600) * 1000 - 60_000
    wPamieci = { token: data.access_token, wygasa: Date.now() + Math.max(60_000, zycie) }

    return data.access_token as string
  })()

  try {
    return await wTrakcie
  } finally {
    wTrakcie = null
  }
}

async function api(
  config: AllegroConfig,
  path: string,
  init: RequestInit = {},
  token?: string
) {
  const bearer = token || (await accessToken(config))

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": UA,
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(LIMIT_MS),
    })
  } catch (problem: any) {
    if (problem?.name === "TimeoutError" || problem?.name === "AbortError") {
      throw new Error(`Allegro nie odpowiedziało w ${LIMIT_MS / 1000} s (${path.split("?")[0]}).`)
    }
    throw problem
  }

  if (!response.ok) {
    throw new Error(`Allegro ${path}: ${response.status} ${(await response.text()).slice(0, 300)}`)
  }

  return response.json()
}

export type AllegroOffer = {
  id: string
  name: string
  /** Sygnatura sprzedawcy — po niej łączymy ofertę z produktem w Medusie. */
  signature: string
  price: number
  stock: number
}

/** Pobiera oferty sprzedawcy (wszystkie strony). */
export async function listOffers(
  config: AllegroConfig,
  /** Wołane po każdej stronie — panel pokazuje z tego pasek postępu. */
  onPostep?: (pobrane: number, wszystkie: number) => void
): Promise<AllegroOffer[]> {
  const token = await accessToken(config)
  const offers: AllegroOffer[] = []
  let offset = 0

  for (;;) {
    const data = await api(
      config,
      `/sale/offers?limit=100&offset=${offset}`,
      { method: "GET" },
      token
    )

    for (const offer of data.offers || []) {
      offers.push({
        id: offer.id,
        name: offer.name,
        signature: offer.external?.id || "",
        price: Number(offer.sellingMode?.price?.amount) || 0,
        stock: Number(offer.stock?.available) || 0,
      })
    }

    offset += 100
    onPostep?.(offers.length, Number(data.totalCount) || offers.length)
    if (offset >= (data.totalCount || 0)) break
  }

  return offers
}

/**
 * EAN (GTIN) pojedynczej oferty.
 *
 * Lista ofert (`/sale/offers`) **nie niesie EAN-u** — jest w szczegółach,
 * i to w kilku możliwych miejscach zależnie od tego, czy oferta jest wpięta
 * w kartę produktu Allegro, czy stoi samodzielnie: raz przy produkcie, raz
 * jako parametr o nazwie „EAN (GTIN)". Szukamy we wszystkich, zamiast zgadywać
 * jedno — a że wynik zapisujemy u siebie (`allegro-ean.ts`), każdą ofertę
 * pytamy o to **raz**, nie przy każdym wejściu w zakładkę.
 *
 * Nieudane pytanie nie jest awarią: oferta po prostu zostaje bez EAN-u.
 */
export async function offerEan(config: AllegroConfig, offerId: string): Promise<string> {
  const token = await accessToken(config)

  const dane = await api(config, `/sale/product-offers/${offerId}`, { method: "GET" }, token).catch(
    () => null
  )
  if (!dane) return ""

  return szukajEan(dane)
}

/** Trzynaście albo osiem cyfr — tyle ma EAN-13 i EAN-8. */
function czyEan(wartosc: unknown): boolean {
  const tekst = String(wartosc || "").replace(/\s/g, "")
  return /^\d{8}$|^\d{12,14}$/.test(tekst)
}

/**
 * Przechodzi odpowiedź wszerz i wyjmuje pierwszą wartość, która wygląda na EAN,
 * z pola o nazwie mówiącej o EAN-ie albo GTIN-ie. Wybieranie po nazwie pola,
 * a nie po samym kształcie liczby, jest tu konieczne: identyfikatory ofert
 * i produktów Allegro to też ciągi cyfr.
 */
function szukajEan(korzen: unknown): string {
  const doOdwiedzenia: unknown[] = [korzen]
  let odwiedzone = 0

  while (doOdwiedzenia.length && odwiedzone < 5000) {
    const wezel = doOdwiedzenia.shift()
    odwiedzone++
    if (!wezel || typeof wezel !== "object") continue

    if (Array.isArray(wezel)) {
      doOdwiedzenia.push(...wezel)
      continue
    }

    const obiekt = wezel as Record<string, unknown>

    // Parametr oferty: { name: "EAN (GTIN)", values: ["5901234123457"] }
    const nazwa = String(obiekt.name || "").toLowerCase()
    if (/ean|gtin/.test(nazwa)) {
      const wartosci = Array.isArray(obiekt.values) ? obiekt.values : []
      const trafiona = wartosci.find(czyEan)
      if (trafiona) return String(trafiona).replace(/\s/g, "")
    }

    // Pole wprost: product.ean / product.gtin
    for (const klucz of ["ean", "gtin", "gtin13", "barcode"]) {
      if (czyEan(obiekt[klucz])) return String(obiekt[klucz]).replace(/\s/g, "")
    }

    doOdwiedzenia.push(...Object.values(obiekt))
  }

  return ""
}

/**
 * Zmienia cenę, stan albo **sygnaturę** pojedynczej oferty.
 *
 * Sygnatura (`external.id`) to jedyne, co łączy ofertę z produktem w sklepie.
 * Dlatego da się ją ustawić stąd: oferta wystawiona bez niej wypada
 * z zestawienia cen i z synchronizacji, a szukanie jej w panelu Allegro
 * i przepisywanie SKU ręcznie to robota, przy której łatwo o literówkę —
 * a literówka wygląda dokładnie tak samo jak brak oferty.
 */
export async function updateOffer(
  config: AllegroConfig,
  offerId: string,
  changes: { price?: number; stock?: number; sygnatura?: string },
  token?: string
) {
  const body: Record<string, unknown> = {}
  if (typeof changes.price === "number") {
    body.sellingMode = { price: { amount: changes.price.toFixed(2), currency: "PLN" } }
  }
  if (typeof changes.stock === "number") {
    body.stock = { available: changes.stock }
  }
  if (typeof changes.sygnatura === "string") {
    body.external = { id: changes.sygnatura }
  }

  return api(config, `/sale/product-offers/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, token)
}


// — Zamówienia —
//
// Zamówienie na Allegro to „checkout form". Sprzedawca prowadzi je przez trzy
// rzeczy: **stan realizacji** (`fulfillment`), **przesyłkę** (numer listu
// przewozowego) i ewentualne anulowanie. Płatność i zwroty prowadzi Allegro,
// my ich nie ruszamy.

export type AllegroPozycja = {
  id: string
  nazwa: string
  /** Sygnatura sprzedawcy z oferty — łączy pozycję z produktem w Medusie. */
  sygnatura: string
  ile: number
  cena: number
}

export type AllegroZamowienie = {
  id: string
  numer: string
  zlozone: string
  /** Stan realizacji: NEW, PROCESSING, READY_FOR_SHIPMENT, SENT, PICKED_UP, CANCELLED… */
  stan: string
  /** Czy zapłacone — po tym poznajemy, co wolno wysłać. */
  oplacone: boolean
  kwota: number
  kupujacy: { login: string; imie: string; email: string }
  dostawa: { nazwa: string; adres: string; punkt: string }
  /** Rynek, na którym zamówienie zostało złożone: `allegro-pl`, `allegro-cz`… */
  rynek: string
  /**
   * Stan **formularza zakupu**: `BOUGHT` (kupione, formularz jeszcze
   * niewypełniony), `FILLED_IN` (wypełniony, czeka na płatność),
   * `READY_FOR_PROCESSING` (gotowe do obsługi). To co innego niż `stan`,
   * który mówi o realizacji.
   */
  formularz: string
  pozycje: AllegroPozycja[]
}


function adresDostawy(dostawa: any): { nazwa: string; adres: string; punkt: string } {
  const adres = dostawa?.address
  const linie = [
    adres?.street,
    [adres?.zipCode, adres?.city].filter(Boolean).join(" "),
  ].filter(Boolean)

  return {
    nazwa: dostawa?.method?.name || "",
    adres: linie.join(", "),
    // Przy paczkomacie i punkcie odbioru adres kupującego jest pusty, a liczy
    // się identyfikator punktu — bez niego przesyłki nie da się nadać.
    punkt: dostawa?.pickupPoint?.id || "",
  }
}

function naZamowienie(form: any): AllegroZamowienie {
  return {
    id: String(form.id),
    numer: String(form.id).slice(0, 8),
    zlozone: form.updatedAt || form.boughtAt || "",
    stan: form.fulfillment?.status || "NEW",
    // Allegro oznacza opłacenie osobno od stanu realizacji — zamówienie
    // nieopłacone potrafi wisieć tygodniami i nie wolno go wysłać.
    oplacone: form.payment?.finishedAt ? true : false,
    kwota: Number(form.summary?.totalToPay?.amount) || 0,
    kupujacy: {
      login: form.buyer?.login || "",
      imie: [form.buyer?.firstName, form.buyer?.lastName].filter(Boolean).join(" "),
      email: form.buyer?.email || "",
    },
    dostawa: adresDostawy(form.delivery),
    // Starsze zamówienia i konta bez rynków zagranicznych nie mają tego pola —
    // wtedy zostaje puste i filtr rynku po prostu ich nie zawęża.
    rynek: form.marketplace?.id || "",
    formularz: form.status || "",
    pozycje: (form.lineItems || []).map((pozycja: any) => ({
      id: String(pozycja.id),
      nazwa: pozycja.offer?.name || "",
      sygnatura: pozycja.offer?.external?.id || "",
      ile: Number(pozycja.quantity) || 0,
      cena: Number(pozycja.price?.amount) || 0,
    })),
  }
}

// Widoki listy i nazwy rynków siedzą w `allegro-widoki.ts` — czyta je też
// panel w przeglądarce, a tego pliku wciągać tam nie wolno.
export { RYNKI, WIDOKI_ZAMOWIEN, nazwaRynku } from "@/lib/allegro-widoki"
export type { KluczWidoku } from "@/lib/allegro-widoki"

/** Ile stron po 100 pobieramy najwyżej — przy „Wszystkie" jest ich kilkaset. */
const MAKS_STRON = 3

/**
 * Zamówienia sprzedawcy, od najnowszych.
 *
 * Filtr stanu realizacji próbujemy nałożyć **po stronie Allegro** — wtedy
 * jedna strona wystarcza na cały widok. Gdyby konto tego parametru nie
 * przyjęło, powtarzamy zapytanie bez niego i filtrujemy u siebie: lepiej
 * pobrać za dużo i odsiać, niż pokazać sprzedawcy pustą listę.
 *
 * Rynek filtrujemy **zawsze u siebie**. Zamówienia przychodzą ze wszystkich
 * rynków Allegro naraz i tak ma zostać — kolumna „Rynek" mówi, skąd które
 * przyszło, a filtr tylko zawęża widok.
 */
export async function listOrders(
  config: AllegroConfig,
  opcje: { widok?: string; rynek?: string; limit?: number } = {}
): Promise<{ zamowienia: AllegroZamowienie[]; rynki: string[]; wiecej: boolean }> {
  const widok =
    WIDOKI_ZAMOWIEN.find((w) => w.klucz === opcje.widok) || WIDOKI_ZAMOWIEN[0]
  const realizacja: string[] = [...widok.realizacja]

  const limit = Math.min(opcje.limit || 100, 100)
  const token = await accessToken(config)

  async function strona(offset: number, zFiltrem: boolean) {
    const parametry = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    // **Nie tylko `READY_FOR_PROCESSING`.** Wcześniej stał tu sam ten stan
    // i świeże zamówienia w ogóle nie docierały do panelu: Allegro nadaje
    // formularzowi `BOUGHT` w chwili zakupu, `FILLED_IN` po wypełnieniu
    // danych i dopiero potem `READY_FOR_PROCESSING`. Wczorajsze były więc
    // widoczne, a dzisiejsze — te, przy których kupujący jeszcze nie zapłacił
    // albo nie dokończył formularza — znikały. Dla sprzedawcy to są prawdziwe
    // zamówienia, tylko takie, których **nie wolno jeszcze wysłać**; panel
    // podpisuje je wprost. `CANCELLED` nie pobieramy w ogóle.
    for (const stan of ["BOUGHT", "FILLED_IN", "READY_FOR_PROCESSING"]) {
      parametry.append("status", stan)
    }
    if (zFiltrem) {
      for (const stan of realizacja) parametry.append("fulfillment.status", stan)
    }
    return api(config, `/order/checkout-forms?${parametry}`, { method: "GET" }, token)
  }

  let zFiltrem = realizacja.length > 0
  let pierwsza: any
  try {
    pierwsza = await strona(0, zFiltrem)
  } catch (problem) {
    if (!zFiltrem) throw problem
    // Konto nie przyjęło filtra — pobieramy wszystko i odsiewamy u siebie.
    zFiltrem = false
    pierwsza = await strona(0, false)
  }

  const formularze: any[] = [...(pierwsza.checkoutForms || [])]
  const wszystkich = Number(pierwsza.totalCount) || formularze.length

  for (let numer = 1; numer < MAKS_STRON && numer * limit < wszystkich; numer += 1) {
    const kolejna = await strona(numer * limit, zFiltrem)
    formularze.push(...(kolejna.checkoutForms || []))
  }

  let zamowienia = formularze.map(naZamowienie)

  // Zestaw rynków liczymy **przed** zawężeniem, żeby filtr nie skasował sam
  // sobie pozycji do wyboru.
  const rynki = Array.from(new Set(zamowienia.map((z) => z.rynek).filter(Boolean))).sort()

  if (!zFiltrem && realizacja.length) {
    zamowienia = zamowienia.filter((z) => realizacja.includes(z.stan))
  }
  if (opcje.rynek) {
    zamowienia = zamowienia.filter((z) => z.rynek === opcje.rynek)
  }

  return { zamowienia, rynki, wiecej: wszystkich > MAKS_STRON * limit }
}

export async function getOrder(config: AllegroConfig, id: string): Promise<AllegroZamowienie> {
  return naZamowienie(await api(config, `/order/checkout-forms/${id}`, { method: "GET" }))
}

/** Stany realizacji, które Allegro przyjmuje od sprzedawcy. */
export const STANY_REALIZACJI = [
  "NEW",
  "PROCESSING",
  "READY_FOR_SHIPMENT",
  "READY_FOR_PICKUP",
  "SENT",
  "PICKED_UP",
  "CANCELLED",
] as const

export type StanRealizacji = (typeof STANY_REALIZACJI)[number]

/**
 * Zmiana stanu realizacji. To jest to, co kupujący widzi u siebie w „Moich
 * zakupach" — dlatego „wysłane" ustawiamy dopiero razem z numerem przesyłki,
 * a nie z góry.
 */
export async function setFulfillment(
  config: AllegroConfig,
  id: string,
  stan: StanRealizacji,
  token?: string
) {
  return api(
    config,
    `/order/checkout-forms/${id}/fulfillment`,
    { method: "PUT", body: JSON.stringify({ status: stan }) },
    token
  )
}

/** Przewoźnicy rozpoznawani przez Allegro — do wyboru przy numerze przesyłki. */
export async function listCarriers(config: AllegroConfig): Promise<{ id: string; nazwa: string }[]> {
  const dane = await api(config, "/order/carriers", { method: "GET" })
  return (dane.carriers || []).map((p: any) => ({ id: p.id, nazwa: p.name || p.id }))
}

/**
 * Numer listu przewozowego przy zamówieniu. Allegro pokazuje go kupującemu
 * i samo śledzi przesyłkę, więc nie musimy nic dopisywać w wiadomości.
 */
export async function addShipment(
  config: AllegroConfig,
  id: string,
  przesylka: { przewoznik: string; numer: string; nadane?: string },
  token?: string
) {
  return api(
    config,
    `/order/checkout-forms/${id}/shipments`,
    {
      method: "POST",
      body: JSON.stringify({
        carrierId: przesylka.przewoznik,
        waybill: przesylka.numer,
        // Bez daty Allegro wstawia „teraz", ale przy nadaniu wstecz warto ją podać.
        ...(przesylka.nadane ? { createdAt: przesylka.nadane } : {}),
      }),
    },
    token
  )
}
