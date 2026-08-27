"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Dłuższy akapit, który na telefonie zajmuje pół ekranu, zanim klient dojdzie
 * do tego, po co tu przyszedł — czyli do łodzi. Na wąskim ekranie pokazujemy
 * trzy wiersze i „pokaż więcej", od `md` cały tekst od razu.
 *
 * Przycisk pojawia się **tylko wtedy, gdy tekst faktycznie się nie mieści** —
 * przy krótkim opisie „pokaż więcej" nie miałoby czego pokazać. Sprawdzamy to
 * po zamontowaniu i przy zmianie szerokości okna, bo o obcięciu decyduje
 * `line-clamp`, a nie liczba znaków.
 */
export default function ExpandableText({
  children,
  more,
  less,
  className = "",
}: {
  children: React.ReactNode
  more: string
  less: string
  className?: string
}) {
  const tekst = useRef<HTMLParagraphElement>(null)
  const [rozwiniety, setRozwiniety] = useState(false)
  const [obciety, setObciety] = useState(false)

  useEffect(() => {
    const element = tekst.current
    if (!element) return

    const sprawdz = () => {
      // Przy rozwiniętym tekście nie ma czego mierzyć — stan zostaje.
      if (rozwiniety) return
      setObciety(element.scrollHeight > element.clientHeight + 1)
    }

    sprawdz()
    window.addEventListener("resize", sprawdz)
    return () => window.removeEventListener("resize", sprawdz)
  }, [rozwiniety, children])

  return (
    <div className={className}>
      <p
        ref={tekst}
        className={`text-base leading-7 text-[#111827]/55 ${
          rozwiniety ? "" : "line-clamp-3 md:line-clamp-none"
        }`}
      >
        {children}
      </p>

      {obciety ? (
        <button
          type="button"
          onClick={() => setRozwiniety((stan) => !stan)}
          aria-expanded={rozwiniety}
          className="mt-2 text-sm font-semibold text-[#2E64A8] underline-offset-4 hover:underline md:hidden"
        >
          {rozwiniety ? less : more}
        </button>
      ) : null}
    </div>
  )
}
