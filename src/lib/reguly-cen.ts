// Reguły cen kanałów: typy i samo liczenie. Bez sieci i bez sekretów.
//
// Osobny plik, bo tabelę reguł rysuje **panel w przeglądarce** i przelicza
// podpowiadane ceny na żywo, przy każdej zmianie procentu. `channel-pricing.ts`
// sięga po Directusa kluczem administratora — importowanie go z komponentu
// klienckiego wciągnęłoby ten klucz do paczki wysyłanej przeglądarce.

export type PriceRule = {
  percent?: number
  amount?: number
  /** „pelne" → 199,00 · „0.99" → 198,99 · brak → bez zaokrąglania */
  round?: "pelne" | "0.99"
}

/** Reguły dla jednego kanału: domyślna plus wyjątki na kategorie. */
export type ReguleKanalu = { domyslna: PriceRule; kategorie: Record<string, PriceRule> }

export type ZapisaneReguly = Record<string, ReguleKanalu>

export const ZAOKRAGLENIA = [
  { wartosc: "", nazwa: "bez zaokrąglania" },
  { wartosc: "pelne", nazwa: "do pełnych złotych" },
  { wartosc: "0.99", nazwa: "końcówka 0,99" },
] as const

export function applyRule(price: number, rule: PriceRule): number {
  let value = price
  if (rule.percent) value *= 1 + rule.percent / 100
  if (rule.amount) value += rule.amount

  if (rule.round === "pelne") return Math.round(value)
  if (rule.round === "0.99") return Math.floor(value) + 0.99
  return Math.round(value * 100) / 100
}

/**
 * Cena kanału z reguł.
 *
 * Reguła kategorii wygrywa z domyślną — silniki mają inną prowizję niż
 * drobne części i liczenie ich jedną stawką rozjeżdżało marżę w obie strony.
 */
export function cenaZRegul(
  cenaSklepu: number | null,
  reguly: ReguleKanalu | undefined,
  uchwytyKategorii: string[] = []
): number | null {
  if (typeof cenaSklepu !== "number" || !reguly) return null

  const zKategorii = uchwytyKategorii.map((uchwyt) => reguly.kategorie[uchwyt]).find(Boolean)
  return applyRule(cenaSklepu, zKategorii || reguly.domyslna)
}

/** Odsiewa śmieci z zapisanego JSON-a — wpis jest edytowalny w Directusie. */
export function czystaRegula(surowa: unknown): PriceRule {
  const wejscie = (surowa && typeof surowa === "object" ? surowa : {}) as Record<string, unknown>

  const procent = Number(wejscie.percent)
  const kwota = Number(wejscie.amount)
  const zaokraglenie = wejscie.round

  return {
    ...(Number.isFinite(procent) && procent !== 0 ? { percent: procent } : {}),
    ...(Number.isFinite(kwota) && kwota !== 0 ? { amount: kwota } : {}),
    ...(zaokraglenie === "pelne" || zaokraglenie === "0.99"
      ? { round: zaokraglenie as PriceRule["round"] }
      : {}),
  }
}
