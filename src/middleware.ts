import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n"

export const LOCALE_COOKIE = "marinero_locale"

// Polski jest serwowany wprost z grupy tras `(pl)` pod adresami bez prefiksu,
// pozostałe języki z grupy `(intl)/[locale]`. Middleware NIE przepisuje adresów —
// robi wyłącznie przekierowania, bo rewrite za odwrotnym proxy potrafi wskazać
// na obcy origin (localhost:3000) i wywrócić żądanie.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const segments = pathname.split("/")
  const maybeLocale = segments[1]

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path || "/"
    return NextResponse.redirect(url)
  }

  if (isLocale(maybeLocale)) {
    if (maybeLocale === DEFAULT_LOCALE) {
      // /pl/... to duplikat adresu bez prefiksu — przekierowujemy na wersję kanoniczną.
      const rest = "/" + segments.slice(2).join("/")
      const response = redirectTo(rest === "/" ? "/" : rest.replace(/\/$/, ""))
      response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: "/", maxAge: 60 * 60 * 24 * 365 })
      return response
    }

    const response = NextResponse.next()
    response.cookies.set(LOCALE_COOKIE, maybeLocale, { path: "/", maxAge: 60 * 60 * 24 * 365 })
    return response
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value

  if (cookieLocale && isLocale(cookieLocale) && cookieLocale !== DEFAULT_LOCALE) {
    return redirectTo(`/${cookieLocale}${pathname === "/" ? "" : pathname}`)
  }

  // Adres bez prefiksu obsługuje bezpośrednio polska grupa tras — nic nie zmieniamy.
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Pomijamy API, narzędzia wewnętrzne, pliki statyczne i zasoby Next.js.
    // `/admin` istnieje tylko po polsku — bez tego wyjątku ciasteczko języka
    // przerzucało zalogowaną osobę na /en/admin/... i wychodził 404.
    "/((?!api|admin|_next|images|favicon.ico|logo-marinero.png|robots.txt|sitemap.xml).*)",
  ],
}
