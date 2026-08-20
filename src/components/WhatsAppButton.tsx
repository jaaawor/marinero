"use client"

import { usePathname } from "next/navigation"

type WhatsAppButtonProps = {
  /** Numer dla części z łodziami, bez spacji (np. 506549850). */
  boats?: string
  /** Numer dla sklepu — sprzedaż części i elektroniki prowadzi kto inny. */
  shop?: string
  label?: string
}

/** Numer w formacie międzynarodowym dla wa.me — same cyfry, z prefiksem 48. */
function normalizeNumber(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (!digits) return ""
  return digits.startsWith("48") ? digits : `48${digits}`
}

// Pływający przycisk WhatsApp. Numer zależy od tego, gdzie klient akurat jest:
// w sklepie odpisuje obsługa sklepu, w części z łodziami — dział sprzedaży.
// Ścieżkę czytamy w przeglądarce, żeby nie przekazywać wariantu przez każdą
// ze stron z osobna.
export default function WhatsAppButton({ boats, shop, label }: WhatsAppButtonProps) {
  const pathname = usePathname() || "/"

  // `/sklep`, `/en/sklep`, `/sklep/koszyk` — wszystko po ewentualnym prefiksie języka.
  const isShop = /^\/(?:[a-z]{2}\/)?sklep(?:\/|$)/.test(pathname)
  const number = normalizeNumber((isShop ? shop || boats : boats || shop) || "")

  if (!number) return null

  // `z-40`, czyli pod nagłówkiem i nakładkami (menu, filtry, wyszukiwarka) —
  // inaczej zielone kółko leżało na otwartym menu. Odstęp od dołu rośnie
  // o wysokość przyklejonego paska zakupu, gdy ten jest na ekranie.
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label || "WhatsApp"}
      style={{ bottom: "calc(1.25rem + var(--sticky-bar-h, 0px))" }}
      className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-[0_14px_34px_-12px_rgba(37,211,102,0.9)] transition hover:scale-105 hover:bg-[#1FBE5A]"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7 fill-white">
        <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2.1 22l5.35-1.4a9.8 9.8 0 0 0 4.59 1.17h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.02-5.1-2.88-6.96A9.78 9.78 0 0 0 12.04 2Zm0 17.97h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.17.83.85-3.1-.2-.32a8.13 8.13 0 0 1-1.25-4.32c0-4.52 3.68-8.19 8.2-8.19 2.19 0 4.25.85 5.8 2.4a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.22-8.16 8.22Zm4.5-6.15c-.25-.13-1.46-.72-1.68-.8-.23-.08-.39-.13-.56.12-.16.25-.63.8-.78.96-.14.17-.29.19-.53.07-.25-.13-1.04-.39-1.98-1.23-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1.01 2.54c.12.17 1.73 2.64 4.2 3.7.58.26 1.04.41 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z" />
      </svg>
    </a>
  )
}
