// Kadr zastępczy dla ofert, które nie mają jeszcze własnych zdjęć.
//
// Część ogłoszeń przeniesionych ze starej strony nie miała tam galerii —
// nie ma czego zaimportować. Pusty szary prostokąt wygląda jak błąd, więc
// pokazujemy logo i mówimy wprost, że zdjęcia będą.

import { getDictionary, type Locale } from "@/lib/i18n"

export default function PhotoPlaceholder({
  className = "",
  locale,
}: {
  className?: string
  locale?: Locale
}) {
  const t = getDictionary(locale)

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 bg-[#f6f5f2] ${className}`}
      aria-label={t.photoSoon}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-marinero.png"
        alt=""
        className="h-8 w-auto object-contain opacity-30 md:h-10"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#111827]/35">
        {t.photoSoon}
      </p>
    </div>
  )
}
