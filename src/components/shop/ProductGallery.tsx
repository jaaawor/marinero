"use client"

import { useState } from "react"

type ProductGalleryProps = {
  images: string[]
  alt: string
}

// Galeria produktu w sklepie: duży kadr na białym panelu + listwa miniatur.
// Osobna od LightboxGallery (łodzie) — tutaj zdjęcia są pakshotami na białym tle,
// więc trzymamy object-contain i spokojne, jasne otoczenie.
export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)

  if (!images.length) {
    return <div className="aspect-square w-full bg-white" />
  }

  const current = images[Math.min(active, images.length - 1)]

  return (
    <div>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="group relative block w-full cursor-zoom-in overflow-hidden bg-white"
      >
        <div className="flex aspect-square items-center justify-center p-10 md:p-16">
          <img
            src={current}
            alt={alt}
            className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.04]"
          />
        </div>

        {images.length > 1 ? (
          <span className="absolute bottom-5 right-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
            {active + 1} / {images.length}
          </span>
        ) : null}
      </button>

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((image, index) => (
            <button
              key={image + index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${alt} — ${index + 1}`}
              className={`flex aspect-square items-center justify-center bg-white p-3 transition ${
                index === active
                  ? "outline outline-1 outline-offset-[-1px] outline-[#0E1A2B]"
                  : "opacity-60 hover:opacity-100"
              }`}
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
