"use client"

import { useEffect, useState } from "react"

/**
 * Odświeżenie sesji panelu bez pokazywania formularza logowania.
 *
 * Token dostępu Directusa żyje kwadrans, więc wejście do panelu po dłuższej
 * przerwie prawie zawsze trafia na wygasły. Odświeżyć go musi Route Handler —
 * w komponencie serwerowym zapis ciasteczka rzuca wyjątkiem, a że Directus
 * unieważnia token odświeżający przy każdej wymianie, taka nieudana próba
 * jeszcze i wylogowywała. Stąd ten ekran: jedno wywołanie `PUT` i przeładowanie.
 *
 * Gdy odświeżenie się nie uda, przeładowujemy tak samo — serwer skasował już
 * ciasteczka, więc na miejscu tej strony pokaże się formularz logowania,
 * zamiast napisu „coś poszło nie tak".
 */
export default function OdswiezSesje() {
  const [dlugo, setDlugo] = useState(false)

  useEffect(() => {
    let zywy = true
    const wolno = setTimeout(() => zywy && setDlugo(true), 4000)

    fetch("/api/admin/login", { method: "PUT" })
      .catch(() => null)
      .then(() => {
        if (zywy) window.location.reload()
      })

    return () => {
      zywy = false
      clearTimeout(wolno)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[520px] px-5 py-20">
        <div className="mb-8 flex items-center gap-2.5">
          <img src="/logo-marinero.png" alt="" className="h-7 w-auto object-contain" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#111827]/35">
            Panel
          </span>
        </div>

        <p className="text-sm text-[#111827]/60">Odnawiam sesję…</p>

        {dlugo ? (
          <p className="mt-3 text-sm text-[#111827]/45">
            Trwa to dłużej niż zwykle — Directus może być zajęty. Za chwilę odświeżę stronę.
          </p>
        ) : null}
      </div>
    </main>
  )
}
