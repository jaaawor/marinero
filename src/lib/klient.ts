import { cookies } from "next/headers"
import { MEDUSA_KEY, MEDUSA_URL } from "@/lib/medusa"

/**
 * Konta klientów sklepu.
 *
 * Token logowania (JWT z Medusy) trzymamy w ciasteczku **`httpOnly`**, którego
 * JavaScript na stronie nie widzi. Do przeglądarki nie trafia nic, czym dałoby
 * się podszyć pod klienta po wykradzeniu skryptem z obcej reklamy.
 *
 * Konta są **dodatkiem, nie warunkiem zakupu**. Sklep działał i dalej działa
 * bez logowania — kasa dla gościa zostaje dokładnie taka, jaka była, bo
 * przerabianie działającej ścieżki zakupowej na produkcji, po to żeby dołożyć
 * wygodę, to zła zamiana.
 */

const CIASTECZKO = "marinero_klient"
const TRZYDZIESCI_DNI = 30 * 24 * 60 * 60

export type Klient = {
  id: string
  email: string
  imie: string
  nazwisko: string
  telefon: string
}

export type PozycjaZamowienia = {
  tytul: string
  wariant: string
  ile: number
  cena: number
  razem: number
  /** Adres produktu w sklepie — pusty, gdy produktu już nie ma. */
  handle: string
  zdjecie: string
}

export type Zamowienie = {
  id: string
  numer: string
  kiedy: string
  suma: number
  /** Rozbicie kwoty: pozycje, dostawa, rabat. */
  sumaPozycji: number
  dostawaKoszt: number
  rabat: number
  waluta: string
  stan: string
  oplacone: boolean
  /** Jak Medusa widzi płatność (`captured`, `not_paid`…). */
  platnosc: string
  /** Nasz stan obsługi z panelu (`nowe` / `w-realizacji` / `wyslane` / `anulowane`). */
  obsluga: string
  numerPrzesylki: string
  przewoznik: string
  /** Sposób dostawy wybrany w zamówieniu. */
  dostawa: string
  adres: {
    imie: string
    nazwisko: string
    ulica: string
    kod: string
    miasto: string
    kraj: string
    telefon: string
    firma: string
  } | null
  nip: string
  pozycje: PozycjaZamowienia[]
}

async function store(sciezka: string, init: RequestInit = {}, token?: string) {
  return fetch(`${MEDUSA_URL}${sciezka}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": MEDUSA_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    // Gdy Medusa nie odpowiada, chcemy błąd, a nie ciszę: bez ograniczenia
    // czasu żądanie wisi, aż ubije je serwer pośredniczący, a wtedy do
    // przeglądarki wraca strona błędu zamiast naszej odpowiedzi i formularz
    // nie ma czego pokazać.
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  })
}

export async function zapiszToken(token: string) {
  const magazyn = await cookies()
  magazyn.set(CIASTECZKO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: TRZYDZIESCI_DNI,
  })
}

export async function wyczyscToken() {
  const magazyn = await cookies()
  magazyn.delete(CIASTECZKO)
}

export async function tokenKlienta(): Promise<string> {
  return (await cookies()).get(CIASTECZKO)?.value || ""
}

/** Zalogowany klient albo `null`. Każde wywołanie sprawdza token w Medusie. */
export async function zalogowanyKlient(): Promise<Klient | null> {
  const token = await tokenKlienta()
  if (!token) return null

  const odpowiedz = await store("/store/customers/me", { method: "GET" }, token)
  if (!odpowiedz.ok) return null

  const klient = (await odpowiedz.json())?.customer
  if (!klient?.id) return null

  return {
    id: klient.id,
    email: klient.email || "",
    imie: klient.first_name || "",
    nazwisko: klient.last_name || "",
    telefon: klient.phone || "",
  }
}

export async function zaloguj(email: string, haslo: string): Promise<string | null> {
  const odpowiedz = await store("/auth/customer/emailpass", {
    method: "POST",
    body: JSON.stringify({ email, password: haslo }),
  })
  if (!odpowiedz.ok) return null
  return (await odpowiedz.json())?.token || null
}

export type WynikRejestracji = { token?: string; blad?: string }

export async function zarejestruj(dane: {
  email: string
  haslo: string
  imie: string
  nazwisko: string
  telefon: string
}): Promise<WynikRejestracji> {
  const rejestracja = await store("/auth/customer/emailpass/register", {
    method: "POST",
    body: JSON.stringify({ email: dane.email, password: dane.haslo }),
  })

  if (!rejestracja.ok) {
    const tresc = await rejestracja.text()
    // Medusa nie mówi wprost „adres zajęty", a to jedyny błąd, który klient
    // może sam naprawić — więc rozpoznajemy go i tłumaczymy na polski.
    if (/exists|already/i.test(tresc)) {
      return { blad: "Konto na ten adres już istnieje. Zaloguj się albo użyj innego adresu." }
    }
    return { blad: "Nie udało się założyć konta. Spróbuj ponownie za chwilę." }
  }

  const token = (await rejestracja.json())?.token
  if (!token) return { blad: "Medusa nie oddała tokenu rejestracji." }

  // Drugi krok: dane klienta. Rejestracja zakłada samo logowanie, profil
  // powstaje osobno — bez tego kroku konto istnieje, ale jest puste.
  const profil = await store(
    "/store/customers",
    {
      method: "POST",
      body: JSON.stringify({
        email: dane.email,
        first_name: dane.imie,
        last_name: dane.nazwisko,
        phone: dane.telefon,
      }),
    },
    token
  )

  if (!profil.ok) {
    return {
      blad:
        "Konto powstało, ale nie udało się zapisać danych. Napisz do nas na biuro@marinero.pl — " +
        "poprawimy je ręcznie.",
    }
  }

  // Trzeci krok: **logowanie**. Token z rejestracji ma puste `actor_id` — nie
  // jest jeszcze związany z klientem, więc `/store/customers/me` odbija go
  // z 401. Zapisanie go w ciasteczku dałoby konto, do którego nie da się wejść.
  // Dopiero token z logowania niesie identyfikator klienta.
  const zalogowany = await zaloguj(dane.email, dane.haslo)
  if (!zalogowany) return { blad: "Konto powstało. Zaloguj się, żeby wejść do panelu." }

  return { token: zalogowany }
}

/**
 * Prośba o reset hasła.
 *
 * Medusa przyjmuje zgłoszenie (201) i **nie oddaje tokenu** — wysyła zdarzenie
 * `auth.password_reset` wewnątrz swojego kontenera. Token trafia do nas dopiero
 * przez subskrybenta po stronie Medusy, który woła `/api/konto/reset-mail`
 * (gotowy plik i instrukcja: `deploy/medusa/reset-hasla/`). Dopóki tego
 * subskrybenta nie ma, zgłoszenie po prostu nie kończy się mailem.
 *
 * Odpowiedź jest **zawsze taka sama**, niezależnie od tego, czy konto istnieje:
 * inaczej formularz odpowiadałby na pytanie „czy ten adres ma u was konto",
 * a to jest wyciek dla każdego, kto ma listę adresów.
 */
export async function poprosOReset(email: string): Promise<void> {
  await store("/auth/customer/emailpass/reset-password", {
    method: "POST",
    body: JSON.stringify({ identifier: email }),
  }).catch(() => null)
}

/**
 * Ustawienie nowego hasła tokenem z maila.
 *
 * Token jest **jednorazowy i krótko ważny**, a podpisuje go Medusa — my go
 * tylko podajemy dalej w nagłówku. Token sesji tu nie zadziała: Medusa odbija
 * go z 401, bo to inny rodzaj tokenu.
 */
export async function ustawNoweHaslo(
  token: string,
  email: string,
  haslo: string
): Promise<{ ok: boolean; blad?: string }> {
  const odpowiedz = await store(
    "/auth/customer/emailpass/update",
    { method: "POST", body: JSON.stringify({ email, password: haslo }) },
    token
  ).catch(() => null)

  if (!odpowiedz) return { ok: false, blad: "Nie udało się połączyć ze sklepem. Spróbuj za chwilę." }

  if (!odpowiedz.ok) {
    return {
      ok: false,
      blad:
        "Odnośnik jest nieważny albo już wykorzystany. Poproś o nowy — link z maila działa " +
        "tylko raz i przez ograniczony czas.",
    }
  }

  return { ok: true }
}

export async function zmienDane(
  token: string,
  dane: { imie: string; nazwisko: string; telefon: string }
): Promise<boolean> {
  const odpowiedz = await store(
    "/store/customers/me",
    {
      method: "POST",
      body: JSON.stringify({
        first_name: dane.imie,
        last_name: dane.nazwisko,
        phone: dane.telefon,
      }),
    },
    token
  )
  return odpowiedz.ok
}

/**
 * Zamówienia klienta — czytane **po adresie e-mail**, kluczem administratora.
 *
 * Wygląda okrężnie, ale jest tu z rozmysłu. Kasa dla gościa nie przypisuje
 * zamówień do konta i nie zamierzamy jej ruszać na produkcji; gdybyśmy pytali
 * Medusę o zamówienia zalogowanego klienta, historia byłaby pusta dla każdego,
 * kto kupował przed założeniem konta — czyli dla wszystkich dotychczasowych.
 * Po adresie widać wszystko, co ta osoba u nas kupiła.
 *
 * Adres bierzemy z **potwierdzonej sesji** w Medusie, nie z przeglądarki, więc
 * nie da się w ten sposób podejrzeć cudzych zakupów.
 */
export async function zamowieniaKlienta(email: string): Promise<Zamowienie[]> {
  const token = process.env.MEDUSA_ADMIN_TOKEN || ""
  if (!token || !email) return []

  const basic = `Basic ${Buffer.from(`${token}:`).toString("base64")}`
  // Konto pokazuje szczegóły zamówienia, więc bierzemy też adres dostawy,
  // sposób wysyłki i rozbicie kwoty. Bez `*shipping_address` klient widział
  // samą sumę i nie miał jak sprawdzić, pod jaki adres paczka jedzie.
  const pola =
    "fields=id,display_id,created_at,total,item_total,shipping_total,discount_total," +
    "currency_code,status,payment_status,metadata,email,*items,*shipping_methods," +
    "*shipping_address"

  async function pobierz(zapytanie: string) {
    const odpowiedz = await fetch(`${MEDUSA_URL}/admin/orders?${pola}&${zapytanie}`, {
      headers: { Authorization: basic },
      cache: "no-store",
    }).catch(() => null)

    if (!odpowiedz?.ok) return null
    return (await odpowiedz.json().catch(() => null))?.orders || null
  }

  // Najpierw szukamy po adresie. Gdyby Medusa nie znała tego parametru
  // (odbije zapytanie albo go zignoruje), bierzemy ostatnie zamówienia
  // i przesiewamy sami — lepiej pokazać kilka niż wywalić stronę konta.
  const znalezione =
    (await pobierz(`limit=50&order=-created_at&q=${encodeURIComponent(email)}`)) ??
    (await pobierz("limit=100&order=-created_at")) ??
    []

  return znalezione
    // Wyszukiwanie w Medusie dopasowuje „zawiera", więc adres porównujemy sami.
    // To jest jedyne miejsce, które decyduje, czyje zamówienie zobaczy klient.
    .filter((z: any) => String(z.email || "").toLowerCase() === email.toLowerCase())
    .map(mapujZamowienie)
}

function mapujZamowienie(z: any): Zamowienie {
  const meta = (z?.metadata || {}) as Record<string, unknown>
  const adres = z?.shipping_address || null
  const napis = (wartosc: unknown) => (typeof wartosc === "string" ? wartosc : "")

  return {
    id: z.id,
    numer: String(z.display_id || z.id),
    kiedy: z.created_at,
    suma: Number(z.total) || 0,
    sumaPozycji: Number(z.item_total) || 0,
    dostawaKoszt: Number(z.shipping_total) || 0,
    rabat: Number(z.discount_total) || 0,
    waluta: String(z.currency_code || "pln").toUpperCase(),
    stan: z.status || "",
    // Zapłacone znaczy: albo Medusa pobrała płatność, albo PayU potwierdziło.
    // Sprawdzamy wartość, nie obecność klucza — metadane Medusy się scalają
    // i skasowany klucz zostaje z wartością `null`.
    oplacone: z.payment_status === "captured" || napis(meta.payu_status) === "COMPLETED",
    platnosc: z.payment_status || "",
    obsluga: napis(meta.obsluga) || "nowe",
    numerPrzesylki: napis(meta.przesylka_numer),
    przewoznik: napis(meta.przesylka_przewoznik),
    dostawa: z.shipping_methods?.[0]?.name || "",
    adres: adres
      ? {
          imie: adres.first_name || "",
          nazwisko: adres.last_name || "",
          ulica: [adres.address_1, adres.address_2].filter(Boolean).join(", "),
          kod: adres.postal_code || "",
          miasto: adres.city || "",
          kraj: String(adres.country_code || "").toUpperCase(),
          telefon: adres.phone || "",
          firma: adres.company || "",
        }
      : null,
    nip: napis(meta.vat_id) || napis(meta.nip),
    pozycje: (z.items || []).map((p: any) => ({
      tytul: p.product_title || p.title || "",
      wariant: p.variant_title || "",
      ile: Number(p.quantity) || 0,
      cena: Number(p.unit_price) || 0,
      razem: Number(p.total) || 0,
      // Medusa zapisuje przy pozycji migawkę produktu z chwili zakupu, więc
      // adres mamy nawet wtedy, gdy produkt zdążył zniknąć z katalogu.
      // Pusty `handle` = pozycja bez odnośnika, a nie link donikąd.
      handle: p.product_handle || p.product?.handle || "",
      zdjecie: p.thumbnail || "",
    })),
  }
}
