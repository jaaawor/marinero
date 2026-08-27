"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { getDictionary, type Locale } from "@/lib/i18n"

type WhatsAppButtonProps = {
  /** Numer dla części z łodziami, bez spacji (np. 506549850). */
  boats?: string
  /** Numer dla sklepu — sprzedaż części i elektroniki prowadzi kto inny. */
  shop?: string
  /** Godziny pracy w formacie „8-16"; poza nimi zielona kropka gaśnie. */
  hours?: string
  /** Czy pod spodem stoi dymek czatu — wtedy WhatsApp wskakuje nad niego. */
  chat?: boolean
  label?: string
  locale?: Locale
}

/** Numer w formacie międzynarodowym dla wa.me — same cyfry, z prefiksem 48. */
function normalizeNumber(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (!digits) return ""
  return digits.startsWith("48") ? digits : `48${digits}`
}

/** Czytelny zapis numeru: 48502574885 → +48 502 574 885. */
function prettyNumber(value: string): string {
  const rest = value.slice(2)
  return `+48 ${rest.replace(/(\d{3})(?=\d)/g, "$1 ")}`.trim()
}

function parseHours(value: string): [number, number] {
  const match = value.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/)
  if (!match) return [8, 16]

  return [Number(match[1]), Number(match[2])]
}

/** Godzina i dzień w Polsce — nie w strefie przeglądarki klienta. */
function warsawNow(): { hour: number; day: number } {
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0")
  const weekday = parts.find((part) => part.type === "weekday")?.value || ""
  const days = ["niedz", "pon", "wt", "śr", "czw", "pt", "sob"]
  const day = days.findIndex((name) => weekday.toLowerCase().startsWith(name))

  return { hour, day: day < 0 ? 1 : day }
}

// Pływający WhatsApp. Sam odnośnik nie mówił klientowi, czy ktoś odbierze,
// więc przycisk otwiera krótkie okno rozmowy: status („jesteśmy online"
// w godzinach pracy), pole na pytanie i przejście do WhatsAppa z gotową
// treścią. Numer zależy od tego, gdzie klient jest — w sklepie odpisuje
// obsługa sklepu, przy łodziach dział sprzedaży.
export default function WhatsAppButton({
  boats,
  shop,
  hours = "8-16",
  chat = false,
  label,
  locale,
}: WhatsAppButtonProps) {
  const pathname = usePathname() || "/"
  const t = getDictionary(locale)

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  // Godzinę liczymy dopiero w przeglądarce — serwer wyrenderowałby stan
  // z chwili budowania strony i kropka potrafiłaby kłamać przez pół dnia.
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const [from, to] = parseHours(hours)

    const check = () => {
      const { hour, day } = warsawNow()
      setOnline(day >= 1 && day <= 5 && hour >= from && hour < to)
    }

    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [hours])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // `/sklep`, `/en/sklep`, `/sklep/koszyk` — wszystko po ewentualnym prefiksie języka.
  const isShop = /^\/(?:[a-z]{2}\/)?sklep(?:\/|$)/.test(pathname)
  const number = normalizeNumber((isShop ? shop || boats : boats || shop) || "")

  if (!number) return null

  const chatHref = `https://wa.me/${number}${
    message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""
  }`

  const [from, to] = parseHours(hours)

  return (
    <>
      {/* Okno rozmowy. `z-40` jak przycisk — pod nagłówkiem i nakładkami. */}
      {open ? (
        <div
          style={{ bottom: `calc(${chat ? "10rem" : "5.75rem"} + var(--sticky-bar-h, 0px))` }}
          className="fixed right-5 z-40 w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-[#111827]/10 bg-white shadow-[0_30px_70px_-25px_rgba(17,24,39,0.5)]"
        >
          <div className="flex items-start justify-between gap-3 bg-[#075E54] px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Marinero</p>

              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/70">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    online ? "bg-[#25D366]" : "bg-white/40"
                  }`}
                />
                {online === null
                  ? "WhatsApp"
                  : online
                    ? t.waOnline
                    : `${t.waOffline} ${from}:00–${to}:00)`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.menuClose}
              className="shrink-0 text-white/70 transition hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="px-4 py-4">
            <p className="rounded-lg rounded-tl-none bg-[#F1EDE4] px-3.5 py-2.5 text-sm leading-6 text-[#111827]/75">
              {t.waGreeting}
            </p>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder={t.waPlaceholder}
              aria-label={t.contactFieldMessage}
              className="mt-3 w-full resize-none rounded-lg border border-[#111827]/15 px-3 py-2.5 text-sm outline-none transition focus:border-[#25D366]"
            />

            <a
              href={chatHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1FBE5A]"
            >
              {t.waSend}
            </a>

            <p className="mt-3 text-center text-[12px] text-[#111827]/40">
              {prettyNumber(number)}
            </p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label || "WhatsApp"}
        aria-expanded={open}
        style={{ bottom: `calc(${chat ? "5.5rem" : "1.25rem"} + var(--sticky-bar-h, 0px))` }}
        className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-[0_14px_34px_-12px_rgba(37,211,102,0.9)] transition hover:scale-105 hover:bg-[#1FBE5A]"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7 fill-white">
          <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2.1 22l5.35-1.4a9.8 9.8 0 0 0 4.59 1.17h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.02-5.1-2.88-6.96A9.78 9.78 0 0 0 12.04 2Zm0 17.97h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.17.83.85-3.1-.2-.32a8.13 8.13 0 0 1-1.25-4.32c0-4.52 3.68-8.19 8.2-8.19 2.19 0 4.25.85 5.8 2.4a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.22-8.16 8.22Zm4.5-6.15c-.25-.13-1.46-.72-1.68-.8-.23-.08-.39-.13-.56.12-.16.25-.63.8-.78.96-.14.17-.29.19-.53.07-.25-.13-1.04-.39-1.98-1.23-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1.01 2.54c.12.17 1.73 2.64 4.2 3.7.58.26 1.04.41 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z" />
        </svg>

        {/* Zielona kropka „jesteśmy dostępni" w godzinach pracy. */}
        {online ? (
          <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4ADE80]" />
        ) : null}
      </button>
    </>
  )
}
