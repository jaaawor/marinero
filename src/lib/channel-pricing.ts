// Ceny na Allegro i OLX liczymy z ceny sklepu według reguł.
//
// Reguła: `percent` dolicza procent (prowizja portalu), `amount` dolicza kwotę,
// `round` zaokrągla wynik (np. do pełnych złotych albo do 0,99).
// Reguły kategorii mają pierwszeństwo przed regułą domyślną kanału.
//
// **Reguły edytuje się w panelu** (`/narzedzia-8f3a/ceny`), a zapisane są
// w Directusie — patrz `panel-ustawienia.ts`. Wartości w tym pliku zostają
// jako **zapas**: gdy Directus nie odpowie, panel i eksport liczą po staremu,
// zamiast pokazywać puste kolumny. Ta sama zasada co przy konfiguratorach.

import { pobierzUstawienie, zapiszUstawienie } from "@/lib/panel-ustawienia"
import {
  applyRule,
  czystaRegula,
  type PriceRule,
  type ReguleKanalu,
  type ZapisaneReguly,
} from "@/lib/reguly-cen"

export { cenaZRegul } from "@/lib/reguly-cen"
export type { PriceRule, ReguleKanalu, ZapisaneReguly }

export type SalesChannel = {
  id: "allegro" | "olx"
  label: string
  /** Reguła stosowana, gdy nic nie pasuje po kategorii. */
  default: PriceRule
  /** Reguły per uchwyt kategorii Medusy. */
  categories?: Record<string, PriceRule>
  /** Marki wyłączone ze sprzedaży na tym kanale (np. zakaz producenta). */
  excludeBrands?: string[]
}

export const SALES_CHANNELS: SalesChannel[] = [
  {
    id: "allegro",
    label: "Allegro",
    // Prowizja Allegro zjada kilka procent — domyślnie doliczamy 9%.
    default: { percent: 9, round: "pelne" },
    categories: {
      // Silniki to duże kwoty, prowizja jest ograniczona kwotowo
      silniki: { percent: 3, round: "pelne" },
      spalinowe: { percent: 3, round: "pelne" },
      elektryczne: { percent: 3, round: "pelne" },
      "czesci-serwisowe": { percent: 12, round: "0.99" },
    },
  },
  {
    id: "olx",
    label: "OLX",
    default: { percent: 5, round: "pelne" },
  },
]

export function isChannelEligible(title: string, channel: SalesChannel): boolean {
  if (!channel.excludeBrands?.length) return true
  const lowered = title.toLowerCase()
  return !channel.excludeBrands.some((brand) => lowered.includes(brand.toLowerCase()))
}

export function getChannel(id: string): SalesChannel | undefined {
  return SALES_CHANNELS.find((channel) => channel.id === id)
}


// — Reguły z panelu —

const KLUCZ_REGUL = "reguly-cen"

/** Reguły z pliku — punkt wyjścia i zapas, gdy Directus nie odpowie. */
export function reguleZRepozytorium(): ZapisaneReguly {
  const wynik: ZapisaneReguly = {}
  for (const kanal of SALES_CHANNELS) {
    wynik[kanal.id] = {
      domyslna: { ...kanal.default },
      kategorie: { ...(kanal.categories || {}) },
    }
  }
  return wynik
}

/** Komplet reguł: to, co zapisane w panelu, uzupełnione o zapas z pliku. */
export async function pobierzReguly(): Promise<ZapisaneReguly> {
  const zapas = reguleZRepozytorium()
  const zapisane = await pobierzUstawienie<ZapisaneReguly>(KLUCZ_REGUL)
  if (!zapisane) return zapas

  const wynik: ZapisaneReguly = {}

  for (const kanal of SALES_CHANNELS) {
    const wpis = zapisane[kanal.id]
    if (!wpis) {
      wynik[kanal.id] = zapas[kanal.id]
      continue
    }

    const kategorie: Record<string, PriceRule> = {}
    for (const [uchwyt, regula] of Object.entries(wpis.kategorie || {})) {
      const czysta = czystaRegula(regula)
      // Reguła bez procentu i bez kwoty nic nie robi — nie trzymamy pustych
      // wierszy, bo w tabeli wyglądałyby na ustawione.
      if (czysta.percent || czysta.amount) kategorie[uchwyt] = czysta
    }

    wynik[kanal.id] = {
      domyslna: wpis.domyslna ? czystaRegula(wpis.domyslna) : zapas[kanal.id].domyslna,
      kategorie,
    }
  }

  return wynik
}

export async function zapiszReguly(reguly: ZapisaneReguly): Promise<boolean> {
  return zapiszUstawienie(KLUCZ_REGUL, reguly)
}
