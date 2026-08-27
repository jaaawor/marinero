#!/usr/bin/env node
//
// Wgrywa przetłumaczone paczki z `gotowe/` do kolekcji `content_translations`.
//
//   DIRECTUS_TOKEN=... node scripts/tlumaczenia/import.mjs            # na sucho
//   DIRECTUS_TOKEN=... node scripts/tlumaczenia/import.mjs --zapis
//
// Token jest sekretem — **nie wchodzi do repozytorium**. Skrypt pisze tylko
// tam, gdzie tłumaczenia jeszcze nie ma; poprawione ręcznie w panelu nadpisuje
// wyłącznie z `--nadpisz`, bo praca człowieka jest ważniejsza niż maszyny.

import { readdirSync, readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const DIRECTUS = process.env.NEXT_PUBLIC_DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")
const NADPISZ = process.argv.includes("--nadpisz")

const JEZYKI = ["en", "de", "fr", "ru", "uk", "it", "es"]

async function api(path, init = {}) {
  // Zerwane połączenie TLS w środku przebiegu zdarza się regularnie —
  // ponawiamy, zamiast zostawiać połowę wgranych tłumaczeń.
  for (let proba = 1; ; proba++) {
    try {
      const response = await fetch(`${DIRECTUS}${path}`, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      })
      const text = await response.text()
      if (!response.ok) throw new Error(`${path} → ${response.status}: ${text.slice(0, 200)}`)
      return text ? JSON.parse(text) : {}
    } catch (error) {
      if (proba >= 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** proba))
    }
  }
}

/** Co już jest w bazie: `hash|język` → {id, machine}. */
async function istniejace() {
  const mapa = new Map()
  for (let page = 1; page < 500; page++) {
    const response = await fetch(
      `${DIRECTUS}/items/content_translations?fields=id,hash,language,machine&limit=500&page=${page}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    )
    if (!response.ok) break
    const rows = (await response.json())?.data || []
    for (const row of rows) mapa.set(`${row.hash}|${row.language}`, row)
    if (rows.length < 500) break
  }
  return mapa
}

async function main() {
  if (!TOKEN) {
    console.error("Brak DIRECTUS_TOKEN — podaj go w zmiennej środowiskowej, nie w pliku.")
    process.exit(1)
  }

  const katalog = join(KATALOG, "gotowe")
  if (!existsSync(katalog)) {
    console.error(`Nie ma katalogu ${katalog}`)
    process.exit(1)
  }

  const juzJest = await istniejace()
  const doWstawienia = []
  const doPoprawy = []
  let pominiete = 0

  // Paczki `gotowe/NNN.json` są w zapisie zwartym: tablica wierszy w tej samej
  // kolejności co `do-zrobienia/NNN.json`, każdy wiersz to skrót (pierwsze
  // 8 znaków, jako zabezpieczenie) i siedem tłumaczeń. Tekst źródłowy bierzemy
  // z paczki wyjściowej — nie ma powodu trzymać go dwa razy.
  for (const plik of readdirSync(katalog).filter((name) => name.endsWith(".json")).sort()) {
    const gotowa = JSON.parse(readFileSync(join(katalog, plik), "utf8"))
    const zrodlowa = JSON.parse(readFileSync(join(KATALOG, "do-zrobienia", plik), "utf8"))
    const wiersze = gotowa.tlumaczenia || []

    if (wiersze.length !== zrodlowa.teksty.length) {
      throw new Error(
        `${plik}: ${wiersze.length} wierszy przy ${zrodlowa.teksty.length} tekstach — ` +
          "paczka nie pasuje do wyjściowej"
      )
    }

    for (let i = 0; i < wiersze.length; i++) {
      const wpis = zrodlowa.teksty[i]
      const wiersz = wiersze[i]

      if (!wpis.hash.startsWith(wiersz[0])) {
        throw new Error(`${plik}, wiersz ${i + 1}: skrót ${wiersz[0]} nie pasuje do ${wpis.hash}`)
      }

      JEZYKI.forEach((language, index) => {
        const value = String(wiersz[index + 1] || "").trim()
        if (!value) return

        const stary = juzJest.get(`${wpis.hash}|${language}`)

        if (!stary) {
          doWstawienia.push({
            hash: wpis.hash,
            language,
            source: wpis.source,
            value,
            machine: true,
            context: wpis.context || "",
          })
          return
        }

        // Poprawione ręcznie zostawiamy w spokoju — po to jest `machine`.
        if (!NADPISZ || !stary.machine) {
          pominiete++
          return
        }
        doPoprawy.push({ id: stary.id, value })
      })
    }
  }

  console.log(`do wstawienia: ${doWstawienia.length}`)
  console.log(`do poprawy:    ${doPoprawy.length}`)
  console.log(`pominiętych:   ${pominiete}`)

  if (!ZAPIS) {
    console.log("\nPrzebieg na sucho — dodaj --zapis.")
    return
  }

  // Directus przyjmuje tablicę, ale przy tysiącach wpisów jedno żądanie
  // potrafi się urwać w połowie — dzielimy na porcje po 200.
  for (let i = 0; i < doWstawienia.length; i += 200) {
    const porcja = doWstawienia.slice(i, i + 200)
    await api("/items/content_translations", { method: "POST", body: JSON.stringify(porcja) })
    console.log(`  wstawione ${Math.min(i + 200, doWstawienia.length)} / ${doWstawienia.length}`)
  }

  for (const wpis of doPoprawy) {
    await api(`/items/content_translations/${wpis.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value: wpis.value, machine: true }),
    })
  }

  console.log("\nZapisane.")
}

main().catch((error) => {
  console.error(String(error.message || error))
  process.exit(1)
})
