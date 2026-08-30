"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { zglosOdslone } from "@/lib/zglos-odslone"

/**
 * Liczy odsłony stron. Stoi w layoucie, więc łapie i pierwsze wejście,
 * i każdą kolejną nawigację po serwisie (Next przechodzi między stronami
 * bez przeładowania, więc bez tego liczyłoby się tylko pierwsze wejście).
 *
 * Dział rozpoznajemy po adresie, a nie po miejscu wstawienia komponentu:
 * sklep i łodzie mają wspólny layout, a `/sklep` bywa otwierany prosto
 * z wyniku wyszukiwania, bez przechodzenia przez stronę główną.
 */
export default function PageViewTracker() {
  const sciezka = usePathname()

  useEffect(() => {
    if (!sciezka) return

    // Prefiks języka (`/en/sklep`) nie zmienia tego, czym jest strona.
    const bezJezyka = sciezka.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"
    zglosOdslone(sciezka, bezJezyka.startsWith("/sklep") ? "sklep" : "lodzie")
  }, [sciezka])

  return null
}
