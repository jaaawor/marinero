#!/usr/bin/env node
//
// Porządki w konfiguratorach XO — dwie poprawki, obie z przeglądu z klientem.
//
//   node scripts/xo/porzadki.mjs                                  # podgląd
//   node scripts/xo/porzadki.mjs --zapisz
//   node scripts/xo/porzadki.mjs --lodzie=xo-dfndr-8,xo-dfndr-9 --zapisz
//   node scripts/xo/porzadki.mjs --lodzie=wszystkie-xo --kolor --zapisz
//
// 1. KOLOR SILNIKA SUZUKI — czarny pierwszy.
//    Czarny jest w standardzie (dopłata 0), biały kosztuje 227 EUR. W grupie
//    Mercury czarny stoi pierwszy, w Suzuki pierwszy był biały — czyli
//    kalkulator otwierał się na wariancie z dopłatą, a klient płacił za coś,
//    czego świadomie nie wybrał.
//
// 2. TAPICERKA KABINY — do usunięcia przy wskazanych łodziach.
//    Formularz zamówienia producenta ma przy DFNDR 8 tylko „Tapicerkę sterówki
//    i pokładu”. Grupa kabinowa weszła z importu i jest wyborem, którego przy
//    tej łodzi nie ma.
//
// Domyślnie robi obie poprawki **tylko przy DFNDR 8** — bo tego dotyczyło
// zgłoszenie. `--kolor` albo `--tapicerka` zawęża do jednej z nich.
//
// Kasowanie jest **nieodwracalne z poziomu skryptu** (Directus trzyma ślad
// w `directus_revisions`, ale odtworzenie to ręczna robota), więc bez `--zapisz`
// skrypt tylko wypisuje, co by zniknęło.

import "../lib/env.mjs"

const DIRECTUS = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || ""
const ZAPISZ = process.argv.includes("--zapisz")

const tylkoKolor = process.argv.includes("--kolor")
const tylkoTapicerka = process.argv.includes("--tapicerka")
const robKolor = !tylkoTapicerka
const robTapicerke = !tylkoKolor

const wskazane = (process.argv.find((a) => a.startsWith("--lodzie=")) || "").split("=")[1] || ""
const LODZIE = wskazane === "wszystkie-xo" ? null : (wskazane || "xo-dfndr-8").split(",")

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

function dotyczy(slug) {
  if (!slug?.startsWith("xo-")) return false
  return LODZIE ? LODZIE.includes(slug) : true
}

async function main() {
  const { data: grupy } = await directus(
    "/items/configurator_groups?limit=-1&fields=id,title,sort,configurator.slug"
  )
  const nasze = (grupy || []).filter((g) => dotyczy(g.configurator?.slug))

  console.log(
    `Łodzie: ${LODZIE ? LODZIE.join(", ") : "wszystkie XO"}` +
      `${ZAPISZ ? "" : "   (podgląd — nic nie zapisuję)"}\n`
  )

  // --- 1. Kolor silnika Suzuki: czarny pierwszy
  if (robKolor) {
    const kolorowe = nasze.filter((g) => /kolor silnika suzuki/i.test(g.title))
    console.log(`KOLOR SILNIKA SUZUKI — ${kolorowe.length} grup`)

    for (const grupa of kolorowe) {
      const { data: opcje } = await directus(
        `/items/configurator_options?limit=-1&fields=id,name,price,sort&filter[group][_eq]=${grupa.id}`
      )
      const czarny = (opcje || []).find((o) => /czarn/i.test(o.name))
      const bialy = (opcje || []).find((o) => /biał|bial/i.test(o.name))
      if (!czarny || !bialy) {
        console.log(`  ? ${grupa.configurator.slug}: nie znalazłem obu kolorów — pomijam`)
        continue
      }
      if (Number(czarny.sort) < Number(bialy.sort)) {
        console.log(`  = ${grupa.configurator.slug}: czarny już jest pierwszy`)
        continue
      }

      console.log(
        `  + ${grupa.configurator.slug}: czarny (${czarny.price} €) na 1., biały (${bialy.price} €) na 2.`
      )
      if (!ZAPISZ) continue

      await directus(`/items/configurator_options/${czarny.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sort: 1 }),
      })
      await directus(`/items/configurator_options/${bialy.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sort: 2 }),
      })
    }
    console.log("")
  }

  // --- 2. Tapicerka kabiny do usunięcia
  if (robTapicerke) {
    const kabinowe = nasze.filter((g) => /^tapicerka kabiny$/i.test(g.title.trim()))
    console.log(`TAPICERKA KABINY — ${kabinowe.length} grup do usunięcia`)

    for (const grupa of kabinowe) {
      const { data: opcje } = await directus(
        `/items/configurator_options?limit=-1&fields=id,name,price&filter[group][_eq]=${grupa.id}`
      )
      console.log(
        `  − ${grupa.configurator.slug}: grupa ${grupa.id} i ${(opcje || []).length} pozycji`
      )
      for (const o of opcje || []) console.log(`      ${o.name} (${o.price} €)`)

      if (!ZAPISZ) continue

      // Najpierw pozycje, potem grupa — odwrotna kolejność zostawiłaby opcje
      // bez rodzica, czyli śmieci nie do znalezienia z panelu.
      for (const o of opcje || []) {
        await directus(`/items/configurator_options/${o.id}`, { method: "DELETE" })
      }
      await directus(`/items/configurator_groups/${grupa.id}`, { method: "DELETE" })
    }
  }

  console.log(
    ZAPISZ
      ? "\nGotowe. Strona pokaże zmiany po najbliższym odświeżeniu ISR (do 5 minut)."
      : "\nPrzebieg na sucho — dodaj --zapisz."
  )
}

main().catch((problem) => {
  console.error(String(problem?.message || problem))
  process.exit(1)
})
