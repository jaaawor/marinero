// Kadr zastępczy dla ofert, które nie mają jeszcze własnych zdjęć.
//
// Część ogłoszeń przeniesionych ze starej strony nie miała tam galerii —
// nie ma czego zaimportować. Pusty szary prostokąt wygląda jak błąd, więc
// pokazujemy powtórzone logo i mówimy wprost, że zdjęcia będą.

export default function PhotoPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 bg-[#f6f5f2] ${className}`}
      aria-label="Zdjęcia wkrótce"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-25">
        {[0, 1, 2].map((i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src="/logo-marinero.png"
            alt=""
            className="h-6 w-auto object-contain md:h-7"
          />
        ))}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#111827]/35">
        Zdjęcia wkrótce
      </p>
    </div>
  )
}
