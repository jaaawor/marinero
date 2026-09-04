// Skąd bierze się konfigurator na stronie modelu.
//
// Do tej pory dane 56 konfiguratorów siedziały wyłącznie w repozytorium, więc
// każda zmiana ceny opcji wymagała wdrożenia. Teraz pierwszeństwo ma Directus
// (klient edytuje w panelu), a repozytorium zostaje jako zapas: gdy Directus
// nie odpowie albo dany model nie został jeszcze przeniesiony, strona
// pokazuje to, co zawsze pokazywała — konfigurator nie znika.

import {
  getConfiguratorData,
  type BoatConfiguratorData,
  type ConfiguratorGroup,
} from "@/lib/configurator-data"
import { zglosAwarie } from "@/lib/alarm"

const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_DIRECTUS_URL ||
  "https://dms.marinero.150197.pl"

const FIELDS = [
  "slug",
  "currency",
  "base_price",
  "base_package_name",
  "show_base_includes",
  "vat_rate",
  "pln_rate",
  "groups.title",
  "groups.type",
  "groups.sort",
  "groups.layout",
  "groups.engine_brand",
  "groups.options.name",
  "groups.options.price",
  "groups.options.selected",
  "groups.options.sort",
  "groups.options.color",
  "groups.options.image",
  "groups.options.description",
  "groups.options.code",
  "groups.options.includes",
].join(",")

/**
 * Pola, których w Directusie **może jeszcze nie być**.
 *
 * Directus na prośbę o nieistniejące pole nie pomija go po cichu — odbija
 * **całe zapytanie** błędem 403 („You don't have permission to access field").
 * Dopisanie `wymaga_kontaktu` do listy pól sprawiło więc, że przez dobę
 * **wszystkie 56 konfiguratorów** leciało z zapasu w repozytorium: strona
 * pokazywała ceny sprzed przeniesienia danych do panelu, przy XO DFNDR 8
 * o kilka tysięcy euro wyższe, i nikt tego nie widział, bo konfigurator
 * wyglądał normalnie.
 *
 * Dlatego pola dokładane później pytamy **osobno**: gdy zapytanie z nimi
 * zostanie odbite, powtarzamy je bez nich i zapamiętujemy to na czas życia
 * procesu. Konfigurator dalej działa, brakuje najwyżej tej jednej nowości —
 * zamiast cichego zjazdu całego cennika do wersji archiwalnej.
 */
const POLA_NOWE = ["wymaga_kontaktu"]

/** Czy Directus już odbił zapytanie z nowymi polami (pamięć procesu). */
let bezNowychPol = false

function listaPol(): string {
  return bezNowychPol ? FIELDS : [...POLA_NOWE, FIELDS].join(",")
}

/** Adres pliku w Directusie — front pyta bez tokenu, pliki są publiczne. */
function assetUrl(id: unknown): string {
  const value = String(id || "").trim()
  // Miniaturka opcji i kafelek koloru mają najwyżej kilkaset pikseli —
  // wysyłanie tam oryginału z aparatu nie ma sensu.
  return value ? `${DIRECTUS_URL}/assets/${value}?width=800&format=webp&quality=82` : ""
}

function bySort(a: { sort?: number }, b: { sort?: number }) {
  return (Number(a.sort) || 0) - (Number(b.sort) || 0)
}

function mapConfigurator(item: any): BoatConfiguratorData | null {
  const groups: ConfiguratorGroup[] = (item?.groups || [])
    .slice()
    .sort(bySort)
    .map((group: any, groupIndex: number) => ({
      id: `g${groupIndex + 1}`,
      title: String(group?.title || ""),
      type: group?.type === "radio" ? "radio" : "checkbox",
      layout: ["kafelki", "kafelki-szer", "kafelki-pion"].includes(group?.layout)
        ? group.layout
        : "lista",
      ...(group?.engine_brand
        ? { engineBrand: String(group.engine_brand).trim().toLowerCase() }
        : {}),
      options: (group?.options || [])
        .slice()
        .sort(bySort)
        .map((option: any, optionIndex: number) => ({
          id: `g${groupIndex + 1}-${optionIndex + 1}`,
          name: String(option?.name || ""),
          price: Number(option?.price) || 0,
          ...(option?.selected ? { selected: true } : {}),
          ...(option?.color ? { color: String(option.color) } : {}),
          ...(option?.image ? { image: assetUrl(option.image) } : {}),
          ...(option?.description ? { description: String(option.description) } : {}),
          ...(option?.code ? { code: String(option.code).trim() } : {}),
          ...(option?.includes
            ? {
                includes: String(option.includes)
                  .split(/[,;\n]/)
                  .map((code: string) => code.trim())
                  .filter(Boolean),
              }
            : {}),
        }))
        .filter((option: any) => option.name),
    }))
    .filter((group: ConfiguratorGroup) => group.title && group.options.length)

  if (!groups.length) return null

  const currency = item?.currency === "USD" ? "USD" : item?.currency === "PLN" ? "PLN" : "EUR"

  return {
    currency,
    vatRate: Number(item?.vat_rate) || 0.23,
    defaultUsdToPln: Number(item?.pln_rate) || 4.3,
    basePrice: Number(item?.base_price) || 0,
    basePackageName: String(item?.base_package_name || ""),
    // Przy 55 z 56 łodzi ten opis mówił tylko „wyposażenie standardowe
    // wymienione poniżej", czyli powtarzał sekcję stojącą tuż pod nim.
    // Dlatego o pokazaniu decyduje przełącznik przy konkretnej łodzi.
    showBaseIncludes: Boolean(item?.show_base_includes),
    wymagaKontaktu: Boolean(item?.wymaga_kontaktu),
    groups,
  }
}

/**
 * Czy ta łódź **ma u nas konfigurator** — sam fakt, bez cen.
 *
 * Strona modelu musi odróżnić „ta łódź nigdy nie miała kalkulatora"
 * od „kalkulator jest, ale właśnie nie działa". W pierwszym przypadku sekcji
 * po prostu nie ma, w drugim stoi tam prośba o kontakt — bo cisza w miejscu,
 * gdzie zawsze była wycena, wygląda jak zepsuta strona.
 */
export function maKonfigurator(slug: string): boolean {
  return Boolean(getConfiguratorData(slug))
}

/**
 * Konfigurator modelu — **wyłącznie z Directusa**.
 *
 * Plik w repozytorium przestał być cichym zamiennikiem cennika. Gdy Directus
 * nie odpowie, zwracamy `null` i strona **nie pokazuje kalkulatora**: lepiej
 * napisać „wycenimy na telefon" niż policzyć ofertę po cenach sprzed roku.
 * Tak właśnie poszło raz — przez dobę wszystkie 56 łodzi liczyło z zapasu,
 * przy XO DFNDR 8 o dziesięć tysięcy euro za drogo, i nikt tego nie widział,
 * bo konfigurator wyglądał normalnie.
 *
 * Zapas (`getConfiguratorData`) zostaje **tylko do sprawdzenia, czy ta łódź
 * w ogóle ma konfigurator** — po to, żeby odróżnić „nie ma czego pokazać"
 * od „nie dało się pobrać". Pierwsze jest normalne, drugie to awaria i idzie
 * mailem do zespołu.
 *
 * Odświeżanie co 5 minut — tyle czeka klient na efekt zmiany w panelu.
 */
export async function getConfigurator(slug: string): Promise<BoatConfiguratorData | null> {
  /** Czy ta łódź ma u nas konfigurator — sam fakt, nie ceny. */
  const maKonfigurator = Boolean(getConfiguratorData(slug))

  const awaria = async (powod: string) => {
    // Łódź bez konfiguratora nie jest awarią — po prostu go nie ma.
    if (!maKonfigurator) return null

    await zglosAwarie(
      "konfigurator-directus",
      "konfigurator nie działa",
      `Nie udało się pobrać konfiguratora z Directusa (${powod}).\n` +
        `Pierwsza łódź, przy której to wyszło: ${slug}.\n\n` +
        "Kalkulator jest ukryty na WSZYSTKICH stronach modeli — klient widzi\n" +
        "prośbę o kontakt zamiast cen. Świadomie: liczenie ofert z zapasowego\n" +
        "cennika w repozytorium raz już wystawiło ceny sprzed roku.\n\n" +
        "Co sprawdzić: czy Directus odpowiada (curl -s -o /dev/null -w '%{http_code}'\n" +
        "https://dms.marinero.150197.pl/server/ping) i czy kolekcja `configurators`\n" +
        "ma publiczny odczyt."
    )
    return null
  }

  const zapytaj = async (pola: string) =>
    fetch(
      `${DIRECTUS_URL}/items/configurators?limit=1&fields=${pola}` +
        `&filter[slug][_eq]=${encodeURIComponent(slug)}&filter[status][_eq]=published`,
      { next: { revalidate: 300 } }
    )

  try {
    let response = await zapytaj(listaPol())

    // Odbite zapytanie z nowym polem znaczy, że Directusa jeszcze nie
    // przygotowano. Powtarzamy bez tych pól — lepiej stracić jeden
    // przełącznik niż cały cennik z panelu.
    if (!response.ok && !bezNowychPol) {
      console.error(
        `Directus odbił konfigurator z polami ${POLA_NOWE.join(", ")} (HTTP ${response.status}).` +
          " Pytam bez nich; uruchom scripts/konfigurator/bramka-directus.mjs --zapisz."
      )
      bezNowychPol = true
      response = await zapytaj(FIELDS)
    }

    if (!response.ok) return awaria(`HTTP ${response.status}`)

    const body = await response.json()
    const wpis = body?.data?.[0]

    // Brak wpisu przy łodzi, która konfigurator ma — to też awaria, tylko
    // cichsza: ktoś mógł go w panelu odznaczyć albo skasować.
    if (!wpis) return awaria("Directus nie zna tej łodzi")

    return mapConfigurator(wpis) || awaria("nie dało się odczytać danych")
  } catch (problem: any) {
    return awaria(problem?.message || "zerwane połączenie")
  }
}
