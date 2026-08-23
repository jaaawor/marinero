"use client"

import { useState } from "react"

type ProductGalleryProps = {
  images: string[]
  alt: string
}

// Galeria produktu w sklepie: kadr na białym panelu + miniatury.
// Osobna od LightboxGallery (łodzie) — tutaj zdjęcia są pakshotami na białym
// tle, więc trzymamy object-contain i spokojne, jasne otoczenie.
//
// Kadr jest ograniczony wysokością, a od `lg` miniatury stoją PIONOWO obok
// zdjęcia: kwadrat na pełną szerokość kolumny plus listwa pod spodem zajmował
// cały pierwszy ekran i cena schodziła poniżej zgięcia.
export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)

  if (!images.length) {
    return <div className="aspect-square w-full bg-white" />
  }

  const current = images[Math.min(active, images.length - 1)]

  const thumbClass = (index: number) =>
    `flex aspect-square shrink-0 items-center justify-center border bg-white p-2 transition ${
      index === active
        ? "border-[#0E1A2B]"
        : "border-[#0E1A2B]/10 opacity-70 hover:opacity-100"
    }`

  return (
    <div>
      <div className="flex gap-3">
        {/* Miniatury pionowo — od `lg`, gdzie jest na nie miejsce obok kadru */}
        {images.length > 1 ? (
          <div className="hidden w-[68px] shrink-0 flex-col gap-2 lg:flex">
            {images.slice(0, 6).map((image, index) => (
              <button
                key={image + index}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`${alt} — ${index + 1}`}
                className={thumbClass(index)}
              >
                <img src={image} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group relative block min-w-0 flex-1 cursor-zoom-in overflow-hidden border border-[#0E1A2B]/10 bg-white"
        >
          {/* Kadr liczony od wysokości okna, nie od szerokości — kwadrat na
              szerokość kolumny zajmował cały ekran i cena schodziła pod zgięcie.
              Na telefonie niżej niż na desktopie, bo tam kolumna zakupu leży
              pod zdjęciem, a nie obok. */}
          <div className="flex h-[34vh] max-h-[420px] min-h-[220px] items-center justify-center p-5 md:h-[42vh] md:p-8">
            <img
              src={current}
              alt={alt}
              className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.04]"
            />
          </div>

          {images.length > 1 ? (
            <span className="absolute bottom-4 right-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
              {active + 1} / {images.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* Poniżej `lg` miniatury wracają pod kadr, ale mniejsze */}
      {images.length > 1 ? (
        <div className="mt-2.5 grid grid-cols-6 gap-2 lg:hidden">
          {images.slice(0, 6).map((image, index) => (
            <button
              key={image + index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${alt} — ${index + 1}`}
              className={thumbClass(index)}
            >
              <img src={image} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}

      {zoom ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0E1A2B]/95 p-6"
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Zamknij"
            className="absolute right-6 top-6 text-[12px] font-bold uppercase tracking-[0.2em] text-white/60 transition hover:text-white"
          >
            ✕
          </button>

          <img
            src={current}
            alt={alt}
            className="max-h-[85vh] max-w-[92vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  )
}
