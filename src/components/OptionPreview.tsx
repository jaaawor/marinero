"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

// Dymek przy opcji konfiguratora: próbka materiału, zdjęcie i/lub krótki opis
// („do czego jest uchwyt narciarza", „co zawiera lodówka").
//
// Dymek jest renderowany PORTALEM do <body>, nie obok przycisku. Lista opcji
// ma `overflow-hidden` (od zaokrąglonych rogów), więc dymek pozycjonowany
// absolutnie wewnątrz niej był przycinany — zostawała sama ramka, a treść
// znikała pod kolejnym wierszem. Portal wychodzi poza to przycinanie,
// a pozycję liczymy z `getBoundingClientRect()` przycisku.
//
// Otwiera się na najechanie ORAZ na kliknięcie i fokus klawiatury. Samo
// najechanie nie wystarcza: na telefonie najechania nie ma i treść dostępna
// wyłącznie pod kursorem po prostu dla tych ludzi nie istnieje.
//
// Kafelek stoi wewnątrz `<label>` opcji, więc kliknięcia mają zatrzymaną
// propagację — bez tego obejrzenie koloru zaznaczałoby opcję i doliczało
// ją do oferty.

type Props = {
  name: string
  color?: string
  image?: string
  description?: string
}

const CARD_WIDTH = 260

export default function OptionPreview({ name, color, image, description }: Props) {
  const [open, setOpen] = useState(false)
  const [spot, setSpot] = useState<{ top: number; left: number; below: boolean } | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const pinned = useRef(false)

  function place() {
    const rect = anchor.current?.getBoundingClientRect()
    if (!rect) return

    // Wysokość dymka zależy od treści; 300 px to bezpieczne przybliżenie
    // wystarczające, żeby zdecydować, czy zmieści się pod przyciskiem.
    const below = rect.bottom + 300 < window.innerHeight || rect.top < 300

    setSpot({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - CARD_WIDTH - 8),
      below,
    })
  }

  function show() {
    place()
    setOpen(true)
  }

  function hide(force = false) {
    if (pinned.current && !force) return
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        pinned.current = false
        setOpen(false)
      }
    }
    function away(event: MouseEvent) {
      if (!anchor.current?.contains(event.target as Node)) {
        pinned.current = false
        setOpen(false)
      }
    }

    // Przewijanie strony zostawiłoby dymek w powietrzu — zamykamy.
    function scrolled() {
      pinned.current = false
      setOpen(false)
    }

    document.addEventListener("keydown", escape)
    document.addEventListener("mousedown", away)
    window.addEventListener("scroll", scrolled, true)
    window.addEventListener("resize", scrolled)
    return () => {
      document.removeEventListener("keydown", escape)
      document.removeEventListener("mousedown", away)
      window.removeEventListener("scroll", scrolled, true)
      window.removeEventListener("resize", scrolled)
    }
  }, [open])

  if (!color && !image && !description) return null

  const onlyText = !color && !image

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`Podgląd: ${name}`}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={() => hide()}
        onFocus={show}
        onBlur={() => hide(true)}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          pinned.current = !pinned.current
          if (pinned.current) show()
          else hide(true)
        }}
        className={
          onlyText
            ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#111827]/25 text-[11px] font-bold text-[#111827]/45 transition hover:border-[#2E64A8] hover:text-[#2E64A8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E64A8]"
            : "block h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[#111827]/15 bg-white transition hover:border-[#2E64A8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E64A8]"
        }
        style={color && !image ? { backgroundColor: color } : undefined}
      >
        {onlyText ? "i" : null}
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : null}
      </button>

      {open && spot
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: "fixed",
                top: spot.top,
                left: spot.left,
                width: CARD_WIDTH,
                transform: spot.below ? undefined : "translateY(-100%)",
              }}
              className="z-[60] rounded-lg border border-[#111827]/10 bg-white p-3 shadow-xl"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => hide()}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={name}
                  className="h-40 w-full rounded-sm object-cover"
                  loading="lazy"
                />
              ) : color ? (
                <div
                  className="h-24 w-full rounded-sm border border-[#111827]/10"
                  style={{ backgroundColor: color }}
                />
              ) : null}

              <p
                className={`text-xs font-semibold leading-5 text-[#111827]/80 ${
                  image || color ? "mt-2" : ""
                }`}
              >
                {name}
              </p>

              {description ? (
                <p className="mt-1 text-xs leading-5 text-[#111827]/55">{description}</p>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
