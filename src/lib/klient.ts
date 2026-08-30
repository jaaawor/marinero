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

export type Zamowienie = {
  id: string
  numer: string
  kiedy: string
  suma: number
  stan: string
  oplacone: boolean
  pozycje: { tytul: string; ile: number }[]
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
  const pola =
    "fields=id,display_id,created_at,total,status,payment_status,metadata,email,*items"

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
    .map((z: any) => ({
      id: z.id,
      numer: String(z.display_id || z.id),
      kiedy: z.created_at,
      suma: Number(z.total) || 0,
      stan: z.status || "",
      oplacone:
        z.payment_status === "captured" ||
        z.metadata?.payu_status === "COMPLETED",
      pozycje: (z.items || []).map((p: any) => ({
        tytul: p.product_title || p.title || "",
        ile: Number(p.quantity) || 0,
      })),
    }))
}
