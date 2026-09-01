"use client"

import { FormEvent, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { shop } from "@/components/shop/theme"

/**
 * Ustawienie nowego hasła tokenem z maila.
 *
 * Token i adres siedzą w adresie strony — tak je przynosi odnośnik z maila.
 * Do Medusy idą z serwera, przez `/api/konto`, żeby przeglądarka nie musiała
 * znać ani klucza sklepu, ani tego, jak wygląda tamta końcówka.
 */
export default function NoweHasloFormularz() {
  const router = useRouter()
  const parametry = useSearchParams()
  const token = parametry.get("token") || ""
  const email = parametry.get("email") || ""

  const [haslo, setHaslo] = useState("")
  const [powtorka, setPowtorka] = useState("")
  const [stan, setStan] = useState<"gotowy" | "wysyla">("gotowy")
  const [blad, setBlad] = useState("")

  if (!token || !email) {
    return (
      <div className="max-w-md">
        <p className="leading-7">
          Ten odnośnik jest niekompletny — najpewniej program pocztowy przyciął go w połowie.
        </p>
        <a href="/sklep/konto/reset" className={`${shop.btnPrimary} mt-7 inline-block`}>
          Poproś o nowy odnośnik
        </a>
      </div>
    )
  }

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault()
    setBlad("")

    // Powtórka jest po to, żeby literówka nie zamknęła konta na dobre:
    // hasła nie widać, a odnośnik działa tylko raz.
    if (haslo !== powtorka) {
      setBlad("Hasła się różnią.")
      return
    }

    setStan("wysyla")

    let wynik: { ok?: boolean; blad?: string }
    try {
      const odpowiedz = await fetch("/api/konto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ co: "nowe-haslo", token, email, haslo }),
      })
      wynik = await odpowiedz.json()
    } catch {
      wynik = { ok: false, blad: "Nie udało się połączyć z serwerem. Spróbuj ponownie." }
    }

    if (!wynik.ok) {
      setStan("gotowy")
      setBlad(wynik.blad || "Nie udało się zmienić hasła.")
      return
    }

    router.refresh()
    router.push("/sklep/konto")
  }

  return (
    <form onSubmit={wyslij} className="max-w-md">
      <p className="mb-7 leading-7 text-[#0E1A2B]/65">
        Ustawiasz nowe hasło do konta <strong>{email}</strong>.
      </p>

      <div className="grid gap-4">
        <div>
          <label className={shop.label} htmlFor="nowe-haslo">
            Nowe hasło
          </label>
          <input
            id="nowe-haslo"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={haslo}
            onChange={(zdarzenie) => setHaslo(zdarzenie.target.value)}
            className={shop.input}
          />
          <p className="mt-2 text-xs text-[#0E1A2B]/45">Co najmniej 8 znaków.</p>
        </div>

        <div>
          <label className={shop.label} htmlFor="nowe-haslo-2">
            Powtórz hasło
          </label>
          <input
            id="nowe-haslo-2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={powtorka}
            onChange={(zdarzenie) => setPowtorka(zdarzenie.target.value)}
            className={shop.input}
          />
        </div>
      </div>

      {blad ? <p className="mt-5 text-sm text-red-600">{blad}</p> : null}

      <button
        type="submit"
        disabled={stan === "wysyla"}
        className={`${shop.btnPrimary} mt-7 w-full disabled:opacity-60`}
      >
        {stan === "wysyla" ? "Chwileczkę…" : "Zapisz nowe hasło"}
      </button>
    </form>
  )
}
