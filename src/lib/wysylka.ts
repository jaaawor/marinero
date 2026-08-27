// Koszt wysyłki kurierem według wagi paczki.
//
// Tabela przepisana z eksportu wtyczki „Fish and Ships", która liczyła wysyłkę
// na starym sklepie. Dwie rzeczy zmieniliśmy świadomie — opisane niżej.
//
// UWAGA na sposób użycia: kwoty stąd służą do **wyświetlenia i do założenia
// opcji wysyłki w Medusie** (`scripts/medusa/opcje-wysylki.mjs`). Kwota, którą
// klient faktycznie płaci, pochodzi z Medusy, nie stąd — inaczej wystarczyłoby
// podmienić liczbę w przeglądarce, żeby wysłać silnik za złotówkę.

export type Prog = {
  /** Górna granica przedziału w kilogramach (włącznie). */
  doKg: number
  /** Koszt w złotych brutto. */
  cena: number
}

// Cennik ze starego sklepu. Przedziały są **ciągłe**: każdy próg obowiązuje
// od granicy poprzedniego (bez niej) do swojej (włącznie).
//
// W oryginale między progami były dziury — 25–26 kg, 55–56, 74–75, 105–106,
// a przede wszystkim **160–260 kg i 284–295 kg**. Waga, która wpadała w dziurę,
// nie łapała żadnej reguły, a wtedy wtyczka **w ogóle nie pokazywała kuriera**:
// klient z paczką 200 kg nie miał czego wybrać. Domknęliśmy je, bo brak opcji
// wysyłki to nie jest cennik, tylko awaria koszyka.
export const PROGI: Prog[] = [
  { doKg: 2.99, cena: 20 },
  // Uwaga: 3–10 kg za darmo, czyli **taniej niż paczka do 3 kg**. Tak było
  // w cenniku starego sklepu i tak zostaje, dopóki klient nie zdecyduje inaczej.
  { doKg: 10, cena: 0 },
  { doKg: 13.99, cena: 50 },
  { doKg: 25, cena: 350 },
  { doKg: 55, cena: 450 },
  { doKg: 74, cena: 500 },
  { doKg: 105, cena: 600 },
  { doKg: 160, cena: 1000 },
  { doKg: 284, cena: 1300 },
  { doKg: 340, cena: 1800 },
]

/** Najcięższa paczka, dla której mamy stawkę. Powyżej — wycena indywidualna. */
export const MAKS_KG = PROGI[PROGI.length - 1].doKg

export type Wycena =
  | { rodzaj: "prog"; prog: Prog; odKg: number }
  /** Za ciężkie na cennik albo nie znamy wagi — koszt ustala sprzedawca. */
  | { rodzaj: "indywidualnie"; powod: "za-ciezkie" | "brak-wagi" }

export function wycenaWysylki(kg: number | null): Wycena {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg < 0) {
    return { rodzaj: "indywidualnie", powod: "brak-wagi" }
  }
  if (kg > MAKS_KG) return { rodzaj: "indywidualnie", powod: "za-ciezkie" }

  let od = 0
  for (const prog of PROGI) {
    if (kg <= prog.doKg) return { rodzaj: "prog", prog, odKg: od }
    od = prog.doKg
  }
  return { rodzaj: "indywidualnie", powod: "za-ciezkie" }
}

/** Nazwa opcji wysyłki w Medusie — ta sama po obu stronach, więc służy za klucz. */
export function nazwaOpcji(prog: Prog, odKg: number): string {
  const zakres = odKg === 0 ? `do ${prog.doKg} kg` : `${odKg}–${prog.doKg} kg`
  return `Kurier — ${zakres}`
}

/** Wszystkie nazwy opcji, w kolejności progów. Używa ich skrypt zakładający je w Medusie. */
export function wszystkieOpcje(): { nazwa: string; cena: number }[] {
  let od = 0
  return PROGI.map((prog) => {
    const wpis = { nazwa: nazwaOpcji(prog, od), cena: prog.cena }
    od = prog.doKg
    return wpis
  })
}

// Medusa trzyma wagę wariantu jako liczbę bez jednostki; u nas są to **gramy**,
// tak jak przyszły z WooCommerce. Jedno miejsce do zmiany, gdyby się to okazało
// inne przy imporcie kolejnej partii towaru.
const GRAMY_W_KILOGRAMIE = 1000

type PozycjaKoszyka = { quantity?: number; variant?: { weight?: number | null } | null }

/**
 * Waga koszyka w kilogramach albo `null`, gdy **którakolwiek** pozycja nie ma
 * podanej wagi. Celowo nie zgadujemy: cennik skacze z 50 zł na 350 zł między
 * 13,99 a 14 kg, więc pomyłka o kilogram to pomyłka o trzysta złotych.
 */
export function wagaKoszyka(pozycje: PozycjaKoszyka[]): number | null {
  let gramy = 0
  for (const pozycja of pozycje) {
    const waga = pozycja.variant?.weight
    if (typeof waga !== "number" || waga <= 0) return null
    gramy += waga * (pozycja.quantity || 1)
  }
  return gramy / GRAMY_W_KILOGRAMIE
}
