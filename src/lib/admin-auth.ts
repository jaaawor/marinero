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

async function refreshTokens(refresh: string): Promise<Tokens | null> {
  const response = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh, mode: "json" }),
    cache: "no-store",
  })

  if (!response.ok) return null

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

  jar.set(ACCESS_COOKIE, fresh.access, cookieOptions(fresh.expires))
  jar.set(REFRESH_COOKIE, fresh.refresh, cookieOptions(7 * 24 * 3600 * 1000))
  return fresh.access
}

async function isValid(token: string): Promise<boolean> {
  const response = await fetch(`${DIRECTUS_URL}/users/me?fields=id`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  return response.ok
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
  const response = await fetch(
    `${DIRECTUS_URL}/users/me?fields=id,first_name,last_name,email`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!response.ok) return null
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
