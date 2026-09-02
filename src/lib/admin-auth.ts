// Logowanie do narzędzi wewnętrznych kontem z Directusa.
//
// Nie zakładamy osobnych haseł „do panelu z cennikami": kto ma konto
// w Directusie, ten może wgrywać cenniki — i pisze do bazy SWOIM tokenem,
// więc uprawnienia i historia zmian zostają po stronie Directusa.
// W repozytorium nie ma i nie może być żadnego tokenu administratora.

import { cookies } from "next/headers"

export const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

export const ACCESS_COOKIE = "marinero_admin"
export const REFRESH_COOKIE = "marinero_admin_refresh"

/**
 * Limit czasu na pytanie do Directusa. `fetch` **nie ma własnego**, więc gdy
 * Directus się zamyśli (a stoi na tym samym VPS-ie co build i Medusa), całe
 * wejście do panelu wisiało bez końca albo kończyło się wyjątkiem gdzieś
 * w środku renderowania — czyli stroną błędu z samym numerem `digest`.
 */
const LIMIT_MS = 8000

async function pytaj(sciezka: string, init: RequestInit = {}): Promise<Response | null> {
  const stoper = AbortSignal.timeout(LIMIT_MS)
  try {
    return await fetch(`${DIRECTUS_URL}${sciezka}`, { ...init, cache: "no-store", signal: stoper })
  } catch {
    // Zerwane połączenie, DNS, przekroczony czas — **nie wiadomo**, a to co
    // innego niż „token jest zły". Kto to woła, ten decyduje, co z tym zrobić.
    return null
  }
}

type Tokens = { access: string; refresh: string; expires: number }

export async function loginDirectus(email: string, password: string): Promise<Tokens> {
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, mode: "json" }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Nieprawidłowy e-mail lub hasło")
  }

  const data = await response.json()
  return {
    access: data?.data?.access_token || "",
    refresh: data?.data?.refresh_token || "",
    expires: Number(data?.data?.expires) || 0,
  }
}

export async function refreshTokens(refresh: string): Promise<Tokens | null> {
  const response = await pytaj("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh, mode: "json" }),
  })

  if (!response?.ok) return null

  const data = await response.json()
  return {
    access: data?.data?.access_token || "",
    refresh: data?.data?.refresh_token || "",
    expires: Number(data?.data?.expires) || 0,
  }
}

/**
 * Token zalogowanej osoby. Token dostępu Directusa żyje kwadrans, a wgranie
 * i sprawdzenie cennika trwa dłużej — dlatego przy wygaśnięciu odnawiamy go
 * w tle, zamiast wyrzucać człowieka z formularza w połowie roboty.
 */
export async function getAdminToken(): Promise<string | null> {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  const refresh = jar.get(REFRESH_COOKIE)?.value

  if (access && (await isValid(access))) return access
  if (!refresh) return null

  const fresh = await refreshTokens(refresh)
  if (!fresh?.access) return null

  // Ciasteczka wolno zapisywać **tylko** w Route Handlerze i akcji serwerowej;
  // w komponencie serwerowym `set` rzuca („Cookies can only be modified…").
  // Tamtędy chodzi `sesjaPanelu`, ale gdyby ktoś zawołał tę funkcję ze strony,
  // wyjątek zamieniłby całe wejście do panelu w stronę błędu — i to po
  // zużyciu tokenu odświeżającego, czyli bez możliwości powtórzenia.
  try {
    jar.set(ACCESS_COOKIE, fresh.access, cookieOptions(fresh.expires))
    jar.set(REFRESH_COOKIE, fresh.refresh, cookieOptions(7 * 24 * 3600 * 1000))
  } catch {
    // Nie ma gdzie zapisać — token starczy na to jedno żądanie.
  }

  return fresh.access
}

/**
 * Stan sesji dla **komponentu serwerowego**.
 *
 * Nie odświeża tokenu i nie rusza ciasteczek — obie te rzeczy są w renderze
 * niedozwolone. Directus **unieważnia token odświeżający przy każdej
 * wymianie**, więc próba odświeżenia ze strony kończyła się najgorzej, jak
 * mogła: token zużyty, nowy nie do zapisania, wyjątek w renderze. Stąd
 * `do-odswiezenia` — stronę odświeża wtedy `/api/admin/login` (PUT), czyli
 * miejsce, w którym ciasteczka wolno zapisać.
 */
export async function sesjaPanelu(): Promise<{
  token: string | null
  stan: "ok" | "brak" | "do-odswiezenia"
}> {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  const refresh = jar.get(REFRESH_COOKIE)?.value

  if (access && (await isValid(access))) return { token: access, stan: "ok" }
  if (refresh) return { token: null, stan: "do-odswiezenia" }
  return { token: null, stan: "brak" }
}

async function isValid(token: string): Promise<boolean> {
  const response = await pytaj("/users/me?fields=id", {
    headers: { Authorization: `Bearer ${token}` },
  })

  // Milczący Directus to nie jest dowód na zły token. Wylogowanie człowieka
  // przy każdym czknięciu sieci byłoby gorsze niż przepuszczenie go dalej:
  // każdy zapis i tak idzie do Directusa tym tokenem i to Directus decyduje,
  // czy go przyjąć.
  return response === null ? true : response.ok
}

export function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(60, Math.floor((maxAgeMs || 900_000) / 1000)),
  }
}

export async function currentUser(token: string) {
  const response = await pytaj(
    // `role` jest identyfikatorem roli — po nim poznajemy administratora.
    // Nazwy roli nie pytamy: konto z rolą „Panel" nie ma prawa czytać ról
    // i całe zapytanie wróciłoby wtedy puste.
    "/users/me?fields=id,first_name,last_name,email,role",
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!response?.ok) return null
  const data = await response.json()
  return data?.data || null
}

/** Wywołanie Directusa tokenem zalogowanej osoby. */
export async function directusAs(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  const text = await response.text()
  const body = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message = body?.errors?.[0]?.message || `Directus odpowiedział ${response.status}`
    throw new Error(message)
  }

  return body
}
