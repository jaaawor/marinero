import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_LOCALE, LOCALES, isLocale } from "@/lib/i18n"

export const LOCALE_COOKIE = "marinero_locale"

// Polski serwujemy bez prefiksu (adresy zostają bez zmian), pozostałe języki
// mają prefiks w adresie. Wybór języka zapamiętuje ciasteczko, dzięki czemu
// zwykłe linki („/modele") prowadzą użytkownika do jego wersji językowej.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const segments = pathname.split("/")
  const maybeLocale = segments[1]

  if (isLocale(maybeLocale)) {
    if (maybeLocale === DEFAULT_LOCALE) {
      // /pl/... to duplikat adresu bez prefiksu — przekierowujemy na wersję kanoniczną.
      const rest = "/" + segments.slice(2).join("/")
      const target = new URL((rest === "/" ? "/" : rest.replace(/\/$/, "")) + search, request.url)
      const response = NextResponse.redirect(target)
      response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: "/", maxAge: 60 * 60 * 24 * 365 })
      return response
    }

    const response = NextResponse.next()
    response.cookies.set(LOCALE_COOKIE, maybeLocale, { path: "/", maxAge: 60 * 60 * 24 * 365 })
    return response
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value

  if (cookieLocale && isLocale(cookieLocale) && cookieLocale !== DEFAULT_LOCALE) {
    const target = new URL(`/${cookieLocale}${pathname === "/" ? "" : pathname}${search}`, request.url)
    return NextResponse.redirect(target)
  }

  // Domyślnie serwujemy polską wersję pod adresem bez prefiksu.
  return NextResponse.rewrite(
    new URL(`/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}${search}`, request.url)
  )
}

export const config = {
  matcher: [
    // Pomijamy API, pliki statyczne i zasoby Next.js.
    "/((?!api|_next|images|favicon.ico|logo-marinero.png|robots.txt|sitemap.xml).*)",
  ],
}

export const KNOWN_LOCALES = LOCALES
