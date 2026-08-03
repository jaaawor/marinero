"use client"

import { useEffect, useMemo, useState } from "react"

type LightboxGalleryProps = {
  images: string[]
  alt: string
}

export default function LightboxGallery({ images, alt }: LightboxGalleryProps) {
  const cleanImages = useMemo(
    () => Array.from(new Set((images || []).filter(Boolean))),
    [images]
  )

  const [showAll, setShowAll] = useState(false)
  const [active, setActive] = useState<number | null>(null)

  const visibleImages = showAll ? cleanImages : cleanImages.slice(0, 6)
  const remaining = Math.max(cleanImages.length - visibleImages.length, 0)

  function open(index: number) {
    setActive(index)
  }

  function close() {
    setActive(null)
  }

  function prev() {
    setActive((current) => {
      if (current === null) return current
      return current === 0 ? cleanImages.length - 1 : current - 1
    })
  }

  function next() {
    setActive((current) => {
      if (current === null) return current
      return current === cleanImages.length - 1 ? 0 : current + 1
    })
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (active === null) return
      if (event.key === "Escape") close()
      if (event.key === "ArrowLeft") prev()
      if (event.key === "ArrowRight") next()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, cleanImages.length])

  if (!cleanImages.length) {
    return null
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {visibleImages.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => open(index)}
            className="group overflow-hidden rounded-[1.25rem] bg-white shadow-sm"
          >
            <div className="aspect-[16/10] bg-[#ddd7ca]">
              <img
                src={image}
                alt={alt}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
          </button>
        ))}
      </div>

      {remaining > 0 ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full border border-[#111827]/12 bg-white px-6 py-3 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            Zobacz więcej zdjęć ({remaining})
          </button>
        </div>
      ) : cleanImages.length > 6 ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="rounded-full border border-[#111827]/12 bg-white px-6 py-3 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
          >
            Pokaż mniej
          </button>
        </div>
      ) : null}

      {active !== null ? (
        <div className="fixed inset-0 z-[100] bg-black/92 p-4 md:p-8">
          <button
            type="button"
            onClick={close}
            className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#111827]"
          >
            Zamknij
          </button>

          {cleanImages.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 px-4 py-3 text-xl font-bold text-[#111827]"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 px-4 py-3 text-xl font-bold text-[#111827]"
              >
                ›
              </button>
            </>
          ) : null}

          <div className="flex h-full items-center justify-center">
            <img
              src={cleanImages[active]}
              alt={alt}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#111827]">
            {active + 1} / {cleanImages.length}
          </div>
        </div>
      ) : null}
    </>
  )
}
