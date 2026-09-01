// Lista modułów panelu — same stałe, bez sekretów i bez ciasteczek.
//
// Osobny plik, bo tabelę dostępów rysuje przeglądarka, a `panel-dostep.ts`
// czyta ciasteczko sesji i sięga do Directusa tokenem administratora.
// Importowanie go z komponentu klienckiego wysypuje build i — gdyby przeszło —
// wysłałoby klucz do przeglądarki.

export type Modul = { klucz: string; nazwa: string; grupa: string; href: string }

export const MODULY: Modul[] = [
  {
    klucz: "zamowienia",
    nazwa: "Zamówienia ze sklepu",
    grupa: "Sklep",
    href: "/narzedzia-8f3a/zamowienia",
  },
  { klucz: "produkty", nazwa: "Produkty", grupa: "Sklep", href: "/narzedzia-8f3a/produkty" },
  { klucz: "ceny", nazwa: "Ceny i stany", grupa: "Sklep", href: "/narzedzia-8f3a/ceny" },
  { klucz: "opisy", nazwa: "Opisy produktów", grupa: "Sklep", href: "/narzedzia-8f3a/opisy" },
  {
    klucz: "allegro-zamowienia",
    nazwa: "Zamówienia z Allegro",
    grupa: "Allegro",
    href: "/narzedzia-8f3a/zamowienia-allegro",
  },
  {
    klucz: "allegro-ceny",
    nazwa: "Ceny na Allegro",
    grupa: "Allegro",
    href: "/narzedzia-8f3a/kanaly",
  },
  {
    klucz: "cenniki",
    nazwa: "Cenniki producentów",
    grupa: "Łodzie",
    href: "/narzedzia-8f3a/cenniki",
  },
  {
    klucz: "wyposazenie",
    nazwa: "Wyposażenie modeli",
    grupa: "Łodzie",
    href: "/narzedzia-8f3a/wyposazenie",
  },
  { klucz: "statystyki", nazwa: "Statystyki", grupa: "Inne", href: "/narzedzia-8f3a/statystyki" },
]

export const KLUCZE_MODULOW = MODULY.map((m) => m.klucz)
