"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { shop } from "@/components/shop/theme"

type Tryb = "logowanie" | "rejestracja"

/**
 * Logowanie i rejestracja. Jeden komponent, bo różnią się trzema polami
 * i napisem na przycisku — dwa osobne rozjeżdżałyby się przy każdej poprawce.
 */
export default function KontoFormularz({ tryb }: { tryb: Tryb }) {
  const router = useRouter()
  const rejestracja = tryb === "rejestracja"

  const [pola, setPola] = useState({
    email: "",
    haslo: "",
    imie: "",
    nazwisko: "",
    telefon: "",
  })
  const [stan, setStan] = useState<"gotowy" | "wysyla">("gotowy")
  const [blad, setBlad] = useState("")

  function pole(nazwa: keyof typeof pola) {
    return {
      value: pola[nazwa],
      onChange: (zdarzenie: { target: { value: string } }) =>
        setPola((teraz) => ({ ...teraz, [nazwa]: zdarzenie.target.value })),
      className: shop.input,
    }
  }

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault()
    setStan("wysyla")
    setBlad("")

    const wynik = await fetch("/api/konto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ co: tryb, ...pola }),
    })
      .then((odpowiedz) => odpowiedz.json())
      .catch(() => ({ ok: false, blad: "Brak połączenia. Spróbuj ponownie." }))

    if (!wynik.ok) {
      setStan("gotowy")
      setBlad(wynik.blad || "Nie udało się.")
      return
    }

    // `refresh()` przed `push()`, żeby nagłówek od razu wiedział, że jest
    // zalogowany — bez tego „Moje konto" pokazywałoby się dopiero po
    // odświeżeniu strony.
    router.refresh()
    router.push("/sklep/konto")
  }

  return (
    <form onSubmit={wyslij} className="max-w-md">
      <div className="grid gap-4">
        {rejestracja ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={shop.label} htmlFor="imie">
                  Imię
                </label>
                <input id="imie" required {...pole("imie")} />
              </div>
              <div>
                <label className={shop.label} htmlFor="nazwisko">
                  Nazwisko
                </label>
                <input id="nazwisko" required {...pole("nazwisko")} />
              </div>
            </div>

            <div>
              <label className={shop.label} htmlFor="telefon">
                Telefon
              </label>
              <input id="telefon" type="tel" {...pole("telefon")} />
            </div>
          </>
        ) : null}

        <div>
          <label className={shop.label} htmlFor="email">
            Adres e-mail
          </label>
          <input id="email" type="email" required autoComplete="email" {...pole("email")} />
        </div>

        <div>
          <label className={shop.label} htmlFor="haslo">
            Hasło
          </label>
          <input
            id="haslo"
            type="password"
            required
            minLength={rejestracja ? 8 : undefined}
            autoComplete={rejestracja ? "new-password" : "current-password"}
            {...pole("haslo")}
          />
          {rejestracja ? (
            <p className="mt-2 text-xs text-[#0E1A2B]/45">Co najmniej 8 znaków.</p>
          ) : null}
        </div>
      </div>

      {blad ? <p className="mt-5 text-sm text-red-600">{blad}</p> : null}

      <button
        type="submit"
        disabled={stan === "wysyla"}
        className={`${shop.btnPrimary} mt-7 w-full disabled:opacity-60`}
      >
        {stan === "wysyla" ? "Chwileczkę…" : rejestracja ? "Załóż konto" : "Zaloguj się"}
      </button>

      <p className="mt-6 text-sm text-[#0E1A2B]/55">
        {rejestracja ? (
          <>
            Masz już konto?{" "}
            <a href="/sklep/konto/logowanie" className="font-semibold text-[#2E64A8] hover:underline">
              Zaloguj się
            </a>
            .
          </>
        ) : (
          <>
            Nie masz konta?{" "}
            <a href="/sklep/konto/rejestracja" className="font-semibold text-[#2E64A8] hover:underline">
              Załóż je
            </a>
            . Zakupy możesz też zrobić bez zakładania konta.
          </>
        )}
      </p>
    </form>
  )
}
