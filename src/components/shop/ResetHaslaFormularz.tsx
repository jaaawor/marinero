"use client"

import { FormEvent, useState } from "react"
import { shop } from "@/components/shop/theme"

/**
 * „Nie pamiętam hasła" — prośba o link do zmiany.
 *
 * Odpowiedź jest **zawsze taka sama**, niezależnie od tego, czy konto na ten
 * adres istnieje. Rozróżnienie („nie ma takiego konta") byłoby wygodne dla
 * klienta i jeszcze wygodniejsze dla kogoś, kto sprawdza listę adresów.
 */
export default function ResetHaslaFormularz() {
  const [email, setEmail] = useState("")
  const [stan, setStan] = useState<"gotowy" | "wysyla" | "wyslane">("gotowy")

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault()
    setStan("wysyla")

    await fetch("/api/konto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ co: "reset", email }),
    }).catch(() => {})

    setStan("wyslane")
  }

  if (stan === "wyslane") {
    return (
      <div className="max-w-md">
        <p className="leading-7">
          Jeśli mamy konto na <strong>{email}</strong>, właśnie poszedł tam mail z odnośnikiem
          do ustawienia nowego hasła. Odnośnik działa raz i przez ograniczony czas.
        </p>

        <p className="mt-5 text-sm leading-7 text-[#0E1A2B]/55">
          Nic nie przyszło? Sprawdź folder ze spamem, a jeśli i tam pusto — napisz na{" "}
          <a href="mailto:biuro@marinero.pl" className="font-semibold text-[#2E64A8] hover:underline">
            biuro@marinero.pl
          </a>
          , odblokujemy konto ręcznie.
        </p>

        <a href="/sklep/konto/logowanie" className={`${shop.btnGhost} mt-7 inline-block`}>
          Wróć do logowania
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={wyslij} className="max-w-md">
      <p className="mb-7 leading-7 text-[#0E1A2B]/65">
        Podaj adres, na który masz u nas konto. Wyślemy odnośnik do ustawienia nowego hasła.
      </p>

      <label className={shop.label} htmlFor="reset-email">
        Adres e-mail
      </label>
      <input
        id="reset-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(zdarzenie) => setEmail(zdarzenie.target.value)}
        className={shop.input}
      />

      <button
        type="submit"
        disabled={stan === "wysyla"}
        className={`${shop.btnPrimary} mt-7 w-full disabled:opacity-60`}
      >
        {stan === "wysyla" ? "Chwileczkę…" : "Wyślij odnośnik"}
      </button>

      <p className="mt-6 text-sm text-[#0E1A2B]/55">
        Przypomniało Ci się?{" "}
        <a href="/sklep/konto/logowanie" className="font-semibold text-[#2E64A8] hover:underline">
          Zaloguj się
        </a>
        .
      </p>
    </form>
  )
}
