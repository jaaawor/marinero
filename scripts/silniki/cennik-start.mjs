#!/usr/bin/env node
//
// Ceny startowe cennika silników → `panel_ustawienia` w Directusie.
//
//   node scripts/silniki/cennik-start.mjs            # podgląd
//   node scripts/silniki/cennik-start.mjs --zapisz   # zapisuje (na VPS-ie)
//
// Jednorazowe wypełnienie, żeby nie przepisywać ręcznie dziesięciu pozycji
// z arkusza. Dalej cennik edytuje się **w panelu** (`/narzedzia-8f3a/silniki`)
// — plik zostaje jako ślad, skąd wzięły się pierwsze kwoty.
//
// Skrypt **nie rusza cen w konfiguratorach**. Zapisuje sam cennik; przepisanie
// go do ofert to osobne kliknięcie w panelu, po obejrzeniu podglądu.
//
// Domyślnie **nie nadpisuje** tego, co już jest — cennik poprawiony w panelu
// jest świeższy niż plik w repozytorium. `--nadpisz` wymusza.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import "../lib/env.mjs"

const KATALOG = dirname(fileURLToPath(import.meta.url))
const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")
const NADPISZ = process.argv.includes("--nadpisz")
const KLUCZ = "silniki-cennik"

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
  if (!odpowiedz.ok) {
    throw new Error(tresc?.errors?.[0]?.message || `HTTP ${odpowiedz.status}`)
  }
  return tresc
}

function euro(pozycja, kurs, vat) {
  const brutto = (pozycja.silnikPln || 0) + (pozycja.zestawPln || 0)
  return Math.round(brutto / (1 + vat) / kurs)
}

async function main() {
  const plik = JSON.parse(readFileSync(join(KATALOG, "cennik-xo.json"), "utf8"))
  const { kurs, vat, pozycje } = plik

  console.log(`kurs ${kurs} · VAT ${Math.round(vat * 100)}%\n`)
  for (const p of pozycje) {
    const brutto = (p.silnikPln || 0) + (p.zestawPln || 0)
    console.log(
      `  ${p.nazwa.padEnd(40)} ${String(brutto).padStart(7)} zł → ${String(
        euro(p, kurs, vat)
      ).padStart(6)} €   (z: ${p.zrodlo})`
    )
  }

  if (!TOKEN) {
    console.log("\nBrak DIRECTUS_ADMIN_TOKEN — to jest sam podgląd. Uruchom na VPS-ie.")
    return
  }

  const { data } = await directus(
    `/items/panel_ustawienia?filter[klucz][_eq]=${KLUCZ}&fields=id,dane&limit=1`
  ).catch(() => ({ data: [] }))
  const istnieje = data?.[0]

  if (istnieje?.dane?.pozycje?.length) {
    // Wypisujemy, co tam naprawdę siedzi. Bez tego „cennik już jest" nie mówi,
    // czy jest wypełniony, czy to sam szkielet zapisany kliknięciem „Zapisz
    // cennik" na pustej tabeli — a to jest cała różnica.
    const sa = istnieje.dane.pozycje
    const zCena = sa.filter((p) => p.silnikPln !== null && p.silnikPln !== undefined).length
    console.log(`\nW Directusie jest już cennik: ${sa.length} pozycji, z ceną ${zCena}.`)
    for (const p of sa) {
      console.log(
        `  ${String(p.klucz).padEnd(24)} ${String(p.nazwa || "—").padEnd(40)} ` +
          `${p.silnikPln ?? "—"} + ${p.zestawPln ?? "—"} zł`
      )
    }

    if (!NADPISZ) {
      console.log(
        "\nZostawiam go w spokoju — cennik poprawiony w panelu jest świeższy niż plik.\n" +
          "Jeśli powyżej stoi sam szkielet bez cen (albo nazwy się rozjeżdżają),\n" +
          "nadpisz go tym plikiem:  node scripts/silniki/cennik-start.mjs --nadpisz --zapisz"
      )
      return
    }
    console.log("\n--nadpisz: podmieniam powyższe na zawartość pliku.")
  }

  if (!ZAPISZ) {
    console.log("\nPrzebieg na sucho — dodaj --zapisz.")
    return
  }

  const dane = {
    kurs,
    vat,
    zaktualizowano: new Date().toISOString(),
    pozycje: pozycje.map(({ zrodlo, ...reszta }) => reszta),
  }

  // Directus na PATCH wpisu, którego nie ma, oddaje 204 — czyli `ok`, ale bez
  // zapisania czegokolwiek. Dlatego zakładamy wpis wprost, gdy go nie było.
  if (istnieje) {
    await directus(`/items/panel_ustawienia/${istnieje.id}`, {
      method: "PATCH",
      body: JSON.stringify({ dane }),
    })
  } else {
    await directus("/items/panel_ustawienia", {
      method: "POST",
      body: JSON.stringify({ klucz: KLUCZ, dane }),
    })
  }

  console.log(`\nZapisane: ${pozycje.length} pozycji.`)
  console.log("Ceny w konfiguratorach są NIETKNIĘTE — przepisz je z panelu, po obejrzeniu podglądu:")
  console.log("  /narzedzia-8f3a/silniki")
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
