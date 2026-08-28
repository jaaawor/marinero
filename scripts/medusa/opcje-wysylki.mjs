#!/usr/bin/env node
//
// Zakłada w Medusie opcje wysyłki — po jednej na próg wagowy z cennika
// (`src/lib/wysylka.ts`).
//
// Dlaczego tak, a nie licząc wysyłkę w koszyku: **kwota do zapłaty musi
// pochodzić z Medusy**. Gdyby front podawał własną cenę wysyłki, wystarczyłoby
// podmienić liczbę w przeglądarce, żeby wysłać silnik za złotówkę, a PayU
// potwierdziłoby taką płatność bez mrugnięcia. Dlatego każdy próg jest
// prawdziwą opcją wysyłki z ceną po stronie Medusy, a koszyk tylko **pokazuje
// tę jedną**, która pasuje do wagi.
//
//   node scripts/medusa/opcje-wysylki.mjs            # rozpoznanie + plan
//   node scripts/medusa/opcje-wysylki.mjs --zapis
//
// Wymaga MEDUSA_ADMIN_TOKEN.

const MEDUSA = process.env.NEXT_PUBLIC_MEDUSA_URL || "https://commerce.marinero.150197.pl"
const TOKEN = process.env.MEDUSA_ADMIN_TOKEN || ""
const ZAPIS = process.argv.includes("--zapis")

if (!TOKEN) {
  console.error("Brak MEDUSA_ADMIN_TOKEN.\n  cd /opt/marinero-frontend\n" +
    "  TOKEN=$(grep -h '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2- | tr -d '\"'\\''')\n" +
    "  MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/opcje-wysylki.mjs")
  process.exit(1)
}

// Progi muszą się zgadzać z `src/lib/wysylka.ts` — tam jest źródło prawdy.
// Powielone tutaj, bo skrypt jest zwykłym node'em i nie widzi TypeScriptu.
const PROGI = [
  { doKg: 2.99, cena: 20 },
  { doKg: 10, cena: 30 },
  { doKg: 13.99, cena: 50 },
  { doKg: 25, cena: 350 },
  { doKg: 55, cena: 450 },
  { doKg: 74, cena: 500 },
  { doKg: 105, cena: 600 },
  { doKg: 160, cena: 1000 },
  { doKg: 284, cena: 1300 },
  { doKg: 340, cena: 1800 },
]

// Paczka cięższa niż cennik (powyżej 340 kg) albo z towaru bez podanej wagi.
// Bez tej opcji takie zamówienie **nie dałoby się złożyć** — klient nie miałby
// czego wybrać. Cena 0 zł, koszt dogaduje sprzedawca, tak samo jak przy wysyłce
// zagranicznej.
const WYCENA_INDYWIDUALNA = "Kurier — wycena indywidualna"

// Paczkomat InPost. Front pokazuje go tylko przy paczkach do 25 kg
// (`czyPaczkomatMozliwy` w `src/lib/wysylka.ts`), bo tyle przyjmuje automat.
// Stawkę zmienia się w panelu Medusy, nie tutaj — skrypt zakłada ją raz.
const PACZKOMAT = { nazwa: "Paczkomat InPost", cena: 15 }

function nazwaOpcji(prog, odKg) {
  return `Kurier — ${odKg === 0 ? `do ${prog.doKg} kg` : `${odKg}–${prog.doKg} kg`}`
}

const BASIC = `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`

async function admin(sciezka, init = {}) {
  const odpowiedz = await fetch(`${MEDUSA}${sciezka}`, {
    ...init,
    headers: { Authorization: BASIC, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  const tresc = await odpowiedz.text()
  if (!odpowiedz.ok) throw new Error(`${sciezka} → ${odpowiedz.status}: ${tresc.slice(0, 300)}`)
  return tresc ? JSON.parse(tresc) : {}
}

// — rozpoznanie —

const profile = (await admin("/admin/shipping-profiles?limit=50")).shipping_profiles || []
console.log("profile wysyłkowe:", profile.map((p) => `${p.name} (${p.id})`).join(", ") || "brak")

const lokalizacje =
  (await admin("/admin/stock-locations?limit=50&fields=id,name,*fulfillment_sets.service_zones"))
    .stock_locations || []

const strefy = []
for (const lokalizacja of lokalizacje) {
  for (const zestaw of lokalizacja.fulfillment_sets || []) {
    for (const strefa of zestaw.service_zones || []) {
      strefy.push({ id: strefa.id, nazwa: strefa.name, lokalizacja: lokalizacja.name })
    }
  }
}
console.log("strefy obsługi:", strefy.map((s) => `${s.nazwa} @ ${s.lokalizacja} (${s.id})`).join(", ") || "brak")

const istniejace = (await admin("/admin/shipping-options?limit=200")).shipping_options || []
console.log(`opcje wysyłki już w Medusie: ${istniejace.length}`)
for (const opcja of istniejace) console.log(`   ${opcja.name}`)

if (!profile.length || !strefy.length) {
  console.error(
    "\nBrakuje profilu wysyłkowego albo strefy obsługi — bez nich Medusa nie ma gdzie\n" +
    "powiesić opcji. Zakłada się je w panelu: Ustawienia → Lokalizacje i wysyłka."
  )
  process.exit(1)
}

const profil = profile.find((p) => p.type === "default") || profile[0]
const strefa = strefy[0]
console.log(`\nużyję: profil „${profil.name}", strefa „${strefa.nazwa}"`)

// — plan —

const poNazwie = new Map(istniejace.map((o) => [o.name, o]))
const doZalozenia = []
const doPoprawy = []

let od = 0
for (const prog of PROGI) {
  const nazwa = nazwaOpcji(prog, od)
  const istnieje = poNazwie.get(nazwa)
  if (!istnieje) doZalozenia.push({ nazwa, cena: prog.cena })
  else {
    const teraz = (istnieje.prices || []).find((c) => c.currency_code === "pln")?.amount
    if (Number(teraz) !== prog.cena) doPoprawy.push({ id: istnieje.id, nazwa, cena: prog.cena, teraz })
  }
  od = prog.doKg
}

if (!poNazwie.has(WYCENA_INDYWIDUALNA)) {
  doZalozenia.push({ nazwa: WYCENA_INDYWIDUALNA, cena: 0 })
}

// Cenę paczkomatu poprawiamy tylko wtedy, gdy opcji jeszcze nie ma — inaczej
// każdy przebieg skryptu cofałby stawkę ustawioną w panelu.
if (!poNazwie.has(PACZKOMAT.nazwa)) {
  doZalozenia.push(PACZKOMAT)
}

console.log(`\ndo założenia: ${doZalozenia.length}`)
for (const o of doZalozenia) console.log(`   ${o.nazwa.padEnd(26)} ${o.cena} zł`)
console.log(`do poprawy ceny: ${doPoprawy.length}`)
for (const o of doPoprawy) console.log(`   ${o.nazwa.padEnd(26)} ${o.teraz} → ${o.cena} zł`)

if (!ZAPIS) {
  console.log("\nPrzebieg na sucho — dodaj --zapis.")
  process.exit(0)
}

// — zapis —

let zalozone = 0
for (const opcja of doZalozenia) {
  await admin("/admin/shipping-options", {
    method: "POST",
    body: JSON.stringify({
      name: opcja.nazwa,
      service_zone_id: strefa.id,
      shipping_profile_id: profil.id,
      // Ten sam dostawca co dotychczasowe opcje — wysyłkę nadajemy ręcznie.
      provider_id: "manual_manual",
      price_type: "flat",
      type: { label: "Kurier", description: "Dostawa pod adres", code: "kurier" },
      prices: [{ currency_code: "pln", amount: opcja.cena }],
      rules: [],
    }),
  })
  zalozone += 1
  console.log(`  założone: ${opcja.nazwa}`)
}

let poprawione = 0
for (const opcja of doPoprawy) {
  await admin(`/admin/shipping-options/${opcja.id}`, {
    method: "POST",
    body: JSON.stringify({ prices: [{ currency_code: "pln", amount: opcja.cena }] }),
  })
  poprawione += 1
  console.log(`  poprawione: ${opcja.nazwa}`)
}

console.log(`\nZałożone: ${zalozone}, poprawione: ${poprawione}.`)
console.log("Stare opcje (Odbiór osobisty, wysyłka zagraniczna) zostają nietknięte.")
