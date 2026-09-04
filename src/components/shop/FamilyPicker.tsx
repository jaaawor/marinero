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
          className={`p-5 ${index ? "border-t border-[#0E1A2B]/10" : ""}`}
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
              {selector.label}
            </p>
            {/* Wybrana wartość obok etykiety — przy czterech rzędach kafelków
                trzeba było za każdym razem szukać wzrokiem, który jest ciemny. */}
            <p className="truncate text-[12px] text-[#0E1A2B]/45">
              {selector.choices.find((choice) => choice.current)?.display || ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selector.choices.map((choice) => {
              const { kod, opis } = rozbij(choice.display)

              const tresc = (
                <>
                  <span className="block text-[13px] font-semibold leading-tight">{kod}</span>
                  {opis ? (
                    <span className="mt-0.5 block text-[11px] leading-tight opacity-60">
                      {opis}
                    </span>
                  ) : null}
                </>
              )

              return choice.current ? (
                <span
                  key={choice.value}
                  aria-current="true"
                  className="min-w-[5.5rem] rounded-sm border border-[#0E1A2B] bg-[#0E1A2B] px-4 py-2.5 text-white"
                >
                  {tresc}
                </span>
              ) : (
                <a
                  key={choice.value}
                  href={localeHref(current, `/sklep/produkt/${choice.handle}`)}
                  className="min-w-[5.5rem] rounded-sm border border-[#0E1A2B]/15 px-4 py-2.5 text-[#0E1A2B]/75 transition hover:border-[#0E1A2B] hover:bg-[#F4F1EC] hover:text-[#0E1A2B]"
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
