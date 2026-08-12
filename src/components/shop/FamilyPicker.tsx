import type { FamilySelector } from "@/lib/product-family"
import { localeHref, normalizeLocale } from "@/lib/i18n"

type FamilyPickerProps = {
  selectors: FamilySelector[]
  locale?: string
}

// Wybór wersji produktu jak rozmiaru koszulki: kolumna, sterowanie, kolor,
// przekątna ekranu. To osobne produkty w Medusie, więc każdy kafelek jest
// zwykłym linkiem — działa bez JS i jest indeksowalny.
export default function FamilyPicker({ selectors, locale = "pl" }: FamilyPickerProps) {
  const current = normalizeLocale(locale)
  if (!selectors.length) return null

  return (
    <div className="mt-8 space-y-6">
      {selectors.map((selector) => (
        <div key={selector.key}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40">
            {selector.label}
          </p>

          <div className="flex flex-wrap gap-2">
            {selector.choices.map((choice) =>
              choice.current ? (
                <span
                  key={choice.value}
                  aria-current="true"
                  className="rounded-sm border border-[#0E1A2B] bg-[#0E1A2B] px-4 py-2.5 text-[13px] font-semibold text-white"
                >
                  {choice.display}
                </span>
              ) : (
                <a
                  key={choice.value}
                  href={localeHref(current, `/sklep/produkt/${choice.handle}`)}
                  className="rounded-sm border border-[#0E1A2B]/15 px-4 py-2.5 text-[13px] text-[#0E1A2B]/70 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B]"
                >
                  {choice.display}
                </a>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
