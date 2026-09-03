import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n"
import { SITE_URL, czyHostTechniczny } from "@/lib/seo"

export const LOCALE_COOKIE = "marinero_locale"

// Polski jest serwowany wprost z grupy tras `(pl)` pod adresami bez prefiksu,
// pozostałe języki z grupy `(intl)/[locale]`. Middleware NIE przepisuje adresów —
// robi wyłącznie przekierowania, bo rewrite za odwrotnym proxy potrafi wskazać
// na obcy origin (localhost:3000) i wywrócić żądanie.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Adres techniczny z hostingu (`marinero.150197.pl`) oddawał całą stronę
  // z kodem 200, więc Google trzymał go jako osobny serwis z tą samą treścią
  // i pokazywał w wynikach zamiast marinero.pl. Odsyłamy **trwale** (301),
  // żeby moc linków przeszła na adres właściwy, a nie została po tamtej
  // stronie. Zapytanie przepisujemy w całości — kto trafił na podstronę,
  // ma wylądować na tej samej podstronie, nie na stronie głównej.
  //
  // `/.well-known/` zostawiamy w spokoju: tędy chodzi potwierdzanie
  // certyfikatu, a przekierowanie zerwałoby odnowienie i host padłby na
  // wygasłym certyfikacie.
  if (czyHostTechniczny(request.headers.get("host")) && !pathname.startsWith("/.well-known/")) {
    return NextResponse.redirect(`${SITE_URL}${pathname}${request.nextUrl.search}`, 301)
  }

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
    // Narzędzia istnieją tylko po polsku — bez tego wyjątku ciasteczko języka
    // przerzucało zalogowaną osobę na /en/narzedzia-.../... i wychodził 404.
    // Adres celowo nie brzmi `/admin`: pod tamtym skanery dobijają się same.
    "/((?!api|narzedzia-8f3a|_next|images|favicon.ico|logo-marinero.png|robots.txt|sitemap.xml).*)",
  ],
}
