"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLogin from "@/components/admin/AdminLogin"
import { readJson } from "@/lib/admin-fetch"

const input =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const button =
  "inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"
const buttonGhost =
  "inline-flex items-center justify-center rounded-sm border border-[#111827]/15 bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[#111827]/35 disabled:opacity-40"

type Boat = {
  id: number | string
  name: string
  slug: string
  standardowe: number
  dodatkowe: number
  konfigurator: string
}

type Item = { text: string; price: number | null }
type Group = { title: string; items: Item[] }

type Rodzaj = "standardowe" | "dodatkowe"

const PRZYKLAD = `POKŁAD:
Relingi ze stali nierdzewnej
Drabinka kąpielowa
Bakista kotwiczna

KABINA:
Materac 200 × 140 cm
Oświetlenie LED`

const PRZYKLAD_DODATKOWE = `Pokład
Winda kotwiczna dziobowa 40 m    4300
Rolka dziobowa    237

Elektronika
Ploter Simrad NSX 3012    3380
Radar Simrad Halo20+    3750`

export default function EquipmentPaste({ user }: { user: string | null }) {
  const [name, setName] = useState(user)
  const [boats, setBoats] = useState<Boat[]>([])
  const [boatId, setBoatId] = useState("")
  const [rodzaj, setRodzaj] = useState<Rodzaj>("standardowe")
  const [tekst, setTekst] = useState("")
  const [grupy, setGrupy] = useState<Group[] | null>(null)
  const [tryb, setTryb] = useState<"dopisz" | "zastap">("dopisz")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState("")

  const boat = useMemo(() => boats.find((b) => String(b.id) === boatId) || null, [boats, boatId])
  const pozycji = useMemo(
    () => (grupy || []).reduce((sum, g) => sum + g.items.length, 0),
    [grupy]
  )

  useEffect(() => {
    if (!name) return
    ;(async () => {
      try {
        const response = await fetch("/api/admin/wyposazenie")
        const body = await readJson(response)
        if (!response.ok) throw new Error(body?.error || "Nie udało się pobrać listy łodzi")
        setBoats(body.lodzie || [])
      } catch (problem: any) {
        setError(problem?.message || "Nie udało się pobrać listy łodzi")
      }
    })()
  }, [name])

  if (!name) return <AdminLogin onLogin={setName} />

  async function podglad() {
    setBusy(true)
    setError("")
    setDone("")
    try {
      const response = await fetch("/api/admin/wyposazenie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst, rodzaj }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body?.error || "Nie udało się odczytać listy")
      setGrupy(body.grupy || [])
    } catch (problem: any) {
      setError(problem?.message || "Nie udało się odczytać listy")
    } finally {
      setBusy(false)
    }
  }

  async function zapisz() {
    if (!boat || !grupy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/admin/wyposazenie/zapis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: boat.id,
          konfigurator: boat.konfigurator,
          rodzaj,
          tryb,
          grupy,
        }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body?.error || "Zapis nieudany")
      setDone(`Zapisane: ${body.grup} grup, ${body.pozycji} pozycji.`)
      setGrupy(null)
      setTekst("")
    } catch (problem: any) {
      setError(problem?.message || "Zapis nieudany")
    } finally {
      setBusy(false)
    }
  }

  function zmienPozycje(gi: number, ii: number, pole: "text" | "price", wartosc: string) {
    setGrupy((prev) => {
      if (!prev) return prev
      const kopia = prev.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }))
      if (pole === "text") kopia[gi].items[ii].text = wartosc
      else kopia[gi].items[ii].price = wartosc === "" ? 0 : Number(wartosc) || 0
      return kopia
    })
  }

  function usunPozycje(gi: number, ii: number) {
    setGrupy((prev) => {
      if (!prev) return prev
      const kopia = prev.map((g) => ({ ...g, items: g.items.filter((_, i) => i !== ii) }))
      return kopia.filter((g) => g.items.length)
    })
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Łódź</span>
            <select
              className={input}
              value={boatId}
              onChange={(event) => {
                setBoatId(event.target.value)
                setDone("")
              }}
            >
              <option value="">— wybierz —</option>
              {boats.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name} (standardowe: {b.standardowe}, dodatkowe: {b.dodatkowe})
                </option>
              ))}
            </select>
          </label>

          <fieldset className="self-end">
            <span className="mb-1.5 block text-sm font-semibold">Rodzaj</span>
            <div className="flex gap-2">
              {(["standardowe", "dodatkowe"] as Rodzaj[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRodzaj(r)
                    setGrupy(null)
                  }}
                  className={
                    r === rodzaj
                      ? `${button} !px-4`
                      : `${buttonGhost}`
                  }
                >
                  {r === "standardowe" ? "Standardowe" : "Dodatkowe (z cenami)"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {rodzaj === "dodatkowe" && boat && !boat.konfigurator ? (
          <p className="mt-4 rounded-sm bg-[#B45309]/10 px-4 py-3 text-sm text-[#7C2D12]">
            Ta łódź nie ma konfiguratora, więc wyposażenie dodatkowe nie ma gdzie usiąść.
            Wybierz „Standardowe" albo najpierw załóż konfigurator w Directusie.
          </p>
        ) : null}

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-semibold">
            Wklej całą listę
          </span>
          <textarea
            className={`${input} min-h-[260px] font-mono text-[13px] leading-6`}
            placeholder={rodzaj === "standardowe" ? PRZYKLAD : PRZYKLAD_DODATKOWE}
            value={tekst}
            onChange={(event) => {
              setTekst(event.target.value)
              setGrupy(null)
            }}
          />
        </label>

        <p className="mt-2 text-sm leading-6 text-[#111827]/55">
          {rodzaj === "standardowe" ? (
            <>
              Nagłówkiem sekcji jest wiersz zakończony dwukropkiem albo pisany
              wersalikami. Punktory i numerację obcinam.
            </>
          ) : (
            <>
              Wiersz <strong>z ceną</strong> to opcja, wiersz <strong>bez ceny</strong>{" "}
              — nagłówek grupy. Cenę rozpoznaję na końcu wiersza, więc liczby
              w nazwie („6,5&quot; 200 W") zostają na miejscu.
            </>
          )}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={button} onClick={podglad} disabled={busy || !tekst.trim()}>
            {busy ? "Czytam…" : "Pokaż podgląd"}
          </button>
          {done ? <span className="text-sm font-semibold text-[#047857]">{done}</span> : null}
          {error ? <span className="text-sm font-semibold text-[#B91C1C]">{error}</span> : null}
        </div>
      </div>

      {grupy ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">
              Podgląd: {grupy.length} grup, {pozycji} pozycji
            </h2>
            <p className="text-sm text-[#111827]/55">
              Możesz poprawić nazwy i ceny przed zapisem.
            </p>
          </div>

          <div className="mt-5 grid gap-5">
            {grupy.map((g, gi) => (
              <div key={gi}>
                <input
                  className={`${input} !w-auto !min-w-[280px] font-semibold`}
                  value={g.title}
                  onChange={(event) =>
                    setGrupy((prev) => {
                      if (!prev) return prev
                      const kopia = prev.map((x) => ({ ...x, items: [...x.items] }))
                      kopia[gi].title = event.target.value
                      return kopia
                    })
                  }
                />
                <ul className="mt-2 grid gap-1">
                  {g.items.map((item, ii) => (
                    <li key={ii} className="flex items-center gap-2">
                      <input
                        className={input}
                        value={item.text}
                        onChange={(event) => zmienPozycje(gi, ii, "text", event.target.value)}
                      />
                      {rodzaj === "dodatkowe" ? (
                        <input
                          className={`${input} !w-28 text-right`}
                          inputMode="numeric"
                          value={item.price ?? 0}
                          onChange={(event) => zmienPozycje(gi, ii, "price", event.target.value)}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => usunPozycje(gi, ii)}
                        aria-label="Usuń pozycję"
                        className="shrink-0 rounded-sm border border-[#111827]/15 px-2.5 py-2 text-sm text-[#111827]/50 transition hover:border-[#B91C1C]/40 hover:text-[#B91C1C]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-[#111827]/10 pt-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={tryb === "dopisz"}
                onChange={() => setTryb("dopisz")}
              />
              Dopisz do tego, co już jest
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={tryb === "zastap"}
                onChange={() => setTryb("zastap")}
              />
              Zastąp dotychczasowe {rodzaj === "standardowe" ? "wyposażenie" : "wyposażenie dodatkowe"}
            </label>

            <button
              type="button"
              className={`${button} ml-auto`}
              onClick={zapisz}
              disabled={busy || !boat || (rodzaj === "dodatkowe" && !boat?.konfigurator)}
            >
              {busy ? "Zapisuję…" : `Zapisz ${pozycji} pozycji`}
            </button>
          </div>

          {!boat ? (
            <p className="mt-3 text-sm font-semibold text-[#B45309]">Najpierw wybierz łódź.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
