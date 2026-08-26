/**
 * Formularze zamówień XO (xlsx) → jeden plik `dane/xo.json` dla `import.py`.
 *
 * Producent wysyła na sezon po jednym skoroszycie na model, z arkuszami
 * „Order form", „Boat Standard", „Layout" i „Upholstery". Czytamy je tym samym
 * kodem, co narzędzie `/admin/cenniki` (`src/lib/order-form.ts`), żeby jedna
 * poprawka w rozpoznawaniu kolumn działała w obu miejscach.
 *
 * Uruchomienie:
 *   npx tsx scripts/xo/czytaj.ts scripts/xo/dane/*.xlsx
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { readSpreadsheet } from "@/lib/xlsx-read"
import { findOrderForm } from "@/lib/order-form"

/** Nazwa łodzi z formularza → nasz slug. Kolejność ma znaczenie: „10S+" przed „10S". */
const SLUGI: [RegExp, string][] = [
  [/EXPLR\s*10S\s*\+/i, "xo-explr-10plus-sport"],
  [/EXPLR\s*10S/i, "xo-explr-10"],
  [/EXPLR\s*9/i, "xo-explr-9"],
  [/EXPLR\s*44/i, "xo-explr-44"],
  [/DFNDR\s*8/i, "xo-dfndr-8"],
]

const pliki = process.argv.slice(2)
if (!pliki.length) {
  console.error("Podaj pliki: npx tsx scripts/xo/czytaj.ts scripts/xo/dane/*.xlsx")
  process.exit(1)
}

const out: Record<string, unknown> = {}
for (const sciezka of pliki) {
  const sheets = readSpreadsheet(readFileSync(sciezka), sciezka)
  const found = findOrderForm(sheets)
  if (!found) {
    console.log(`  ! ${sciezka}: nie rozpoznano formularza zamówienia`)
    continue
  }
  const form = found.form
  const slug = SLUGI.find(([wzor]) => wzor.test(form.boat))?.[1]
  if (!slug) {
    console.log(`  ! ${sciezka}: nie wiem, która to łódź („${form.boat}")`)
    continue
  }
  out[slug] = {
    plik: sciezka.split("/").pop(),
    boat: form.boat,
    basePrice: form.basePrice,
    currency: form.currency,
    groups: form.groups,
    options: form.options,
    // Arkusze poboczne zostawiamy w surowej postaci — wyposażenie standardowe
    // i tapicerki mają własny układ, rozbiera je `import.py`.
    standard: (sheets.find((s) => /standard/i.test(s.name))?.rows || []).map((r) => r.map(String)),
    upholstery: (sheets.find((s) => /uphol/i.test(s.name))?.rows || []).map((r) => r.map(String)),
  }
  console.log(`  ${slug}: ${form.options.length} opcji, baza ${form.basePrice} ${form.currency}`)
}

const cel = join(dirname(pliki[0]), "xo.json")
writeFileSync(cel, JSON.stringify(out, null, 1))
console.log(`\nZapisane: ${cel} (${Object.keys(out).length} łodzi)`)
