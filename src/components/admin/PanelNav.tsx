"use client"

import { usePathname, useRouter } from "next/navigation"

type Zakladka = { href: string; nazwa: string; modul: string }

// Zakładki w trzech grupach, bo narzędzia dotyczą trzech różnych rzeczy
// i wrzucone w jeden rząd wyglądały jak przypadkowa lista.
export const GRUPY: { nazwa: string; pozycje: Zakladka[] }[] = [
  {
    nazwa: "Sklep",
    pozycje: [
      { href: "/narzedzia-8f3a/zamowienia", nazwa: "Zamówienia", modul: "zamowienia" },
      { href: "/narzedzia-8f3a/produkty", nazwa: "Produkty", modul: "produkty" },
      { href: "/narzedzia-8f3a/ceny", nazwa: "Ceny", modul: "ceny" },
      { href: "/narzedzia-8f3a/opisy", nazwa: "Opisy", modul: "opisy" },
    ],
  },
  {
    // Cen na Allegro nie ma tu osobno: stoją w zakładce „Ceny", obok cen
    // sklepowych. Dwie tabele z tymi samymi liczbami to dwa miejsca do
    // sprawdzania, kiedy coś się nie zgadza.
    nazwa: "Allegro",
    pozycje: [
      {
        href: "/narzedzia-8f3a/zamowienia-allegro",
        nazwa: "Zamówienia",
        modul: "allegro-zamowienia",
      },
    ],
  },
  {
    nazwa: "Łodzie",
    pozycje: [
      { href: "/narzedzia-8f3a/cenniki", nazwa: "Cenniki", modul: "cenniki" },
      { href: "/narzedzia-8f3a/wyposazenie", nazwa: "Wyposażenie", modul: "wyposazenie" },
    ],
  },
]

/**
 * Pasek pokazuje **tylko to, co wolno otworzyć**. Zakładka prowadząca do
 * komunikatu „nie masz dostępu" jest gorsza niż jej brak: wygląda jak awaria,
 * a nie jak decyzja.
 */
export default function PanelNav({
  kto,
  moduly = [],
  glowny = false,
}: {
  kto?: string
  moduly?: string[]
  glowny?: boolean
}) {
  const sciezka = usePathname()
  const router = useRouter()

  async function wyloguj() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {})
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#111827]/10 bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 md:px-8">
        <a href="/narzedzia-8f3a" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo-marinero.png" alt="" className="h-6 w-auto object-contain" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#111827]/35">
            Panel
          </span>
        </a>

        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-7 gap-y-2">
          {GRUPY.map((grupa) => ({
            nazwa: grupa.nazwa,
            pozycje: grupa.pozycje.filter((pozycja) => moduly.includes(pozycja.modul)),
          }))
            .filter((grupa) => grupa.pozycje.length)
            .map((grupa) => (
            <div key={grupa.nazwa} className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#111827]/25">
                {grupa.nazwa}
              </span>
              {grupa.pozycje.map((pozycja) => {
                const aktywna = sciezka === pozycja.href
                return (
                  <a
                    key={pozycja.href}
                    href={pozycja.href}
                    className={`whitespace-nowrap text-sm transition ${
                      aktywna
                        ? "font-semibold text-[#111827]"
                        : "text-[#111827]/55 hover:text-[#2E64A8]"
                    }`}
                  >
                    {pozycja.nazwa}
                  </a>
                )
              })}
            </div>
            ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {moduly.includes("statystyki") ? (
            <a
              href="/narzedzia-8f3a/statystyki"
              className={`whitespace-nowrap text-sm transition ${
                sciezka === "/narzedzia-8f3a/statystyki"
                  ? "font-semibold text-[#111827]"
                  : "text-[#111827]/55 hover:text-[#2E64A8]"
              }`}
            >
              Statystyki
            </a>
          ) : null}

          {glowny ? (
            <a
              href="/narzedzia-8f3a/konta"
              className={`whitespace-nowrap text-sm transition ${
                sciezka === "/narzedzia-8f3a/konta"
                  ? "font-semibold text-[#111827]"
                  : "text-[#111827]/55 hover:text-[#2E64A8]"
              }`}
            >
              Konta
            </a>
          ) : null}

          {kto ? <span className="text-sm text-[#111827]/35">{kto}</span> : null}

          <button
            type="button"
            onClick={wyloguj}
            className="text-sm text-[#111827]/45 transition hover:text-[#2E64A8]"
          >
            Wyloguj
          </button>
        </div>
      </div>
    </header>
  )
}
