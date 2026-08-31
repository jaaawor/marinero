#!/usr/bin/env node
//
// Przywrócenie cen z kopii — do sklepu i na Allegro.
//
//   node scripts/kopie/przywroc.mjs storage/kopie-cen/ceny-2026-09-01-1435.json
//   node scripts/kopie/przywroc.mjs <plik> --zapisz          (naprawdę zapisuje)
//   node scripts/kopie/przywroc.mjs <plik> --zapisz --tylko-sklep
//   node scripts/kopie/przywroc.mjs <plik> --zapisz --tylko-allegro
//
// **Domyślnie to podgląd**: wypisuje, co by zmienił, i nie rusza niczego.
// Przywracanie cen to operacja, przy której pomyłka jest droga, więc zapis
// wymaga świadomego dopisania `--zapisz`.
//
// Przywracamy tylko to, co **naprawdę się różni** — pozycja z ceną zgodną
// z kopią nie generuje żadnego żądania. Przy 400 produktach i trzech
// pomyłkowych zmianach nie ma powodu przepisywać całego katalogu.

import { readFileSync } from "node:fs"
import { wczytajSrodowisko } from "../lib/env.mjs"

wczytajSrodowisko()

const plik = process.argv[2]
const zapisz = process.argv.includes("--zapisz")
const tylkoSklep = process.argv.includes("--tylko-sklep")
const tylkoAllegro = process.argv.includes("--tylko-allegro")

if (!plik) {
  console.error("Podaj plik kopii, np.:")
  console.error("  node scripts/kopie/przywroc.mjs storage/kopie-cen/ceny-2026-09-01-1435.json")
  process.exit(1)
}

let kopia
try {
  kopia = JSON.parse(readFileSync(plik, "utf8"))
} catch (problem) {
  console.error(`Nie mogę odczytać kopii: ${problem.message}`)
  process.exit(1)
}

console.log(`Kopia z ${kopia.kiedy}`)
console.log(`  sklep:   ${(kopia.sklep || []).length} wariantów`)
console.log(`  allegro: ${(kopia.allegro || []).length} ofert`)
console.log(zapisz ? "\nTRYB ZAPISU — zmiany pójdą naprawdę.\n" : "\nPODGLĄD — nic nie zostanie zmienione.\n")

const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const medusaToken = process.env.MEDUSA_ADMIN_TOKEN || ""
const basic = `Basic ${Buffer.from(`${medusaToken}:`).toString("base64")}`

async function medusa(sciezka, init = {}) {
  const odp = await fetch(`${MEDUSA}${sciezka}`, {
    ...init,
    headers: { Authorization: basic, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  if (!odp.ok) throw new Error(`${odp.status} ${(await odp.text()).slice(0, 200)}`)
  return odp.json()
}

// — Sklep —
let zmienioneSklep = 0
let bledySklep = 0

if (!tylkoAllegro) {
  if (!medusaToken) {
    console.error("Brak MEDUSA_ADMIN_TOKEN — pomijam sklep.")
  } else {
    console.log("Sklep:")

    // Bieżące ceny czytamy raz, hurtem — 400 zapytań „jaka jest cena"
    // trwałoby dłużej niż samo przywracanie.
    const teraz = new Map()
    for (let offset = 0; ; offset += 100) {
      const dane = await medusa(
        `/admin/products?limit=100&offset=${offset}&fields=id,variants.id,*variants.prices`
      )
      for (const p of dane.products || []) {
        for (const w of p.variants || []) {
          const pln = (w.prices || []).find((c) => String(c.currency_code).toLowerCase() === "pln")
          teraz.set(w.id, { produktId: p.id, cena: pln ? Number(pln.amount) : null })
        }
      }
      if ((dane.products || []).length < 100) break
    }

    for (const wpis of kopia.sklep || []) {
      if (wpis.cena === null || wpis.cena === undefined) continue

      const obecny = teraz.get(wpis.wariantId)
      if (!obecny) {
        console.log(`  ? ${wpis.sku || wpis.wariantId} — nie ma już takiego wariantu, pomijam`)
        continue
      }
      if (obecny.cena === wpis.cena) continue

      console.log(
        `  ${zapisz ? "→" : "·"} ${(wpis.sku || wpis.tytul).slice(0, 40).padEnd(40)} ` +
          `${obecny.cena ?? "brak"} → ${wpis.cena}`
      )

      if (!zapisz) {
        zmienioneSklep += 1
        continue
      }

      try {
        // Endpoint pojedynczego wariantu: aktualizacja produktu traktuje
        // tablicę `variants` jak komplet i skasowałaby pozostałe wersje.
        await medusa(`/admin/products/${obecny.produktId}/variants/${wpis.wariantId}`, {
          method: "POST",
          body: JSON.stringify({ prices: [{ amount: wpis.cena, currency_code: "pln" }] }),
        })
        zmienioneSklep += 1
      } catch (problem) {
        bledySklep += 1
        console.log(`    ✗ ${problem.message}`)
      }
    }
  }
}

// — Allegro —
let zmienioneAllegro = 0
let bledyAllegro = 0

if (!tylkoSklep && (kopia.allegro || []).length) {
  const clientId = process.env.ALLEGRO_CLIENT_ID
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET
  const directus = process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"
  const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || ""

  if (!clientId || !clientSecret || !directusToken) {
    console.log("\nAllegro: pomijam (brak kluczy albo tokenu Directusa).")
  } else {
    console.log("\nAllegro:")

    const zapisany = await fetch(`${directus}/items/integration_tokens/allegro_refresh`, {
      headers: { Authorization: `Bearer ${directusToken}` },
    })
      .then((o) => (o.ok ? o.json() : null))
      .then((d) => d?.data?.wartosc || "")
      .catch(() => "")

    const auth = await fetch("https://allegro.pl/auth/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: zapisany || process.env.ALLEGRO_REFRESH_TOKEN || "",
      }),
    })

    if (!auth.ok) {
      console.log(`  nie udało się zalogować do Allegro (${auth.status})`)
    } else {
      const dane = await auth.json()

      if (dane.refresh_token) {
        await fetch(`${directus}/items/integration_tokens/allegro_refresh`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${directusToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ wartosc: dane.refresh_token }),
        }).catch(() => undefined)
      }

      const UA = process.env.ALLEGRO_USER_AGENT || "marinero-sklep/1 (+marinero.pl)"
      const naglowki = {
        Authorization: `Bearer ${dane.access_token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": UA,
      }

      const teraz = new Map()
      for (let offset = 0; ; offset += 100) {
        const odp = await fetch(`https://api.allegro.pl/sale/offers?limit=100&offset=${offset}`, {
          headers: naglowki,
        })
        if (!odp.ok) break
        const strona = await odp.json()
        for (const o of strona.offers || []) {
          teraz.set(o.id, Number(o.sellingMode?.price?.amount) || null)
        }
        if (offset + 100 >= (strona.totalCount || 0)) break
      }

      for (const oferta of kopia.allegro) {
        if (oferta.cena === null || oferta.cena === undefined) continue
        if (!teraz.has(oferta.ofertaId)) {
          console.log(`  ? ${oferta.ofertaId} — nie ma już takiej oferty, pomijam`)
          continue
        }
        if (teraz.get(oferta.ofertaId) === oferta.cena) continue

        console.log(
          `  ${zapisz ? "→" : "·"} ${String(oferta.sku || oferta.ofertaId).slice(0, 40).padEnd(40)} ` +
            `${teraz.get(oferta.ofertaId) ?? "brak"} → ${oferta.cena}`
        )

        if (!zapisz) {
          zmienioneAllegro += 1
          continue
        }

        try {
          const odp = await fetch(`https://api.allegro.pl/sale/product-offers/${oferta.ofertaId}`, {
            method: "PATCH",
            headers: naglowki,
            body: JSON.stringify({
              sellingMode: { price: { amount: oferta.cena.toFixed(2), currency: oferta.waluta || "PLN" } },
            }),
          })
          if (!odp.ok) throw new Error(`${odp.status} ${(await odp.text()).slice(0, 150)}`)
          zmienioneAllegro += 1
        } catch (problem) {
          bledyAllegro += 1
          console.log(`    ✗ ${problem.message}`)
        }
      }
    }
  }
}

console.log("")
if (zapisz) {
  console.log(`Przywrócone — sklep: ${zmienioneSklep}, Allegro: ${zmienioneAllegro}`)
  if (bledySklep || bledyAllegro) console.log(`Błędy — sklep: ${bledySklep}, Allegro: ${bledyAllegro}`)
} else {
  console.log(`Do zmiany — sklep: ${zmienioneSklep}, Allegro: ${zmienioneAllegro}`)
  console.log(`Nic nie zmieniono. Żeby zapisać naprawdę:\n  node scripts/kopie/przywroc.mjs ${plik} --zapisz`)
}
