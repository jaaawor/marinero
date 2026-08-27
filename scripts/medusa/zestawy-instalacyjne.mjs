#!/usr/bin/env node
//
// Zestawy instalacyjne elektryczne Suzuki — trzy produkty, które na starym
// sklepie były polem dodatkowym przy silniku, a u nas muszą być osobnymi
// wpisami w Medusie (tak wygląda cały katalog po migracji z WooCommerce).
//
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/zestawy-instalacyjne.mjs
//   MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/zestawy-instalacyjne.mjs --zapis
//
// Bez `--zapis` skrypt tylko pokazuje, co by zrobił. Token jest sekretem —
// siedzi w `.env.local` na VPS-ie i **nie wchodzi do repozytorium**, więc ten
// skrypt uruchamia się na serwerze.
//
// Który silnik dostaje zestaw, decyduje metadana `pasuje_do` na zestawie
// (uchwyty silników po przecinku) — dokładnie ten mechanizm czyta
// `src/lib/engine-addons.ts`. Lista silników jest przepisana z podpowiedzi
// starego sklepu: 115BG / 140BBG / 150AP / 175AP / 200AP / 250AP / 300AP,
// czyli same duże, sterowane elektronicznie. Zestaw nie pojawi się przy
// DF 20 ani przy DF 350 ATX — tam nie było go też wcześniej.

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const PK =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")

// Ceny brutto w złotych, wprost ze starego sklepu. Medusa 2 trzyma kwoty
// w jednostce głównej, więc 7700 to 7 700 zł, nie 77 zł.
const ZESTAWY = [
  {
    title: "Zestaw instalacyjny elektryczny Suzuki — manetka topowa SPC keyless",
    handle: "zestaw-instalacyjny-suzuki-manetka-topowa-spc-keyless",
    sku: "SPC-KEYLESS-TOP",
    price: 7700,
  },
  {
    title: "Zestaw instalacyjny elektryczny Suzuki — manetka boczna SPC keyless",
    handle: "zestaw-instalacyjny-suzuki-manetka-boczna-spc-keyless",
    sku: "SPC-KEYLESS-BOK",
    price: 10050,
  },
  {
    title: "Zestaw instalacyjny elektryczny Suzuki — instalacja dwusilnikowa SPC keyless",
    handle: "zestaw-instalacyjny-suzuki-instalacja-dwusilnikowa-spc-keyless",
    sku: "SPC-KEYLESS-2X",
    price: 14350,
  },
]

// Wzorce z podpowiedzi starego sklepu. Dopasowujemy po tytule produktu,
// bo uchwyty po imporcie z WooCommerce bywają rozjechane z nazwą
// (`suzuki-df-150-apx-czarny` to w katalogu „DF 150 APL Biały").
const SILNIKI = [
  /\bDF\s?115\s?BG/i,
  /\bDF\s?140\s?B?BG/i,
  /\bDF\s?150\s?AP/i,
  /\bDF\s?175\s?AP/i,
  /\bDF\s?200\s?AP/i,
  /\bDF\s?250\s?AP/i,
  /\bDF\s?300\s?AP/i,
]

const OPIS =
  "Kompletny zestaw do montażu silnika Suzuki ze sterowaniem elektronicznym: " +
  "manetka, wiązka i stacyjka keyless. Dobierany do silnika — jeśli nie masz " +
  "pewności, którą wersję wybrać, napisz do nas."

function authHeader() {
  return `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`
}

async function admin(path, init = {}) {
  const response = await fetch(`${MEDUSA_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(`${path} → ${response.status}: ${body?.message || text.slice(0, 200)}`)
  }
  return body
}

async function store(path) {
  const response = await fetch(`${MEDUSA_URL}/store${path}`, {
    headers: { "x-publishable-api-key": PK },
  })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
}

/** Wszystkie produkty ze Store API — katalog ma ~390 pozycji, więc dwie strony. */
async function katalog() {
  const wszystkie = []
  for (let offset = 0; ; offset += 200) {
    const { products, count } = await store(
      `/products?limit=200&offset=${offset}&fields=id,title,handle`
    )
    wszystkie.push(...products)
    if (wszystkie.length >= count || !products.length) break
  }
  return wszystkie
}

async function main() {
  if (ZAPIS && !TOKEN) {
    console.error(
      "Brak MEDUSA_ADMIN_TOKEN. Klucz `sk_…` siedzi w .env.local na VPS-ie —\n" +
        "uruchom skrypt tam:  MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/zestawy-instalacyjne.mjs --zapis"
    )
    process.exit(1)
  }

  // Dopasowanie silników idzie z publicznego Store API, więc listę można
  // sprawdzić bez klucza administratora — na przykład zanim wejdzie się na VPS.
  const produkty = await katalog()
  const silniki = produkty
    .filter((p) => SILNIKI.some((wzor) => wzor.test(p.title)))
    .sort((a, b) => a.title.localeCompare(b.title, "pl"))

  console.log(`silników pod zestaw: ${silniki.length}`)
  for (const s of silniki) console.log(`   ${s.handle.padEnd(34)} ${s.title}`)
  if (!silniki.length) throw new Error("nie znalazłem żadnego silnika — sprawdź wzorce")

  const pasujeDo = silniki.map((s) => s.handle).join(",")

  if (!TOKEN) {
    console.log("\nBez MEDUSA_ADMIN_TOKEN dalej nie idę — to jest podgląd dopasowania.")
    console.log("Na VPS-ie:  MEDUSA_ADMIN_TOKEN=sk_... node scripts/medusa/zestawy-instalacyjne.mjs --zapis")
    for (const zestaw of ZESTAWY) {
      console.log(`   + ${zestaw.title} — ${zestaw.price} zł`)
    }
    return
  }

  // Kategorie i kanał sprzedaży bierzemy z tego, co już jest — manetki Suzuki
  // leżą w „Części → Układ sterowania".
  const { product_categories: kategorie } = await admin(
    "/admin/product-categories?limit=200&fields=id,handle"
  )
  const kategorieId = ["czesci", "uklad-sterowania"]
    .map((handle) => kategorie.find((k) => k.handle === handle)?.id)
    .filter(Boolean)

  const { sales_channels: kanaly } = await admin("/admin/sales-channels?limit=10&fields=id,name")
  const kanal = kanaly[0]

  const { shipping_profiles: profile } = await admin(
    "/admin/shipping-profiles?limit=10&fields=id,name"
  )

  console.log(
    `\nkategorie: ${kategorieId.length}, kanał: ${kanal?.name || "—"}, ` +
      `profil wysyłki: ${profile?.[0]?.name || "—"}`
  )

  for (const zestaw of ZESTAWY) {
    const { products: istnieje } = await admin(
      `/admin/products?handle=${zestaw.handle}&fields=id,title&limit=1`
    )

    if (istnieje?.length) {
      console.log(`\n= ${zestaw.title}\n  już jest (${istnieje[0].id}) — aktualizuję pasuje_do`)
      if (ZAPIS) {
        await admin(`/admin/products/${istnieje[0].id}`, {
          method: "POST",
          body: JSON.stringify({ metadata: { pasuje_do: pasujeDo, dostepnosc: "na-zamowienie" } }),
        })
      }
      continue
    }

    console.log(`\n+ ${zestaw.title}\n  ${zestaw.price} zł, pasuje do ${silniki.length} silników`)
    if (!ZAPIS) continue

    await admin("/admin/products", {
      method: "POST",
      body: JSON.stringify({
        title: zestaw.title,
        handle: zestaw.handle,
        description: OPIS,
        status: "published",
        category_ids: kategorieId,
        sales_channels: kanal ? [{ id: kanal.id }] : undefined,
        shipping_profile_id: profile?.[0]?.id,
        options: [{ title: "Wariant", values: ["Standard"] }],
        variants: [
          {
            title: "Standard",
            sku: zestaw.sku,
            manage_inventory: false,
            options: { Wariant: "Standard" },
            prices: [{ amount: zestaw.price, currency_code: "pln" }],
          },
        ],
        metadata: { pasuje_do: pasujeDo, dostepnosc: "na-zamowienie" },
      }),
    })
  }

  console.log(ZAPIS ? "\nZapisane." : "\nPrzebieg na sucho — dodaj --zapis.")
}

main().catch((error) => {
  console.error(String(error.message || error))
  process.exit(1)
})
