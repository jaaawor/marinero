"use client"

import { useEffect } from "react"

type ChatwootWidgetProps = {
  /** Adres instancji, np. https://chat.marinero.150197.pl */
  url?: string
  /** `websiteToken` skrzynki „Website" z panelu Chatwoota. */
  token?: string
  locale?: string
}

// Czat na stronie: klient pisze u nas, nie wychodząc do WhatsAppa i nie
// potrzebując konta. Odpowiedzi lądują w jednej skrzynce Chatwoota
// (przeglądarka + aplikacja na telefon), bez opłat za wiadomość.
//
// Bez `CHATWOOT_URL` i `CHATWOOT_TOKEN` komponent nie robi nic — dzięki temu
// kod może stać na produkcji, zanim serwer czatu wystartuje, i nie ładuje ani
// bajta obcego skryptu. Zmienne czyta stopka (komponent serwerowy), więc ich
// zmiana wymaga restartu usługi, nie przebudowy.
export default function ChatwootWidget({ url, token, locale = "pl" }: ChatwootWidgetProps) {
  useEffect(() => {
    if (!url || !token) return

    // Ustawienia muszą być na `window` PRZED wczytaniem sdk.js — skrypt czyta
    // je w momencie startu, późniejsza zmiana nic nie daje.
    ;(window as any).chatwootSettings = {
      // Ten sam róg co WhatsApp — czat siada tuż nad jego ikoną
      // (przesunięcie w pionie robi `globals.css`).
      position: "right",
      type: "standard",
      launcherTitle: "Napisz do nas",
      locale,
      showPopoutButton: false,
    }

    const existing = document.getElementById("chatwoot-sdk")
    if (existing) return

    const script = document.createElement("script")
    script.id = "chatwoot-sdk"
    script.src = `${url.replace(/\/$/, "")}/packs/js/sdk.js`
    script.defer = true
    script.async = true

    script.onload = () => {
      ;(window as any).chatwootSDK?.run({ websiteToken: token, baseUrl: url })
    }

    document.body.appendChild(script)
  }, [url, token, locale])

  return null
}
