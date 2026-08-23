"use client"

import { useEffect, useRef, useState } from "react"

// Podgląd opcji konfiguratora: próbka koloru albo miniaturka zdjęcia,
// a po kliknięciu — powiększenie.
//
// Świadomie NIE jest to dymek na najechanie. Połowa ludzi ogląda konfigurator
// na telefonie, gdzie najechania nie ma, a treść dostępna wyłącznie pod
// kursorem po prostu dla nich nie istnieje. Dlatego próbka jest widoczna
// od razu (to ona niesie informację o kolorze), a powiększenie otwiera się
// kliknięciem — tak samo myszą, palcem i klawiaturą.
//
// Kafelek stoi WEWNĄTRZ `<label>` opcji, więc każde kliknięcie musi mieć
// zatrzymaną propagację — inaczej otwarcie podglądu zaznaczałoby opcję
// i doliczało ją do oferty.

type Props = {
  name: string
  color?: string
  image?: string
}

export default function OptionPreview({ name, color, image }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", away)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("mousedown", away)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

  if (!color && !image) return null

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        aria-label={`Podgląd: ${name}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className="block h-9 w-9 overflow-hidden rounded-full border border-[#111827]/15 bg-white transition hover:border-[#2E64A8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E64A8]"
        style={color && !image ? { backgroundColor: color } : undefined}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute left-0 top-11 z-30 w-60 rounded-lg border border-[#111827]/10 bg-white p-3 shadow-lg"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name}
              className="h-40 w-full rounded-sm object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="h-24 w-full rounded-sm border border-[#111827]/10"
              style={{ backgroundColor: color }}
            />
          )}

          <p className="mt-2 text-xs leading-5 text-[#111827]/60">{name}</p>
        </div>
      ) : null}
    </div>
  )
}
