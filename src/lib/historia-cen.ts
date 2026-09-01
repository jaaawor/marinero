// Historia cen sklepowych i najniższa cena z 30 dni (dyrektywa Omnibus).
//
// Ogłaszając obniżkę, sprzedawca musi podać **najniższą cenę z 30 dni przed
// obniżką** — nie cenę sprzed tygodnia i nie cenę katalogową. Żeby ją policzyć,
// trzeba mieć zapis, ile ta rzecz kosztowała każdego dnia; sama data ostatniej
// zmiany do niczego tu nie wystarcza.
//
// Historia siedzi w metadanych produktu (`historia_cen`) jako lista wpisów
// `{ d: "2026-03-12", c: 8900 }`. Trzymamy ją **krótko** — 40 dni, najwyżej
// 60 wpisów — bo metadane Medusy jadą razem z produktem w każdej odpowiedzi
// Store API, a do liczenia i tak potrzeba tylko ostatnich trzydziestu dni.
//
// Plik jest wolny od sieci: czyta go panel, kafelek i strona produktu.

export type WpisHistorii = { d: string; c: number }

/** Ile dni wstecz liczy się do Omnibusa. */
export const DNI_OMNIBUS = 30

/** Ile dni w ogóle przechowujemy — z zapasem, żeby granica 30 dni była pełna. */
const DNI_PRZECHOWYWANIA = 40
const MAKS_WPISOW = 60

function dzienISO(data: Date): string {
  return data.toISOString().slice(0, 10)
}

/** Historia z metadanych, odsiana ze śmieci i posortowana od najstarszej. */
export function historiaCen(metadata: Record<string, unknown> | undefined): WpisHistorii[] {
  const surowa = metadata?.historia_cen

  // Bywa tablicą (tak zapisujemy) albo tekstem z JSON-em — Medusa przepuszcza
  // metadane w obie strony i wpis poprawiony ręcznie w panelu wraca stringiem.
  let lista: unknown = surowa
  if (typeof surowa === "string") {
    try {
      lista = JSON.parse(surowa)
    } catch {
      return []
    }
  }
  if (!Array.isArray(lista)) return []

  return lista
    .map((wpis: any) => ({ d: String(wpis?.d || ""), c: Number(wpis?.c) }))
    .filter((wpis) => /^\d{4}-\d{2}-\d{2}$/.test(wpis.d) && Number.isFinite(wpis.c) && wpis.c > 0)
    .sort((a, b) => a.d.localeCompare(b.d))
}

/**
 * Dopisuje cenę do historii i przycina ją do okna przechowywania.
 *
 * Dwie zmiany tego samego dnia zostawiają **niższą** kwotę: to ona przez
 * jakiś czas obowiązywała, a Omnibus pyta o najniższą, nie o ostatnią.
 */
export function dopiszCene(
  metadata: Record<string, unknown> | undefined,
  cena: number,
  kiedy: Date = new Date()
): WpisHistorii[] {
  if (!Number.isFinite(cena) || cena <= 0) return historiaCen(metadata)

  const dzis = dzienISO(kiedy)
  const granica = new Date(kiedy.getTime() - DNI_PRZECHOWYWANIA * 86_400_000)
  const najstarszy = dzienISO(granica)

  const historia = historiaCen(metadata).filter((wpis) => wpis.d >= najstarszy)
  const dzisiejszy = historia.find((wpis) => wpis.d === dzis)

  if (dzisiejszy) {
    dzisiejszy.c = Math.min(dzisiejszy.c, Math.round(cena * 100) / 100)
  } else {
    historia.push({ d: dzis, c: Math.round(cena * 100) / 100 })
  }

  // Przy przekroczeniu limitu tniemy od najstarszych — nowsze dni są te,
  // o które pyta prawo.
  return historia.slice(-MAKS_WPISOW)
}

/**
 * Najniższa cena z 30 dni **przed** dzisiaj.
 *
 * Dzisiejszej ceny nie liczymy: Omnibus pyta o okres poprzedzający obniżkę,
 * a wliczenie kwoty właśnie obniżonej dawałoby „najniższa cena z 30 dni" równą
 * cenie promocyjnej — czyli komunikat, który nic nie mówi.
 *
 * `null` znaczy „nie mamy jeszcze historii" i wtedy **nic nie piszemy** —
 * zmyślona kwota w tym miejscu to wprowadzanie klienta w błąd.
 */
export function najnizszaZ30Dni(
  metadata: Record<string, unknown> | undefined,
  teraz: Date = new Date()
): number | null {
  const dzis = dzienISO(teraz)
  const poczatek = dzienISO(new Date(teraz.getTime() - DNI_OMNIBUS * 86_400_000))

  const okno = historiaCen(metadata).filter((wpis) => wpis.d >= poczatek && wpis.d < dzis)
  if (!okno.length) return null

  return okno.reduce((min, wpis) => Math.min(min, wpis.c), Infinity)
}
