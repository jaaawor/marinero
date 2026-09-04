// Wczytanie zmiennych środowiskowych tak, jak robi to Next.js.
//
// Skrypty wołane z `--env-file=.env.local` widziały **tylko ten jeden plik**,
// a strona czyta ich kilka: `.env`, `.env.production` i `.env.local`. Klucz
// mógł więc działać w aplikacji i nie istnieć dla skryptu — objaw był mylący
// („brak DIRECTUS_ADMIN_TOKEN", choć zapisy z tym tokenem szły co sekundę).
//
// Dlatego skrypty wczytują pliki same. Zmienna już ustawiona w środowisku
// **wygrywa**: to ona jest tym, czym ktoś świadomie nadpisał plik.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Kolejność jak w Next.js: to, co wczytane wcześniej, ma pierwszeństwo.
const PLIKI = [".env.local", ".env.production", ".env"]

function katalogProjektu() {
  // scripts/lib/env.mjs → dwa poziomy w górę
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function wczytajPlik(sciezka) {
  let tresc
  try {
    tresc = readFileSync(sciezka, "utf8")
  } catch {
    return 0
  }

  let ile = 0

  for (const linia of tresc.split("\n")) {
    const czysta = linia.trim()
    if (!czysta || czysta.startsWith("#")) continue

    // `export NAZWA=…` też się zdarza i też ma zadziałać.
    const bezExport = czysta.startsWith("export ") ? czysta.slice(7).trim() : czysta

    const rowna = bezExport.indexOf("=")
    if (rowna < 1) continue

    const nazwa = bezExport.slice(0, rowna).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nazwa)) continue
    if (process.env[nazwa] !== undefined) continue

    let wartosc = bezExport.slice(rowna + 1).trim()

    // Cudzysłowy zdejmujemy tylko wtedy, gdy obejmują całą wartość — inaczej
    // ucięlibyśmy sekret zawierający cudzysłów w środku.
    if (wartosc.length > 1 && /^(".*"|'.*')$/s.test(wartosc)) {
      wartosc = wartosc.slice(1, -1)
    }

    process.env[nazwa] = wartosc
    ile += 1
  }

  return ile
}

/** Wczytuje pliki `.env*` z katalogu projektu. Zwraca listę tych, które istniały. */
export function wczytajSrodowisko() {
  const katalog = katalogProjektu()
  const znalezione = []

  for (const plik of PLIKI) {
    if (wczytajPlik(join(katalog, plik)) > 0) znalezione.push(plik)
  }

  return znalezione
}

// **Wczytujemy od razu przy imporcie.** Bez tego `import "../lib/env.mjs"` —
// forma, która wygląda dokładnie jak „załatw mi środowisko" — nie robiła
// **nic**: moduł tylko eksportował funkcje, a nikt ich nie wołał. Skrypt
// meldował wtedy „Brak DIRECTUS_ADMIN_TOKEN" stojąc w katalogu, w którym ten
// token leży w `.env.production`. Zmienna już obecna w środowisku i tak
// wygrywa nad plikiem, więc podwójne wczytanie niczego nie psuje, a obie
// formy importu (`import "…"` i `import { wczytajSrodowisko }`) działają.
wczytajSrodowisko()

/**
 * Sprawdza komplet zmiennych i przy braku mówi, gdzie ich szukać — zamiast
 * zostawiać człowieka z „BRAK" i pytaniem, w którym z czterech plików zajrzeć.
 */
export function wymagaj(nazwy) {
  const brakuje = nazwy.filter((n) => !process.env[n])
  if (!brakuje.length) return

  console.error(`\nBrakuje zmiennych: ${brakuje.join(", ")}`)
  console.error(`Szukałem w: ${PLIKI.join(", ")} (katalog ${katalogProjektu()})`)
  console.error("\nSprawdź, w którym pliku siedzą pozostałe klucze:")
  console.error("  grep -l DIRECTUS_ADMIN_TOKEN /opt/marinero-frontend/.env*")
  process.exit(1)
}
