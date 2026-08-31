#!/usr/bin/env node
//
// Sprawdzenie połączenia z Allegro — czy klucze działają i co widzimy na koncie.
//
//   cd /opt/marinero-frontend
//   node --env-file=.env.local scripts/allegro/sprawdz.mjs
//
// Nic nie wysyła i niczego nie zmienia: same odczyty. Kluczy nie wypisujemy,
// tylko ich obecność i długość — żeby dało się zobaczyć uciętą wklejkę,
// nie znając samego sekretu.

const AUTH_URL = "https://allegro.pl/auth/oauth"
const API_URL = "https://api.allegro.pl"
const UA = process.env.ALLEGRO_USER_AGENT || "marinero-sklep/1 (+marinero.pl)"

const clientId = process.env.ALLEGRO_CLIENT_ID || ""
const clientSecret = process.env.ALLEGRO_CLIENT_SECRET || ""
const refreshToken = process.env.ALLEGRO_REFRESH_TOKEN || ""

const pokaz = (nazwa, wartosc) =>
  console.log(`  ${nazwa.padEnd(24)} ${wartosc ? `jest (${wartosc.length} znaków)` : "BRAK"}`)

console.log("Zmienne w .env.local:")
pokaz("ALLEGRO_CLIENT_ID", clientId)
pokaz("ALLEGRO_CLIENT_SECRET", clientSecret)
pokaz("ALLEGRO_REFRESH_TOKEN", refreshToken)
console.log(`  ALLEGRO_USER_AGENT       ${UA}`)

if (!clientId || !clientSecret || !refreshToken) {
  console.error("\nBez kompletu kluczy synchronizacja chodzi w trybie podglądu i nic nie wysyła.")
  process.exit(1)
}

// — 1. Token —
console.log("\n1. Wymiana refresh tokenu na dostępowy…")
const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
const odpAuth = await fetch(`${AUTH_URL}/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
})

const trescAuth = await odpAuth.text()
if (!odpAuth.ok) {
  console.error(`   NIE DZIAŁA — HTTP ${odpAuth.status}`)
  console.error(`   ${trescAuth.slice(0, 400)}`)
  console.error("\nNajczęstsze przyczyny:")
  console.error("  • refresh token wygasł (Allegro daje mu 3 miesiące) — trzeba przejść")
  console.error("    autoryzację jeszcze raz i wpisać nowy do .env.local,")
  console.error("  • klucz aplikacji jest z innego środowiska (sandbox zamiast produkcji),")
  console.error("  • aplikacja w panelu Allegro nie ma nadanych uprawnień (scope).")
  process.exit(1)
}

const auth = JSON.parse(trescAuth)
const token = auth.access_token
console.log(`   działa — token ważny ${auth.expires_in}s`)

// Allegro oddaje przy okazji NOWY refresh token. Stary zwykle działa do końca
// swoich trzech miesięcy, ale nowy przesuwa ten termin — warto go podmienić,
// inaczej co kwartał ktoś musi przechodzić autoryzację ręcznie.
if (auth.refresh_token && auth.refresh_token !== refreshToken) {
  console.log("\n   UWAGA: Allegro oddało nowy refresh token.")
  console.log("   Wpisz go do .env.local jako ALLEGRO_REFRESH_TOKEN, żeby przesunąć termin ważności:")
  console.log(`   ${auth.refresh_token}`)
}

const pytaj = async (sciezka) => {
  const odp = await fetch(`${API_URL}${sciezka}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.allegro.public.v1+json",
      "User-Agent": UA,
    },
  })
  const tresc = await odp.text()
  if (!odp.ok) throw new Error(`HTTP ${odp.status}: ${tresc.slice(0, 300)}`)
  return JSON.parse(tresc)
}

// — 2. Konto —
console.log("\n2. Konto sprzedażowe…")
try {
  const ja = await pytaj("/me")
  console.log(`   ${ja.login || ja.id || "(bez nazwy)"}`)
} catch (blad) {
  console.log(`   nie udało się odczytać: ${blad.message}`)
}

// — 3. Oferty —
console.log("\n3. Oferty…")
try {
  const oferty = await pytaj("/sale/offers?limit=20&offset=0")
  const lista = oferty.offers || []
  console.log(`   wystawionych: ${oferty.totalCount ?? lista.length}`)

  const zeSku = lista.filter((o) => o.external?.id)
  console.log(`   z SKU w polu „sygnatura": ${zeSku.length} z ${lista.length} pokazanych`)

  if (!zeSku.length && lista.length) {
    console.log("   To jest problem: oferty łączymy z produktami po SKU (external.id).")
    console.log("   Bez sygnatury nie da się dopasować oferty do produktu w sklepie.")
  }

  for (const o of lista.slice(0, 5)) {
    const cena = o.sellingMode?.price?.amount ?? "?"
    console.log(`     • ${(o.external?.id || "brak-sku").padEnd(18)} ${cena} zł  ${String(o.name).slice(0, 45)}`)
  }
} catch (blad) {
  console.log(`   nie udało się odczytać: ${blad.message}`)
}

// — 4. Zamówienia —
console.log("\n4. Zamówienia do obsługi…")
try {
  const zam = await pytaj("/order/checkout-forms?limit=10&offset=0&status=READY_FOR_PROCESSING")
  const lista = zam.checkoutForms || []
  console.log(`   gotowych do realizacji: ${zam.totalCount ?? lista.length}`)
  for (const z of lista.slice(0, 5)) {
    const kto = z.buyer?.login || "?"
    const ile = z.summary?.totalToPay?.amount ?? "?"
    console.log(`     • ${String(z.id).slice(0, 8)}…  ${kto}  ${ile} zł`)
  }
} catch (blad) {
  console.log(`   nie udało się odczytać: ${blad.message}`)
  console.log("   Jeśli to 403, aplikacji brakuje uprawnień allegro:api:orders:read.")
}

console.log("\nGotowe. Niczego nie zmieniono.")
