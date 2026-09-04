// Pola z danymi do przelewu w `site_settings`.
//
//   node scripts/sklep/przelew-directus.mjs            # pokazuje, co zrobi
//   node scripts/sklep/przelew-directus.mjs --zapisz   # zapisuje
//
// Uruchamia się **na VPS-ie**, bo potrzebuje `DIRECTUS_ADMIN_TOKEN`.
//
// Po co: mail z potwierdzeniem zamówienia mówił „dane do przelewu prześlemy
// w osobnej wiadomości", a tej wiadomości nic nie wysyłało — klient zostawał
// z zamówieniem, za które nie miał jak zapłacić. Teraz numer konta idzie
// w tym samym mailu, a bierze się **stąd**: numer bywa zmieniany i nie ma
// powodu, żeby jego poprawka wymagała wdrożenia.
//
// Skrypt **nie wpisuje numeru konta** — zakłada same puste pola. Numer wpisuje
// człowiek w panelu; zmyślony rachunek w mailu do klienta to pieniądze wysłane
// w nieznane.

import "../lib/env.mjs"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")

if (!TOKEN) {
  console.error("Brak DIRECTUS_ADMIN_TOKEN — uruchom to na serwerze, gdzie jest .env.local.")
  process.exit(1)
}

async function directus(sciezka, opcje = {}) {
  const odpowiedz = await fetch(`${DIRECTUS}${sciezka}`, {
    ...opcje,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(opcje.headers || {}),
    },
  })

  const tekst = await odpowiedz.text()
  const tresc = tekst ? JSON.parse(tekst) : {}

  if (!odpowiedz.ok) {
    const powod = tresc?.errors?.[0]?.message || `HTTP ${odpowiedz.status}`
    throw Object.assign(new Error(powod), { status: odpowiedz.status })
  }

  return tresc
}

const POLA = [
  {
    field: "bank_odbiorca",
    nazwa: "Przelew — odbiorca",
    opis: "Nazwa, na którą klient robi przelew. Puste = nazwa serwisu.",
  },
  {
    field: "bank_konto",
    nazwa: "Przelew — numer konta",
    opis:
      "Numer rachunku w mailu z potwierdzeniem zamówienia. " +
      "Póki puste, klient dostaje prośbę o kontakt zamiast danych do zapłaty.",
  },
  {
    field: "bank_nazwa",
    nazwa: "Przelew — bank",
    opis: "Nazwa banku (nieobowiązkowa) — wchodzi pod numer konta.",
  },
]

async function main() {
  const istniejace = await directus("/fields/site_settings")
  const sa = new Set((istniejace.data || []).map((p) => p.field))

  for (const pole of POLA) {
    if (sa.has(pole.field)) {
      console.log(`= pole ${pole.field} już jest`)
      continue
    }

    console.log(`${ZAPISZ ? "→" : "(podgląd)"} zakładam pole ${pole.field}`)
    if (!ZAPISZ) continue

    await directus("/fields/site_settings", {
      method: "POST",
      body: JSON.stringify({
        field: pole.field,
        type: "string",
        schema: {},
        meta: {
          interface: "input",
          note: pole.opis,
          options: { placeholder: pole.field === "bank_konto" ? "PL00 0000 0000 0000 0000 0000 0000" : "" },
          translations: [{ language: "pl-PL", translation: pole.nazwa }],
          width: "half",
        },
      }),
    })
  }

  const teraz = await directus("/items/site_settings")
  const konto = String(teraz?.data?.bank_konto || "").trim()

  console.log("")
  if (konto) {
    console.log(`Numer konta jest ustawiony: ${konto}`)
  } else {
    // Adres podajemy wprost. „Wpisz w ustawieniach serwisu" nie mówi nic
    // komuś, kto nie wie, gdzie w Directusie te ustawienia siedzą — a to jest
    // singleton, więc w bocznym menu wygląda inaczej niż zwykła kolekcja.
    console.log("UWAGA: numer konta jest pusty, mail dalej odsyła klienta do telefonu.")
    console.log("Wpisz go tutaj (pola są na dole formularza):")
    console.log(`  ${DIRECTUS}/admin/content/site_settings`)
  }

  if (!ZAPISZ) console.log("\nNic nie zapisano. Powtórz z --zapisz.")
}

main().catch((problem) => {
  console.error("Nie udało się:", problem.message)
  process.exit(1)
})
