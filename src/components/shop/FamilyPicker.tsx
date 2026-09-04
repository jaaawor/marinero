import type { FamilySelector } from "@/lib/product-family"
import { localeHref, normalizeLocale } from "@/lib/i18n"

type FamilyPickerProps = {
  selectors: FamilySelector[]
  locale?: string
}

/**
 * Nazwa wariantu bywa złożona z **oznaczenia i wyjaśnienia**: „L — długa
 * (508 mm)", „AT — trym elektryczny, manetka". Rozdzielamy je, bo to są dwie
 * różne rzeczy: kod jest tym, czego klient szuka w cenniku i na tabliczce
 * silnika, a wyjaśnienie mówi, co ten kod znaczy. Zlepione w jedną linijkę
 * tego samego stopnia czytały się jak lista zdań, a nie jak wybór.
 */
function rozbij(display: string): { kod: string; opis: string } {
  const podzial = display.match(/^(.{1,6})\s+[—–-]\s+(.+)$/)
  if (podzial) return { kod: podzial[1].trim(), opis: podzial[2].trim() }
  return { kod: display, opis: "" }
}

// Wybór wersji produktu: kolumna, sterowanie, kolor, przekątna ekranu. To są
// osobne produkty w Medusie, więc każdy kafelek jest zwykłym linkiem — działa
// bez JS i jest indeksowalny.
export default function FamilyPicker({ selectors, locale = "pl" }: FamilyPickerProps) {
  const current = normalizeLocale(locale)
  if (!selectors.length) return null

  return (
    <div className="mt-8 rounded-sm border border-[#0E1A2B]/12 bg-white">
      {selectors.map((selector, index) => (
        <div
          key={selector.key}
          className={`px-5 py-4 ${index ? "border-t border-[#0E1A2B]/10" : ""}`}
        >
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
              {selector.label}
            </p>
            {/* Wybrana wartość obok etykiety — przy czterech rzędach kafelków
                trzeba było za każdym razem szukać wzrokiem, który jest zaznaczony. */}
            <p className="truncate text-[12px] text-[#0E1A2B]/45">
              {selector.choices.find((choice) => choice.current)?.display || ""}
            </p>
          </div>

          {/*
            Przełącznik segmentowy: jasna szyna, a w niej opcje. Zaznaczona jest
            **biała z obwódką w kolorze akcentu**, nie wypełniona granatem —
            cztery granatowe prostokąty jeden pod drugim przeciągały uwagę
            z kolumny zakupu, a sklep ma być jasny (ta sama zasada co przy
            sekcjach: żadnych ciemnych bloków poza paskiem na samej górze).
          */}
          <div className="inline-flex max-w-full flex-wrap gap-1 rounded-sm border border-[#0E1A2B]/10 bg-[#F4F1EC] p-1">
            {selector.choices.map((choice) => {
              const { kod, opis } = rozbij(choice.display)

              const tresc = (
                <>
                  <span className="block text-[13px] font-semibold leading-tight">{kod}</span>
                  {opis ? (
                    <span className="mt-0.5 block text-[11px] leading-tight text-[#0E1A2B]/50">
                      {opis}
                    </span>
                  ) : null}
                </>
              )

              return choice.current ? (
                <span
                  key={choice.value}
                  aria-current="true"
                  className="min-w-[5rem] rounded-sm bg-white px-3.5 py-2 text-[#0E1A2B] shadow-[0_1px_2px_rgba(14,26,43,0.08)] ring-1 ring-[#2E64A8]"
                >
                  {tresc}
                </span>
              ) : (
                <a
                  key={choice.value}
                  href={localeHref(current, `/sklep/produkt/${choice.handle}`)}
                  className="min-w-[5rem] rounded-sm px-3.5 py-2 text-[#0E1A2B]/65 transition hover:bg-white/70 hover:text-[#0E1A2B]"
                >
                  {tresc}
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
