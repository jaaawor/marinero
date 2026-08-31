#!/usr/bin/env node
//
// Jednorazowa autoryzacja konta Allegro — stąd bierze się ALLEGRO_REFRESH_TOKEN.
//
//   cd /opt/marinero-frontend
//   node --env-file=.env.local scripts/allegro/autoryzuj.mjs
//
// Refresh tokenu nie ma gdzie „znaleźć" — nie leży w panelu Allegro. Powstaje
// dopiero wtedy, gdy właściciel konta sprzedażowego potwierdzi w przeglądarce,
// że ta aplikacja może działać w jego imieniu. Ten skrypt prowadzi przez to
// potwierdzenie („device flow", ten sam mechanizm co logowanie na telewizorze)
// i na końcu wypisuje token do wklejenia w .env.local.
//
// Potrzebne wcześniej: ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET z
// https://apps.developer.allegro.pl (Moje aplikacje → nowa aplikacja).
//
// Token ma trzy miesiące ważności. Skrypt można odpalić ponownie, kiedy wygaśnie.

const AUTH = "https://allegro.pl/auth/oauth"
const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

/**
 * Token zapisujemy w Directusie, nie w `.env.local`.
 *
 * Allegro unieważnia refresh token przy każdej wymianie i oddaje nowy, więc
 * miejsce, w którym on leży, musi być zapisywalne przez kod. Pliku `.env.local`
 * strona nadpisać nie może — dlatego przy tokenie ze zmiennej środowiskowej
 * integracja padała po pierwszym użyciu.
 */
async function zapiszToken(nowy) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN
  if (!token) return false

  const zapisz = (metoda, sciezka, tresc) =>
    fetch(`${DIRECTUS}${sciezka}`, {
      method: metoda,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(tresc),
    })

  try {
    const odp = await zapisz("PATCH", "/items/integration_tokens/allegro_refresh", { wartosc: nowy })
    if (odp.ok) return true
    const utworz = await zapisz("POST", "/items/integration_tokens", {
      klucz: "allegro_refresh",
      wartosc: nowy,
    })
    return utworz.ok
  } catch {
    return false
  }
}

const clientId = process.env.ALLEGRO_CLIENT_ID || ""
const clientSecret = process.env.ALLEGRO_CLIENT_SECRET || ""

if (!clientId || !clientSecret) {
  console.error("Brakuje ALLEGRO_CLIENT_ID albo ALLEGRO_CLIENT_SECRET w .env.local.\n")
  console.error("Weź je stąd — zalogowany na koncie sprzedażowym:")
  console.error("  1. https://apps.developer.allegro.pl → Moje aplikacje")
  console.error("  2. Zarejestruj nową aplikację")
  console.error("  3. Zaznacz, że aplikacja NIE ma adresu przekierowania")
  console.error("     (to włącza tryb, z którego korzysta ten skrypt)")
  console.error("  4. Nadaj uprawnienia: oferty do odczytu i zapisu,")
  console.error("     zamówienia do odczytu i zapisu, przesyłki do odczytu i zapisu")
  console.error("  5. Skopiuj Client ID i Client Secret do .env.local")
  process.exit(1)
}

const basic = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`

// — 1. Prośba o kod —
const odpKod = await fetch(`${AUTH}/device`, {
  method: "POST",
  headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: clientId }),
})

const trescKod = await odpKod.text()
if (!odpKod.ok) {
  console.error(`Allegro odrzuciło prośbę o autoryzację — HTTP ${odpKod.status}`)
  console.error(trescKod.slice(0, 400))
  if (odpKod.status === 401) {
    console.error("\nTo znaczy, że Client ID albo Client Secret się nie zgadza.")
  }
  if (/redirect/i.test(trescKod)) {
    console.error("\nAplikacja jest zarejestrowana z adresem przekierowania, a ten")
    console.error("sposób autoryzacji działa tylko dla aplikacji bez niego.")
    console.error("Zarejestruj drugą aplikację, zaznaczając brak przekierowania.")
  }
  process.exit(1)
}

const kod = JSON.parse(trescKod)

console.log("\n" + "═".repeat(64))
console.log("  Otwórz w przeglądarce, zalogowany na koncie sprzedażowym:")
console.log("")
console.log(`  ${kod.verification_uri_complete || kod.verification_uri}`)
console.log("")
if (!kod.verification_uri_complete) {
  console.log(`  i wpisz kod:  ${kod.user_code}`)
  console.log("")
}
console.log("  Potem potwierdź dostęp dla aplikacji i wróć tutaj.")
console.log("═".repeat(64) + "\n")

// — 2. Czekanie na potwierdzenie —
const koniec = Date.now() + (Number(kod.expires_in) || 600) * 1000
let odstep = (Number(kod.interval) || 5) * 1000

process.stdout.write("Czekam na potwierdzenie")

for (;;) {
  if (Date.now() > koniec) {
    console.error("\n\nKod wygasł. Odpal skrypt jeszcze raz i potwierdź szybciej.")
    process.exit(1)
  }

  await new Promise((gotowe) => setTimeout(gotowe, odstep))
  process.stdout.write(".")

  const odp = await fetch(`${AUTH}/token`, {
    method: "POST",
    headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: kod.device_code,
    }),
  })

  const tresc = await odp.text()
  let dane
  try {
    dane = JSON.parse(tresc)
  } catch {
    console.error(`\n\nNieoczekiwana odpowiedź: ${tresc.slice(0, 200)}`)
    process.exit(1)
  }

  if (odp.ok && dane.refresh_token) {
    const zapisany = await zapiszToken(dane.refresh_token)

    console.log("\n\n" + "═".repeat(64))
    if (zapisany) {
      console.log("  Gotowe. Token zapisany w Directusie — nic nie trzeba kopiować.")
      console.log("")
      console.log("  Sprawdź:  node --env-file=.env.local scripts/allegro/sprawdz.mjs")
      console.log("  Od teraz odnawia się sam przy każdym użyciu.")
    } else {
      console.log("  Autoryzacja się udała, ale NIE udało się zapisać tokenu w Directusie.")
      console.log("  Sprawdź DIRECTUS_ADMIN_TOKEN w .env.local. Awaryjnie wklej ręcznie:")
      console.log("")
      console.log(`ALLEGRO_REFRESH_TOKEN=${dane.refresh_token}`)
      console.log("")
      console.log("  Uwaga: z .env.local token działa tylko RAZ — Allegro unieważnia go")
      console.log("  przy pierwszej wymianie, a pliku strona nie ma jak nadpisać.")
    }
    console.log("═".repeat(64) + "\n")
    process.exit(zapisany ? 0 : 1)
  }

  // Czekanie na kliknięcie w przeglądarce to normalny stan, nie błąd.
  if (dane.error === "authorization_pending") continue

  // Allegro prosi o wolniejsze pytanie — trzeba posłuchać, inaczej odetnie.
  if (dane.error === "slow_down") {
    odstep += 2000
    continue
  }

  console.error(`\n\nAutoryzacja się nie udała: ${dane.error_description || dane.error || tresc.slice(0, 200)}`)
  if (dane.error === "access_denied") {
    console.error("Dostęp został odrzucony w przeglądarce.")
  }
  process.exit(1)
}
