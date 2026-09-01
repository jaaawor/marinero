/**
 * Kraj odwiedzającego — ustalany z adresu IP **przy zapisie odsłony**.
 *
 * Zapisujemy sam dwuliterowy kod kraju, nigdy adresu IP. Kod jest na tyle
 * ogólny, że nie wskazuje osoby, a odpowiada na pytanie, które sprzedawca
 * naprawdę zadaje: czy ruch przy XO idzie z Polski, czy ze Skandynawii.
 *
 * Pytanie o kraj idzie do zewnętrznej usługi, więc obudowane jest trzema
 * zabezpieczeniami — każde z nich chroni przed czym innym:
 *
 * 1. **Pamięć na dobę** — ten sam adres pytamy raz dziennie, a nie przy każdej
 *    odsłonie. Bez tego jeden człowiek klikający po katalogu wysłałby
 *    kilkadziesiąt zapytań.
 * 2. **Limit na minutę** — darmowe usługi mają swój limit i po jego przekroczeniu
 *    zaczynają odsyłać błędy albo blokować adres serwera. Lepiej zostawić kraj
 *    pusty niż stracić odczyt na godzinę.
 * 3. **Krótki limit czasu** — statystyka nie może opóźniać niczego. Zapytanie
 *    idzie z żądania, które przeglądarka i tak wysyła w tle (`keepalive`),
 *    ale wiszące połączenie trzymałoby proces Node'a bez powodu.
 *
 * Bez `GEO_API_URL` używamy darmowego `ip-api.com`. Gdy usługa nie odpowie,
 * kraj zostaje pusty i w statystyce pojawia się jako „nieznany" — zmyślanie
 * kraju byłoby gorsze niż jego brak.
 */

const ADRES = process.env.GEO_API_URL || "http://ip-api.com/json/{ip}?fields=countryCode"
const LIMIT_MS = 1500
const DOBA_MS = 24 * 60 * 60 * 1000
const NA_MINUTE = 40

const zapamietane = new Map<string, { kiedy: number; kraj: string }>()
let okno = { od: 0, ile: 0 }

/** Adresy prywatne i localhost — pytanie o ich kraj nie ma sensu. */
function prywatny(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip.startsWith("::1") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

function wolno(): boolean {
  const teraz = Date.now()
  if (teraz - okno.od > 60_000) okno = { od: teraz, ile: 0 }
  if (okno.ile >= NA_MINUTE) return false
  okno.ile += 1
  return true
}

export async function krajZAdresu(ip: string): Promise<string> {
  if (!ip || prywatny(ip)) return ""

  const zapis = zapamietane.get(ip)
  if (zapis && Date.now() - zapis.kiedy < DOBA_MS) return zapis.kraj

  if (!wolno()) return ""

  try {
    const odpowiedz = await fetch(ADRES.replace("{ip}", encodeURIComponent(ip)), {
      signal: AbortSignal.timeout(LIMIT_MS),
      cache: "no-store",
    })
    if (!odpowiedz.ok) return ""

    const tresc = await odpowiedz.json()
    // Różne usługi nazywają to pole różnie — bierzemy pierwsze, które pasuje.
    const kraj = String(tresc?.countryCode || tresc?.country_code || tresc?.country || "")
      .toUpperCase()
      .slice(0, 2)

    if (/^[A-Z]{2}$/.test(kraj)) {
      zapamietane.set(ip, { kiedy: Date.now(), kraj })
      return kraj
    }
  } catch {
    // Usługa nie odpowiedziała — kraj zostaje pusty.
  }

  return ""
}

/** Polskie nazwy krajów, z których faktycznie przychodzi ruch. */
const NAZWY: Record<string, string> = {
  PL: "Polska", DE: "Niemcy", NO: "Norwegia", SE: "Szwecja", FI: "Finlandia",
  DK: "Dania", NL: "Holandia", BE: "Belgia", FR: "Francja", ES: "Hiszpania",
  IT: "Włochy", GB: "Wielka Brytania", IE: "Irlandia", US: "Stany Zjednoczone",
  CA: "Kanada", CZ: "Czechy", SK: "Słowacja", HU: "Węgry", AT: "Austria",
  CH: "Szwajcaria", UA: "Ukraina", LT: "Litwa", LV: "Łotwa", EE: "Estonia",
  RU: "Rosja", BY: "Białoruś", HR: "Chorwacja", SI: "Słowenia", GR: "Grecja",
  PT: "Portugalia", TR: "Turcja", CN: "Chiny", JP: "Japonia", AU: "Australia",
  AE: "Zjednoczone Emiraty Arabskie", IL: "Izrael", IN: "Indie", BR: "Brazylia",
  SG: "Singapur", RO: "Rumunia", BG: "Bułgaria", RS: "Serbia", LU: "Luksemburg",
  IS: "Islandia", MT: "Malta", CY: "Cypr", MC: "Monako",
}

export function nazwaKraju(kod: string): string {
  if (!kod) return "nieznany"
  return NAZWY[kod.toUpperCase()] || kod.toUpperCase()
}

/** Flaga jako emoji — dwie litery kodu przesunięte w zakres znaków regionalnych. */
export function flagaKraju(kod: string): string {
  if (!/^[A-Za-z]{2}$/.test(kod)) return "🌍"
  return String.fromCodePoint(
    ...kod.toUpperCase().split("").map((litera) => 0x1f1a5 + litera.charCodeAt(0))
  )
}
