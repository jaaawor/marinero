#!/usr/bin/env node
//
// Cofnięcie przepisania cen silników Suzuki w konfiguratorach XO.
//
//   node scripts/xo/przywroc-ceny.mjs            # podgląd
//   node scripts/xo/przywroc-ceny.mjs --zapisz
//
// Awaryjne wyjście, nie narzędzie do codziennej pracy. `ceny-sprzed-cennika.json`
// to migawka odczytana z Directusa **przed** pierwszym przepisaniem z cennika
// silników (4.09.2026) — przywraca dokładnie te kwoty.
//
// Przywracamy **tylko to, co się różni**: pozycja zgodna z migawką nie generuje
// żadnego żądania. Nazw nie ruszamy — ujednolicenie zapisu było poprawką samą
// w sobie i cofanie go razem z cenami tylko by namieszało.
//
// Migawka traci ważność po każdej świadomej zmianie cen. Jeśli ceny były już
// poprawiane po 4 września, ten skrypt cofnie także tamte poprawki — dlatego
// bez `--zapisz` wypisuje pełną listę i to jest moment, żeby ją przeczytać.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import "../lib/env.mjs"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")

if (!TOKEN) {
  console.error("Brak DIRECTUS_ADMIN_TOKEN — uruchom to na serwerze.")
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
    signal: AbortSignal.timeout(20000),
  })
  const tekst = await odpowiedz.text()
  const tresc = tekst ? JSON.parse(tekst) : {}
  if (!odpowiedz.ok) throw new Error(tresc?.errors?.[0]?.message || `HTTP ${odpowiedz.status}`)
  return tresc
}

async function main() {
  const plik = JSON.parse(readFileSync(join(KATALOG, "ceny-sprzed-cennika.json"), "utf8"))
  console.log(`Migawka z ${plik.odczytano}: ${plik.pozycje.length} pozycji.\n`)

  const { data: teraz } = await directus(
    "/items/configurator_options?limit=-1&fields=id,name,price&filter[group][configurator][slug][_starts_with]=xo-"
  )
  const poId = new Map((teraz || []).map((o) => [Number(o.id), o]))

  let doZmiany = 0
  const zadania = []

  for (const p of plik.pozycje) {
    const obecna = poId.get(p.id)
    if (!obecna) {
      console.log(`  ? ${p.slug} · ${p.nazwa}: nie ma już takiej opcji (id ${p.id})`)
      continue
    }
    if (Number(obecna.price) === Number(p.cena)) continue

    console.log(
      `  ← ${p.slug.padEnd(23)} ${String(obecna.name).padEnd(38)} ` +
        `${String(obecna.price).padStart(8)} → ${String(p.cena).padStart(8)}`
    )
    doZmiany += 1
    zadania.push({ id: p.id, cena: p.cena })
  }

  if (!doZmiany) {
    console.log("Nic do cofnięcia — ceny są już takie jak w migawce.")
    return
  }

  console.log(`\nDo cofnięcia: ${doZmiany}.`)
  if (!ZAPISZ) {
    console.log("Przebieg na sucho — dodaj --zapisz.")
    return
  }

  let zapisanych = 0
  const bledy = []
  for (const z of zadania) {
    try {
      await directus(`/items/configurator_options/${z.id}`, {
        method: "PATCH",
        body: JSON.stringify({ price: z.cena }),
      })
      zapisanych += 1
    } catch (problem) {
      bledy.push(`${z.id}: ${problem.message}`)
    }
  }

  console.log(`\nCofnięte: ${zapisanych}.${bledy.length ? ` Nie poszło: ${bledy.join(", ")}` : ""}`)
  console.log("Strona pokaże stare kwoty po najbliższym odświeżeniu ISR (do 5 minut).")
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
