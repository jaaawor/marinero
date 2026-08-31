#!/usr/bin/env node
//
// Kopia zapasowa cen — ze sklepu (Medusa) i z Allegro.
//
//   cd /opt/marinero-frontend
//   node scripts/kopie/ceny.mjs
//
// Sam odczyt. Zapisuje dwa pliki w `storage/kopie-cen/`:
//   ceny-<data>.json  — komplet danych, z tego przywraca `przywroc.mjs`
//   ceny-<data>.csv   — do zerknięcia w Excelu
//
// `storage/` jest poza repozytorium i przeżywa wdrożenia (skrypt wdrożeniowy
// robi `git reset --hard`, który nie rusza plików nieśledzonych).
//
// Kopia jest warta tyle, ile jej przywrócenie — dlatego obok stoi
// `scripts/kopie/przywroc.mjs`, a nie sam zrzut do pliku.

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { wczytajSrodowisko } from "../lib/env.mjs"

wczytajSrodowisko()

const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const medusaToken = process.env.MEDUSA_ADMIN_TOKEN || ""

if (!medusaToken) {
  console.error("Brak MEDUSA_ADMIN_TOKEN — bez niego nie odczytam cen sklepu.")
  process.exit(1)
}

const basic = `Basic ${Buffer.from(`${medusaToken}:`).toString("base64")}`

async function medusaAdmin(sciezka) {
  const odp = await fetch(`${MEDUSA}${sciezka}`, { headers: { Authorization: basic } })
  if (!odp.ok) throw new Error(`Medusa ${sciezka}: ${odp.status} ${(await odp.text()).slice(0, 200)}`)
  return odp.json()
}

// — Sklep —
console.log("Czytam ceny ze sklepu…")

const produkty = []
const POLA = "id,title,handle,status,variants.id,variants.title,variants.sku,*variants.prices"

for (let offset = 0; ; offset += 100) {
  const dane = await medusaAdmin(`/admin/products?limit=100&offset=${offset}&fields=${POLA}&order=title`)
  const partia = dane.products || []

  for (const p of partia) {
    for (const w of p.variants || []) {
      const ceny = Array.isArray(w.prices) ? w.prices : []
      const pln = ceny.find((c) => String(c.currency_code).toLowerCase() === "pln")
      produkty.push({
        produktId: p.id,
        tytul: p.title || "",
        handle: p.handle || "",
        status: p.status || "",
        wariantId: w.id,
        wariant: w.title || "",
        sku: w.sku || "",
        cena: pln ? Number(pln.amount) : null,
        // Wszystkie waluty, bo przywracanie ma oddać stan, a nie jego skrót.
        ceny: ceny.map((c) => ({ waluta: c.currency_code, kwota: Number(c.amount) })),
      })
    }
  }

  process.stdout.write(`\r  produktów: ${produkty.length}`)
  if (partia.length < 100) break
}

console.log("")

// — Allegro —
// Brak Allegro nie może przewrócić kopii cen sklepu: lepiej mieć połowę
// kopii niż nie mieć żadnej, bo integracja akurat nie odpowiada.
let oferty = []
let bladAllegro = ""

const clientId = process.env.ALLEGRO_CLIENT_ID
const clientSecret = process.env.ALLEGRO_CLIENT_SECRET

if (!clientId || !clientSecret) {
  bladAllegro = "brak kluczy Allegro"
  console.log("Allegro: pomijam (brak kluczy)")
} else {
  try {
    console.log("Czytam ceny z Allegro…")

    const directus = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
    const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || ""

    // Token bierzemy tam, gdzie trzyma go strona.
    const zapisany = directusToken
      ? await fetch(`${directus}/items/integration_tokens/allegro_refresh`, {
          headers: { Authorization: `Bearer ${directusToken}` },
        })
          .then((o) => (o.ok ? o.json() : null))
          .then((d) => d?.data?.wartosc || "")
          .catch(() => "")
      : ""

    const refresh = zapisany || process.env.ALLEGRO_REFRESH_TOKEN || ""
    if (!refresh) throw new Error("brak refresh tokenu")

    const auth = await fetch("https://allegro.pl/auth/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
    })

    if (!auth.ok) throw new Error(`wymiana tokenu: ${auth.status}`)
    const dane = await auth.json()

    // Wymiana zużywa token — nowy MUSI wrócić do Directusa, inaczej sama
    // kopia zapasowa położyłaby integrację.
    if (dane.refresh_token && directusToken) {
      await fetch(`${directus}/items/integration_tokens/allegro_refresh`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${directusToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ wartosc: dane.refresh_token }),
      }).catch(() => undefined)
    }

    const UA = process.env.ALLEGRO_USER_AGENT || "marinero-sklep/1 (+marinero.pl)"

    for (let offset = 0; ; offset += 100) {
      const odp = await fetch(`https://api.allegro.pl/sale/offers?limit=100&offset=${offset}`, {
        headers: {
          Authorization: `Bearer ${dane.access_token}`,
          Accept: "application/vnd.allegro.public.v1+json",
          "User-Agent": UA,
        },
      })
      if (!odp.ok) throw new Error(`oferty: ${odp.status}`)

      const strona = await odp.json()
      for (const o of strona.offers || []) {
        oferty.push({
          ofertaId: o.id,
          nazwa: o.name || "",
          sku: o.external?.id || "",
          cena: Number(o.sellingMode?.price?.amount) || null,
          waluta: o.sellingMode?.price?.currency || "PLN",
          stan: Number(o.stock?.available) || 0,
        })
      }

      process.stdout.write(`\r  ofert: ${oferty.length}`)
      if (offset + 100 >= (strona.totalCount || 0)) break
    }

    console.log("")
  } catch (problem) {
    bladAllegro = problem.message
    console.log(`\nAllegro: nie udało się (${problem.message}) — kopia sklepu i tak powstaje`)
  }
}

// — Zapis —
const teraz = new Date()
const znacznik =
  teraz.toISOString().slice(0, 16).replace("T", "-").replace(":", "") // 2026-09-01-1435

const katalog = join(process.cwd(), "storage", "kopie-cen")
mkdirSync(katalog, { recursive: true })

const kopia = {
  kiedy: teraz.toISOString(),
  medusa: MEDUSA,
  bladAllegro: bladAllegro || undefined,
  sklep: produkty,
  allegro: oferty,
}

const plikJson = join(katalog, `ceny-${znacznik}.json`)
writeFileSync(plikJson, JSON.stringify(kopia, null, 2))

// CSV do zerknięcia okiem — średnik i BOM, żeby polski Excel otworzył go
// od razu w kolumnach, bez kreatora importu.
const poAllegro = new Map(oferty.filter((o) => o.sku).map((o) => [o.sku, o]))
const csv = ["﻿SKU;Nazwa;Adres;Stan;Cena sklep;Cena Allegro;Oferta Allegro"]

for (const p of produkty) {
  const a = p.sku ? poAllegro.get(p.sku) : null
  csv.push(
    [
      p.sku,
      `"${String(p.tytul).replace(/"/g, '""')}"`,
      p.handle,
      p.status,
      p.cena ?? "",
      a?.cena ?? "",
      a?.ofertaId ?? "",
    ].join(";")
  )
}

const plikCsv = join(katalog, `ceny-${znacznik}.csv`)
writeFileSync(plikCsv, csv.join("\n"))

console.log("")
console.log(`Sklep:   ${produkty.length} wariantów (${produkty.filter((p) => p.cena !== null).length} z ceną w PLN)`)
console.log(`Allegro: ${oferty.length} ofert (${oferty.filter((o) => o.sku).length} z sygnaturą)`)
console.log("")
console.log(`Zapisane:\n  ${plikJson}\n  ${plikCsv}`)
console.log("")
console.log("Przywrócenie (najpierw podgląd, nic nie zmienia):")
console.log(`  node scripts/kopie/przywroc.mjs ${plikJson}`)
