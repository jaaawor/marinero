import { NextResponse } from "next/server"
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cookieOptions,
  currentUser,
  loginDirectus,
} from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let email = ""
  let password = ""

  try {
    const body = await request.json()
    email = String(body?.email || "").trim()
    password = String(body?.password || "")
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Podaj e-mail i hasło" }, { status: 400 })
  }

  try {
    const tokens = await loginDirectus(email, password)
    const user = await currentUser(tokens.access)

    const response = NextResponse.json({
      ok: true,
      user: user ? { name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email } : null,
    })

    response.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions(tokens.expires))
    response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(7 * 24 * 3600 * 1000))
    return response
  } catch (error: any) {
    // Celowo bez szczegółów — komunikat „nie ma takiego użytkownika" ułatwia
    // zgadywanie, kto ma konto.
    return NextResponse.json({ error: error?.message || "Logowanie nieudane" }, { status: 401 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ACCESS_COOKIE)
  response.cookies.delete(REFRESH_COOKIE)
  return response
}
