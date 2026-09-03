// Przygotowanie Directusa pod bramkę kontaktową w konfiguratorze.
//
//   node scripts/konfigurator/bramka-directus.mjs            # pokazuje, co zrobi
//   node scripts/konfigurator/bramka-directus.mjs --zapisz   # zapisuje
//
// Uruchamia się **na VPS-ie**, bo potrzebuje `DIRECTUS_ADMIN_TOKEN`.
//
// Trzy rzeczy:
//  1. pole `configurators.wymaga_kontaktu` — przełącznik przy konkretnej łodzi;
//  2. kolekcja `configurator_leads` — kto otworzył konfigurator i ile razy;
//  3. włączenie przełącznika przy Aquilach.
//
// Skrypt jest **idempotentny**: to, co już istnieje, zostawia w spokoju.
// Domyślnie tylko pokazuje — ta sama zasada co przy przywracaniu cen: zmiana
// schematu bazy na produkcji nie jest rzeczą, którą robi się przez pomyłkę
// naciśniętym enterem.

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

function krok(opis) {
  console.log(ZAPISZ ? `→ ${opis}` : `(podgląd) ${opis}`)
}

/** Pole przełącznika przy konfiguratorze. */
const POLE = {
  collection: "configurators",
  field: "wymaga_kontaktu",
  type: "boolean",
  schema: { default_value: false },
  meta: {
    interface: "boolean",
    special: ["cast-boolean"],
    note: "Konfigurator otwiera się dopiero po podaniu imienia i adresu e-mail. Włączone przy Aquilach.",
    options: { label: "Wymaga kontaktu przed otwarciem" },
    width: "half",
  },
}

/** Kto otworzył konfigurator. Pola po polsku, bo czyta je sprzedawca. */
const POLA_LEADOW = [
  { field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
  { field: "imie", type: "string", meta: { interface: "input", note: "Imię podane w bramce." } },
  { field: "email", type: "string", meta: { interface: "input", note: "Klucz — po nim sklejamy wizyty w jedną osobę." } },
  { field: "wejsc", type: "integer", schema: { default_value: 0 }, meta: { interface: "input", note: "Ile razy otwierał konfigurator." } },
  { field: "pierwszy_model", type: "string", meta: { interface: "input" } },
  { field: "ostatni_model", type: "string", meta: { interface: "input" } },
  { field: "kiedy", type: "timestamp", meta: { interface: "datetime", note: "Pierwsze odblokowanie." } },
  { field: "ostatnio", type: "timestamp", meta: { interface: "datetime", note: "Ostatnie wejście." } },
  { field: "gosc", type: "string", meta: { interface: "input", hidden: true } },
  { field: "odcisk", type: "string", meta: { interface: "input", hidden: true } },
]

async function zalozPole() {
  try {
    await directus("/fields/configurators/wymaga_kontaktu")
    console.log("Pole configurators.wymaga_kontaktu — już jest.")
    return
  } catch (problem) {
    if (problem.status !== 403 && problem.status !== 404) throw problem
  }

  krok("zakładam pole configurators.wymaga_kontaktu")
  if (!ZAPISZ) return

  await directus("/fields/configurators", { method: "POST", body: JSON.stringify(POLE) })
}

async function zalozKolekcje() {
  try {
    await directus("/collections/configurator_leads")
    console.log("Kolekcja configurator_leads — już jest.")
    return
  } catch (problem) {
    if (problem.status !== 403 && problem.status !== 404) throw problem
  }

  krok("zakładam kolekcję configurator_leads")
  if (!ZAPISZ) return

  await directus("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection: "configurator_leads",
      meta: {
        note: "Kto otworzył konfigurator za bramką kontaktową (Aquile).",
        icon: "how_to_reg",
        display_template: "{{imie}} — {{email}}",
        sort_field: "ostatnio",
      },
      schema: { name: "configurator_leads" },
      fields: POLA_LEADOW,
    }),
  })

  // Lista w panelu ma od razu pokazywać to, po co się tu wchodzi.
  // Bez presetu Directus pokazuje samą kolumnę z numerem.
  await directus("/presets", {
    method: "POST",
    body: JSON.stringify({
      collection: "configurator_leads",
      user: null,
      role: null,
      layout: "tabular",
      layout_query: { tabular: { sort: ["-ostatnio"], page: 1 } },
      layout_options: {
        tabular: {
          widths: {},
          fields: ["imie", "email", "wejsc", "ostatni_model", "ostatnio", "kiedy"],
        },
      },
    }),
  })
}

async function wlaczPrzyAquilach() {
  const { data: konfiguratory = [] } = await directus(
    "/items/configurators?limit=200&fields=id,slug,wymaga_kontaktu"
  )

  // Aquile poznajemy po slugu modelu — marka stoi w nim na początku.
  const aquile = konfiguratory.filter((wpis) => /^aquila-/i.test(wpis.slug || ""))

  if (!aquile.length) {
    console.log("Nie znalazłem konfiguratorów Aquili — nic nie włączam.")
    return
  }

  const doWlaczenia = aquile.filter((wpis) => !wpis.wymaga_kontaktu)
  console.log(
    `Aquile: ${aquile.length}, z bramką już: ${aquile.length - doWlaczenia.length}, do włączenia: ${doWlaczenia.length}`
  )

  for (const wpis of doWlaczenia) {
    krok(`bramka przy ${wpis.slug}`)
    if (!ZAPISZ) continue

    await directus(`/items/configurators/${wpis.id}`, {
      method: "PATCH",
      body: JSON.stringify({ wymaga_kontaktu: true }),
    })
  }
}

async function main() {
  console.log(`Directus: ${DIRECTUS}`)
  console.log(ZAPISZ ? "Tryb: ZAPIS" : "Tryb: podgląd (dopisz --zapisz, żeby zapisać)")
  console.log()

  await zalozPole()
  await zalozKolekcje()
  await wlaczPrzyAquilach()

  console.log()
  console.log(
    ZAPISZ
      ? "Gotowe. Bramka włączy się na stronie po najbliższym odświeżeniu ISR (do 5 minut)."
      : "Nic nie zapisane. Powtórz z --zapisz."
  )
}

main().catch((problem) => {
  console.error("Nie udało się:", problem.message)
  process.exit(1)
})
