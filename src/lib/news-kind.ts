// Rodzaje wpisów — flaga na karcie, żeby od razu było widać, czy to nowość,
// test sprzętu, czy materiał szkoleniowy. Wartość ustawia się w Directusie
// (kolekcja `news`, pole `kind`).

export type NewsKind = {
  value: string
  label: string
  /**
   * Klasy tła i tekstu flagi.
   *
   * Tło ma **80% krycia i biały tekst**, nie 10% jak wcześniej: flaga leży na
   * zdjęciu, a przezroczysta zlewała się z kadrem i była nieczytelna. Ta sama
   * lekcja co przy etykietach stanu na giełdzie.
   */
  className: string
}

const KINDS: Record<string, NewsKind> = {
  news: {
    value: "news",
    label: "Nowość",
    className: "bg-[#2E64A8]/80 text-white",
  },
  test: {
    value: "test",
    label: "Test",
    className: "bg-emerald-600/80 text-white",
  },
  szkolenie: {
    value: "szkolenie",
    label: "Szkolenie",
    className: "bg-amber-600/80 text-white",
  },
  poradnik: {
    value: "poradnik",
    label: "Poradnik",
    className: "bg-[#0E1A2B]/80 text-white",
  },
  targi: {
    value: "targi",
    label: "Targi",
    className: "bg-sky-600/80 text-white",
  },
  wydarzenie: {
    value: "wydarzenie",
    label: "Wydarzenie",
    className: "bg-violet-600/80 text-white",
  },
  promocja: {
    value: "promocja",
    label: "Promocja",
    className: "bg-rose-600/80 text-white",
  },
}

export function getNewsKind(value?: string): NewsKind {
  return KINDS[String(value || "").trim().toLowerCase()] || KINDS.news
}

// Wpisy przeniesione z marinero.pl mają `kind` puste albo domyślne „news",
// więc relacje z targów wyglądały jak nowość w ofercie. Gdy sprzedawca nie
// ustawił rodzaju, zgadujemy go z tytułu — ręczny wybór w Directusie zawsze
// wygrywa.
const HINTS: [RegExp, string][] = [
  [/(targ|boat show|yachting festival|boot d(ü|u)sseldorf|wystaw|hala\s)/i, "targi"],
  [/(test|recenzj|pierwsze wra(ż|z)eni)/i, "test"],
  [/(szkolen|kurs|warsztat)/i, "szkolenie"],
  [/(poradnik|jak wybra|jak dba|krok po kroku)/i, "poradnik"],
  [/(promocj|rabat|wyprzeda|oferta specjalna)/i, "promocja"],
  [/(dealer roku|nagrod|zwyci(ę|e)|jubileusz)/i, "wydarzenie"],
]

export function guessNewsKind(item: { kind?: string; title?: string }): NewsKind {
  const explicit = String(item?.kind || "").trim().toLowerCase()
  if (explicit && explicit !== "news" && KINDS[explicit]) return KINDS[explicit]

  const title = String(item?.title || "")
  const hit = HINTS.find(([pattern]) => pattern.test(title))

  return hit ? KINDS[hit[1]] : KINDS[explicit] || KINDS.news
}
