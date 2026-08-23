"use client"

import { useState } from "react"
import PriceListImport from "@/components/admin/PriceListImport"
import BoatPriceList from "@/components/admin/BoatPriceList"

type PriceToolsProps = { user: string | null }

/**
 * Dwa sposoby aktualizacji cen, bo tak wyglądają pliki od producentów:
 * raz przychodzi zbiorczy cennik marki (ceny bazowe wielu łodzi), raz
 * cennik jednej łodzi z dopłatami za wyposażenie.
 */
export default function PriceTools({ user }: PriceToolsProps) {
  const [mode, setMode] = useState<"marka" | "lodz">("marka")

  // Zanim ktoś się zaloguje, nie ma czego przełączać — formularz logowania
  // siedzi w `PriceListImport`.
  if (!user) return <PriceListImport user={user} />

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["marka", "Cennik marki — ceny bazowe łodzi"],
            ["lodz", "Cennik jednej łodzi — opcje konfiguratora"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={`rounded-sm border px-4 py-2.5 text-sm transition ${
              mode === value
                ? "border-[#2E64A8] bg-[#2E64A8] text-white"
                : "border-[#111827]/15 bg-white text-[#111827]/65 hover:border-[#111827]/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "marka" ? <PriceListImport user={user} /> : <BoatPriceList />}
    </div>
  )
}
