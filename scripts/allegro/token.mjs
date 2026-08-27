#!/usr/bin/env node
//
// Jednorazowa autoryzacja konta sprzedażowego Allegro.
//
// Allegro nie daje „klucza API" do konta — trzeba, żeby właściciel konta raz
// kliknął zgodę w przeglądarce. Ten skrypt przeprowadza przez to („device
// flow"): wypisuje adres i kod, czeka na potwierdzenie i na końcu podaje
// **refresh token**, który wystarczy już na stałe.
//
//   ALLEGRO_CLIENT_ID=... ALLEGRO_CLIENT_SECRET=... node scripts/allegro/token.mjs
//
// Identyfikator i sekret aplikacji zakłada się raz na
// https://apps.developer.allegro.pl (typ: „Aplikacja bez dostępu przez
// przeglądarkę / device flow", uprawnienia: oferty do odczytu i zapisu).
//
// Token WYPISUJEMY NA EKRAN i nic nie zapisujemy — trafia ręcznie do
// `.env.local` na serwerze, nigdy do repozytorium.

const AUTH_URL = "https://allegro.pl/auth/oauth"

const clientId = process.env.ALLEGRO_CLIENT_ID
const clientSecret = process.env.ALLEGRO_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error(
    "Brak danych aplikacji. Uruchom tak:\n" +
      "  ALLEGRO_CLIENT_ID=... ALLEGRO_CLIENT_SECRET=... node scripts/allegro/token.mjs\n\n" +
      "Identyfikator i sekret pochodzą z https://apps.developer.allegro.pl"
  )
  process.exit(1)
}

const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

async function rozpocznij() {
  const response = await fetch(`${AUTH_URL}/device`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ client_id: clientId }),
  })

  const text = await response.text()
  if (!response.ok) throw new Error(`device: ${response.status} ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

async function czekajNaZgode(deviceCode, interval, expiresIn) {
  const koniec = Date.now() + expiresIn * 1000

  for (;;) {
    if (Date.now() > koniec) throw new Error("Kod wygasł — uruchom skrypt jeszcze raz.")

    await new Promise((resolve) => setTimeout(resolve, interval * 1000))

    const response = await fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (response.ok && data.refresh_token) return data

    // `authorization_pending` to normalny stan — człowiek jeszcze nie kliknął.
    if (data.error && data.error !== "authorization_pending" && data.error !== "slow_down") {
      throw new Error(`${data.error}: ${data.error_description || ""}`)
    }
    process.stdout.write(".")
  }
}

const device = await rozpocznij()

console.log("\n  1. Otwórz w przeglądarce (zalogowany na konto sprzedażowe Marinero):\n")
console.log(`     ${device.verification_uri_complete || device.verification_uri}\n`)
console.log(`  2. Jeśli poprosi o kod, wpisz: ${device.user_code}`)
console.log("  3. Potwierdź dostęp. Czekam")

const tokens = await czekajNaZgode(
  device.device_code,
  Number(device.interval) || 5,
  Number(device.expires_in) || 600
)

console.log("\n\nGotowe. Dopisz do /opt/marinero-frontend/.env.local na serwerze:\n")
console.log(`ALLEGRO_CLIENT_ID=${clientId}`)
console.log(`ALLEGRO_CLIENT_SECRET=${clientSecret}`)
console.log(`ALLEGRO_REFRESH_TOKEN=${tokens.refresh_token}`)
console.log("\nPotem: bash /root/marinero-deploy.sh --force")
console.log("\nTych trzech linii nie wolno commitować — to dostęp do konta sprzedażowego.")
