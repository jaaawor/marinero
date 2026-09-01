import { NextResponse } from "next/server"
import {
  tokenKlienta,
  wyczyscToken,
  zaloguj,
  poprosOReset,
  ustawNoweHaslo,
  zalogowanyKlient,
  zapiszToken,
  zarejestruj,
  zmienDane,
} from "@/lib/klient"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Kto jest zalogowany — do podstawienia danych w zamówieniu.
 *
 * Kasa pyta o to **z przeglądarki**, a nie przez odczyt ciasteczka na serwerze:
 * sięgnięcie po ciasteczko w komponencie strony wyłączyłoby ISR na całej kasie,
 * czyli spowolniłoby zakupy wszystkim, także niezalogowanym. Formularz zostaje
 * taki, jaki był, i najwyżej sam się wypełni.
 */
export async function GET() {
  const klient = await zalogowanyKlient().catch(() => null)
  if (!klient) return NextResponse.json({ zalogowany: false })

  return NextResponse.json({
    zalogowany: true,
    email: klient.email,
    imie: klient.imie,
    nazwisko: klient.nazwisko,
    telefon: klient.telefon,
  })
}

/**
 * Logowanie, rejestracja, zmiana danych i wylogowanie — jeden endpoint,
 * bo to cztery warianty tej samej rozmowy z Medusą.
 *
 * Token nigdy nie wraca do przeglądarki: siada w ciasteczku `httpOnly`,
 * którego JavaScript nie widzi.
 */
async function obsluz(request: Request) {
  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  const co = String(dane?.co || "")
  const email = String(dane?.email || "").trim().toLowerCase()
  const haslo = String(dane?.haslo || "")

  if (co === "wyloguj") {
    await wyczyscToken()
    return NextResponse.json({ ok: true })
  }

  if (co === "dane") {
    const token = await tokenKlienta()
    if (!token) return NextResponse.json({ ok: false, blad: "Zaloguj się." }, { status: 401 })

    const zapisane = await zmienDane(token, {
      imie: String(dane?.imie || "").trim().slice(0, 80),
      nazwisko: String(dane?.nazwisko || "").trim().slice(0, 80),
      telefon: String(dane?.telefon || "").trim().slice(0, 40),
    })

    return zapisane
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, blad: "Nie udało się zapisać zmian." }, { status: 400 })
  }

  if (co === "reset") {
    if (!email) {
      return NextResponse.json({ ok: false, blad: "Podaj adres e-mail." }, { status: 400 })
    }

    await poprosOReset(email)

    // Zawsze `ok`. Odpowiedź „nie ma takiego konta" byłaby odpowiedzią na
    // pytanie, którego nikt obcy nie powinien móc nam zadać.
    return NextResponse.json({ ok: true })
  }

  if (co === "nowe-haslo") {
    const zeton = String(dane?.token || "")
    if (!zeton || !email) {
      return NextResponse.json({ ok: false, blad: "Odnośnik jest niekompletny." }, { status: 400 })
    }
    if (haslo.length < 8) {
      return NextResponse.json({ ok: false, blad: "Hasło musi mieć co najmniej 8 znaków." }, { status: 400 })
    }

    const wynik = await ustawNoweHaslo(zeton, email, haslo)
    if (!wynik.ok) {
      return NextResponse.json({ ok: false, blad: wynik.blad }, { status: 400 })
    }

    // Od razu logujemy — nowe hasło właśnie zostało ustawione, więc kazanie
    // wpisywać je drugi raz w sąsiednim formularzu jest pracą dla nikogo.
    const zalogowany = await zaloguj(email, haslo)
    if (zalogowany) await zapiszToken(zalogowany)

    return NextResponse.json({ ok: true, zalogowany: Boolean(zalogowany) })
  }

  if (!email || !haslo) {
    return NextResponse.json({ ok: false, blad: "Podaj adres e-mail i hasło." }, { status: 400 })
  }

  if (co === "rejestracja") {
    // Osiem znaków to minimum, które ma sens: krótsze hasło do konta z historią
    // zamówień i adresem dostawy jest zaproszeniem do zgadywania.
    if (haslo.length < 8) {
      return NextResponse.json({ ok: false, blad: "Hasło musi mieć co najmniej 8 znaków." }, { status: 400 })
    }

    const wynik = await zarejestruj({
      email,
      haslo,
      imie: String(dane?.imie || "").trim().slice(0, 80),
      nazwisko: String(dane?.nazwisko || "").trim().slice(0, 80),
      telefon: String(dane?.telefon || "").trim().slice(0, 40),
    })

    if (!wynik.token) {
      return NextResponse.json({ ok: false, blad: wynik.blad || "Nie udało się założyć konta." }, { status: 400 })
    }

    await zapiszToken(wynik.token)
    return NextResponse.json({ ok: true })
  }

  const token = await zaloguj(email, haslo)
  if (!token) {
    // Celowo jeden komunikat na oba przypadki: „nie ma takiego konta" mówiłoby
    // obcemu, które adresy są u nas zarejestrowane.
    return NextResponse.json({ ok: false, blad: "Nieprawidłowy e-mail lub hasło." }, { status: 401 })
  }

  await zapiszToken(token)
  return NextResponse.json({ ok: true })
}

/**
 * Każde wyjście z tego endpointu jest JSON-em, także awaryjne.
 *
 * Gdy Medusa nie odpowie, `fetch` rzuca wyjątkiem — bez tej klamry Next
 * oddawał stronę błędu w HTML-u, formularz nie umiał jej odczytać i pokazywał
 * „brak połączenia", choć konto mogło już powstać.
 */
export async function POST(request: Request) {
  try {
    return await obsluz(request)
  } catch (problem: any) {
    console.error("konto_failed", problem)
    const przekroczonyCzas = problem?.name === "TimeoutError" || problem?.name === "AbortError"
    return NextResponse.json(
      {
        ok: false,
        blad: przekroczonyCzas
          ? "Sklep nie odpowiedział na czas. Spróbuj ponownie za chwilę."
          : "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
      },
      { status: przekroczonyCzas ? 504 : 500 }
    )
  }
}
