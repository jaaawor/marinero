"use client"

import { useEffect, useMemo, useState } from "react"

type Boat = { slug: string; name: string; currency: string; basePrice: number }

type Option = { id: number | string; name: string; group: string; price: number }

type Proposal = {
  line: number
  label: string
  price: number | null
  currency: string
  modelId: number | string | null
  modelName: string
  modelSlug: string
  currentPrice: number | null
  currentCurrency: string
  score: number
}

type Row = Proposal & { include: boolean }

type Summary = {
  id: number | string
  slug: string
  name: string
  currency: string
  basePrice: number
  groups: number
  options: number
}

const SURE = 0.78

function money(value: number | null | undefined, currency = "") {
  if (typeof value !== "number") return "—"
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value)}${
    currency ? ` ${currency}` : ""
  }`
}

const input =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const button =
  "inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"

/**
 * Cennik jednej łodzi — dopłaty za opcje konfiguratora plus cena bazowa.
 * Osobno od cennika całej marki, bo tak przychodzą pliki od producentów
 * i tak łatwiej sprawdzić, co się zmieniło.
 */
export default function BoatPriceList() {
  const [boats, setBoats] = useState<Boat[]>([])
  const [slug, setSlug] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [basePrice, setBasePrice] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const [result, setResult] = useState<{ zapisane: any[]; bledy: any[] } | null>(null)

  useEffect(() => {
    fetch("/api/admin/cenniki/model")
      .then((response) => response.json())
      .then((body) => setBoats(body?.lodzie || []))
      .catch(() => setBoats([]))
  }, [])

  async function analyse(nextSlug = slug, sheet?: number) {
    if (!nextSlug) return
    setBusy(true)
    setError("")
    setNote("")
    setResult(null)

    try {
      const form = new FormData()
      form.set("slug", nextSlug)
      if (file) form.set("plik", file)
      if (typeof sheet === "number") form.set("arkusz", String(sheet))

      const response = await fetch("/api/admin/cenniki/model", { method: "POST", body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Nie udało się odczytać pliku")

      setSummary(body.konfigurator || null)
      setOptions(body.opcje || [])
      setBasePrice(String(body.konfigurator?.basePrice ?? ""))
      setNote(body.uwaga || "")
      setRows(
        (body.pozycje || []).map((item: Proposal) => ({
          ...item,
          include: Boolean(item.modelId) && item.score >= SURE && item.price !== item.currentPrice,
        }))
      )
    } catch (problem: any) {
      setError(problem?.message || "Nie udało się odczytać pliku")
      setRows([])
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const zmiany = rows
      .filter((row) => row.include && row.modelId && typeof row.price === "number")
      .map((row) => ({ optionId: row.modelId, price: row.price }))

    const nextBase = Number(basePrice)
    const baseChanged =
      summary && Number.isFinite(nextBase) && Math.round(nextBase) !== summary.basePrice

    if (!zmiany.length && !baseChanged) return

    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/admin/cenniki/model-zapis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          konfigurator: summary?.id,
          cenaBazowa: baseChanged ? nextBase : null,
          zmiany,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Zapis nieudany")

      setResult(body)
      setRows((current) =>
        current.map((row) =>
          zmiany.some((change) => change.optionId === row.modelId)
            ? { ...row, include: false, currentPrice: row.price }
            : row
        )
      )
      if (summary && baseChanged) {
        setSummary({ ...summary, basePrice: Math.round(nextBase) })
      }
    } catch (problem: any) {
      setError(problem?.message || "Zapis nieudany")
    } finally {
      setBusy(false)
    }
  }

  const selected = rows.filter((row) => row.include).length

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const rank = (row: Row) => {
        if (!row.modelId) return 0
        if (row.score < SURE) return 1
        if (row.price !== row.currentPrice) return 2
        return 3
      }
      return rank(a) - rank(b) || a.line - b.line
    })
  }, [rows])

  function update(line: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.line === line ? { ...row, ...patch } : row)))
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">1. Wybierz łódź i wgraj jej cennik</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#111827]/55">
          Dopasowuję pozycje z pliku do opcji konfiguratora tej łodzi. Możesz też
          samą łódź wybrać bez pliku — zobaczysz, co jest w niej dzisiaj.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto] md:items-center">
          <select
            className={input}
            value={slug}
            onChange={(event) => {
              const value = event.target.value
              setSlug(value)
              setRows([])
              setSummary(null)
              setResult(null)
              if (value) analyse(value)
            }}
          >
            <option value="">— wybierz łódź —</option>
            {boats.map((boat) => (
              <option key={boat.slug} value={boat.slug}>
                {boat.name}
              </option>
            ))}
          </select>

          <input
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv,.txt"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setRows([])
              setResult(null)
            }}
            className="text-sm"
          />

          <button className={button} onClick={() => analyse()} disabled={!slug || !file || busy}>
            {busy ? "Czytam…" : "Sprawdź plik"}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-[#B42318]">{error}</p> : null}
        {note ? (
          <p className="mt-4 rounded-sm bg-[#FEF3C7] px-4 py-3 text-sm leading-6 text-[#92400E]">
            {note}
          </p>
        ) : null}
      </div>

      {summary ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold">{summary.name}</h2>
              <p className="mt-2 text-sm text-[#111827]/55">
                {summary.groups} grup, {summary.options} opcji · waluta {summary.currency}
              </p>
            </div>

            <div>
              <label className="text-sm text-[#111827]/60">Cena bazowa netto</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  className={`${input} w-40 tabular-nums`}
                  inputMode="numeric"
                  value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value.replace(/[^\d]/g, ""))}
                />
                <span className="text-sm text-[#111827]/45">{summary.currency}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">2. Sprawdź, zanim zapiszę</h2>
              <p className="mt-2 text-sm leading-6 text-[#111827]/55">
                {rows.length} pozycji z pliku, dopasowanych {rows.filter((r) => r.modelId).length}.
              </p>
            </div>

            <button className={button} onClick={save} disabled={busy}>
              {busy ? "Zapisuję…" : `Zapisz zmiany (${selected})`}
            </button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-wide text-[#111827]/40">
                  <th className="py-2 pr-3">Zapisz</th>
                  <th className="py-2 pr-3">Z cennika</th>
                  <th className="py-2 pr-3">Opcja w konfiguratorze</th>
                  <th className="py-2 pr-3">Obecnie</th>
                  <th className="py-2 pr-3">Nowa dopłata</th>
                  <th className="py-2">Różnica</th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((row) => {
                  const diff =
                    typeof row.price === "number" && typeof row.currentPrice === "number"
                      ? row.price - row.currentPrice
                      : null

                  return (
                    <tr
                      key={row.line}
                      className={`border-b border-[#111827]/6 align-top ${
                        row.modelId ? "" : "bg-[#FFF7ED]"
                      }`}
                    >
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={!row.modelId || typeof row.price !== "number"}
                          onChange={(event) => update(row.line, { include: event.target.checked })}
                        />
                      </td>

                      <td className="py-3 pr-3">
                        <p className="max-w-[26rem] font-medium leading-5">{row.label}</p>
                        <p className="mt-1 text-xs text-[#111827]/40">wiersz {row.line}</p>
                      </td>

                      <td className="py-3 pr-3">
                        <select
                          className={input}
                          value={row.modelId ? String(row.modelId) : ""}
                          onChange={(event) => {
                            const value = event.target.value
                            const option = options.find((item) => String(item.id) === value)
                            update(row.line, {
                              modelId: option ? option.id : null,
                              modelName: option?.name || "",
                              currentPrice: option?.price ?? null,
                              score: option ? 1 : 0,
                              include: Boolean(option) && typeof row.price === "number",
                            })
                          }}
                        >
                          <option value="">— nie zapisuj —</option>
                          {options.map((option) => (
                            <option key={option.id} value={String(option.id)}>
                              {option.group ? `${option.group} · ` : ""}
                              {option.name.slice(0, 70)}
                            </option>
                          ))}
                        </select>

                        {row.modelId && row.score < SURE ? (
                          <p className="mt-1 text-xs text-[#92400E]">
                            niepewne dopasowanie — sprawdź
                          </p>
                        ) : null}
                      </td>

                      <td className="py-3 pr-3 tabular-nums text-[#111827]/60">
                        {money(row.currentPrice, summary?.currency)}
                      </td>

                      <td className="py-3 pr-3">
                        <input
                          className={`${input} w-32 tabular-nums`}
                          inputMode="numeric"
                          value={row.price ?? ""}
                          onChange={(event) => {
                            const value = Number(event.target.value.replace(/[^\d.]/g, ""))
                            update(row.line, { price: Number.isFinite(value) ? value : null })
                          }}
                        />
                      </td>

                      <td className="py-3 tabular-nums">
                        {diff === null ? (
                          <span className="text-[#111827]/35">nowa</span>
                        ) : diff === 0 ? (
                          <span className="text-[#111827]/35">bez zmian</span>
                        ) : (
                          <span className={diff > 0 ? "text-[#B42318]" : "text-[#047857]"}>
                            {diff > 0 ? "+" : ""}
                            {money(diff)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">3. Zapisane</h2>
          <p className="mt-2 text-sm text-[#111827]/60">
            Zaktualizowano {result.zapisane.length} pozycji.
            {result.bledy.length ? ` Nie udało się: ${result.bledy.length}.` : ""}
          </p>

          <ul className="mt-4 grid gap-1 text-sm text-[#111827]/70">
            {result.zapisane.slice(0, 40).map((item: any, index: number) => (
              <li key={`${item.id}-${index}`}>
                {item.name || item.id} → {money(item.price, summary?.currency)}
              </li>
            ))}
            {result.bledy.map((item: any) => (
              <li key={`e-${item.id}`} className="text-[#B42318]">
                {item.id}: {item.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
