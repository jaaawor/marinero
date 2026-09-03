"use client"

import { useEffect, useState } from "react"
import BoatConfigurator from "@/components/BoatConfigurator"
import type { OfferContact } from "@/components/BoatConfigurator"
import type { BoatConfiguratorData } from "@/lib/configurator-data"
import type { StandardEquipmentGroup } from "@/lib/standard-equipment-data"

type Props = {
  modelName: string
  slug: string
  brandName?: string
  offerContacts?: OfferContact[]
  locale?: string
}

/**
 * Konfigurator za bramką kontaktową — przy łodziach, którym włączono
 * `configurators.wymaga_kontaktu` (u nas: Aquile).
 *
 * Dwie rzeczy, które łatwo zrobić źle i które są tu zrobione na odwrót:
 *
 * 1. **Danych konfiguratora nie ma w HTML-u strony.** Gdyby strona modelu
 *    wysyłała opcje i ceny, a bramka tylko je zasłaniała, wystarczyłoby
 *    zajrzeć w źródło — i zostałby formularz, który nikogo nie zatrzymuje,
 *    a wszystkich drażni. Dane przychodzą z `/api/konfigurator/dane` dopiero
 *    po odblokowaniu.
 * 2. **O dostęp pytamy z przeglądarki**, nie w komponencie serwerowym.
 *    Sięgnięcie po ciasteczko przy renderze wyłączyłoby ISR na wszystkich
 *    79 stronach łodzi. Ta sama zasada co przy „Moje konto" w sklepie.
 *
 * Bilet żyje rok, więc kto raz zostawił kontakt, wraca prosto do kalkulatora.
 */
export default function KonfiguratorBramka({
  modelName,
  slug,
  brandName,
  offerContacts,
  locale = "pl",
}: Props) {
  const [stan, setStan] = useState<"sprawdzam" | "zamkniete" | "otwarte">("sprawdzam")
  const [config, setConfig] = useState<BoatConfiguratorData | null>(null)
  const [wyposazenie, setWyposazenie] = useState<StandardEquipmentGroup[]>([])
  const [imie, setImie] = useState("")
  const [email, setEmail] = useState("")
  const [pulapka, setPulapka] = useState("")
  const [wysylam, setWysylam] = useState(false)
  const [blad, setBlad] = useState("")

  async function pobierzDane() {
    const odpowiedz = await fetch(`/api/konfigurator/dane?slug=${encodeURIComponent(slug)}`)
    const wynik = await odpowiedz.json().catch(() => null)

    if (!odpowiedz.ok || !wynik?.ok) return false

    setConfig(wynik.config)
    setWyposazenie(wynik.wyposazenie || [])
    setStan("otwarte")
    return true
  }

  useEffect(() => {
    let zywy = true

    fetch("/api/konfigurator/dostep")
      .then((o) => o.json())
      .then(async (wynik) => {
        if (!zywy) return

        // Bez tokenu do Directusa kontakt nie miałby gdzie wylądować, więc
        // bramka byłaby formularzem donikąd — wtedy konfigurator jest otwarty.
        if (!wynik?.bramkaDziala || wynik?.odblokowany) {
          if (await pobierzDane()) return
        }
        if (zywy) setStan("zamkniete")
      })
      .catch(() => zywy && setStan("zamkniete"))

    return () => {
      zywy = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function odblokuj(zdarzenie: React.FormEvent) {
    zdarzenie.preventDefault()
    setBlad("")
    setWysylam(true)

    try {
      const odpowiedz = await fetch("/api/konfigurator/dostep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imie, email, website: pulapka, modelSlug: slug, modelName }),
      })
      const wynik = await odpowiedz.json().catch(() => null)

      if (!odpowiedz.ok || !wynik?.ok) {
        setBlad(
          wynik?.powod === "zly_email"
            ? "Ten adres wygląda na niepełny — sprawdź, czy nie brakuje kropki albo małpy."
            : "Nie udało się otworzyć konfiguratora. Spróbuj jeszcze raz za chwilę."
        )
        return
      }

      if (!(await pobierzDane())) {
        setBlad("Konfigurator się otworzył, ale dane nie doszły. Odśwież stronę.")
      }
    } catch {
      setBlad("Brak połączenia. Spróbuj jeszcze raz.")
    } finally {
      setWysylam(false)
    }
  }

  if (stan === "otwarte") {
    return (
      <BoatConfigurator
        modelName={modelName}
        slug={slug}
        brandName={brandName}
        config={config}
        standardEquipment={wyposazenie}
        offerContacts={offerContacts}
        locale={locale}
      />
    )
  }

  // Miejsce nie może się zapadać w trakcie sprawdzania: strona skakałaby
  // pod palcem czytelnikowi, który akurat przewija.
  if (stan === "sprawdzam") {
    return (
      <div className="min-h-[280px] rounded-2xl border border-[#111827]/10 bg-white p-8 md:p-10" />
    )
  }

  return (
    <div className="rounded-2xl border border-[#111827]/10 bg-white p-8 md:p-10">
      <div className="mx-auto max-w-[560px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#111827]/35">
          Konfigurator
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          {modelName} — złóż własną specyfikację
        </h2>
        <p className="mt-4 text-sm leading-7 text-[#111827]/65">
          Wybierzesz silniki, wyposażenie i wykończenie, a kalkulator policzy cenę netto
          i brutto. Podaj imię i adres, żeby otworzyć konfigurator — na ten adres wyślemy
          gotową ofertę w PDF, kiedy zechcesz ją zapisać.
        </p>

        <form onSubmit={odblokuj} className="mt-7 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/40"
                htmlFor="bramka-imie"
              >
                Imię
              </label>
              <input
                id="bramka-imie"
                value={imie}
                onChange={(z) => setImie(z.target.value)}
                required
                autoComplete="given-name"
                className="mt-1.5 w-full rounded-md border border-[#111827]/15 px-3 py-2.5 text-sm outline-none focus:border-[#2E64A8]"
              />
            </div>
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/40"
                htmlFor="bramka-email"
              >
                E-mail
              </label>
              <input
                id="bramka-email"
                type="email"
                value={email}
                onChange={(z) => setEmail(z.target.value)}
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-md border border-[#111827]/15 px-3 py-2.5 text-sm outline-none focus:border-[#2E64A8]"
              />
            </div>
          </div>

          {/* Pułapka na boty — człowiek tego pola nie widzi. */}
          <input
            type="text"
            name="website"
            value={pulapka}
            onChange={(z) => setPulapka(z.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          {blad ? <p className="text-sm text-red-700">{blad}</p> : null}

          <button
            type="submit"
            disabled={wysylam}
            className="rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-60"
          >
            {wysylam ? "Otwieram…" : "Otwórz konfigurator"}
          </button>

          <p className="text-xs leading-6 text-[#111827]/45">
            Adres służy do kontaktu w sprawie tej łodzi — nie zapisujemy Cię na żaden
            newsletter. Szczegóły w{" "}
            <a href="/polityka-prywatnosci" className="underline hover:text-[#2E64A8]">
              polityce prywatności
            </a>
            . Podajesz to raz; przy kolejnych wizytach konfigurator otworzy się od razu.
          </p>
        </form>
      </div>
    </div>
  )
}
