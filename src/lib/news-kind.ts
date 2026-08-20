// Rodzaje wpisów — flaga na karcie, żeby od razu było widać, czy to nowość,
// test sprzętu, czy materiał szkoleniowy. Wartość ustawia się w Directusie
// (kolekcja `news`, pole `kind`).

export type NewsKind = {
  value: string
  label: string
  /** Klasy tła i tekstu flagi. */
  className: string
}

const KINDS: Record<string, NewsKind> = {
  news: {
    value: "news",
    label: "Nowość",
    className: "bg-[#2E64A8]/10 text-[#2E64A8]",
  },
  test: {
    value: "test",
    label: "Test",
    className: "bg-emerald-500/12 text-emerald-700",
  },
  szkolenie: {
    value: "szkolenie",
    label: "Szkolenie",
    className: "bg-amber-500/15 text-amber-700",
  },
  poradnik: {
    value: "poradnik",
    label: "Poradnik",
    className: "bg-[#0E1A2B]/8 text-[#0E1A2B]/70",
  },
  wydarzenie: {
    value: "wydarzenie",
    label: "Wydarzenie",
    className: "bg-violet-500/12 text-violet-700",
  },
  promocja: {
    value: "promocja",
    label: "Promocja",
    className: "bg-rose-500/12 text-rose-700",
  },
}

export function getNewsKind(value?: string): NewsKind {
  return KINDS[String(value || "").trim().toLowerCase()] || KINDS.news
}
