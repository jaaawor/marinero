"use client"

import { useMemo, useState } from "react"

type ModelOption = {
  id: number | string
  name: string
  brand: string
  basePrice: number | null
  currency: string
}

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

type Analysis = {
  plik: string
  arkusze: { index: number; name: string; rows: number }[]
  arkusz: number
  modele: ModelOption[]
  pozycje: Proposal[]
  uwaga?: string
}

type Row = Proposal & { include: boolean }

const CURRENCIES = ["EUR", "USD", "PLN", "GBP", "NOK", "SEK"]

function money(value: number | null | undefined, currency = "") {
  if (typeof value !== "number") return "—"
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value)}${
    currency ? ` ${currency}` : ""
  }`
}

/** „1 cenę", „3 ceny", „7 cen" — po polsku liczebnik rządzi przypadkiem. */
function pluralPrices(count: number) {
  if (count === 1) return "cenę"
  const rest = count % 10
  const teens = count % 100
  if (rest >= 2 && rest <= 4 && !(teens >= 12 && teens <= 14)) return "ceny"
  return "cen"
}

const input =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const button =
  "inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"

export default function PriceListImport({ user }: { user: string | null }) {
  const [session, setSession] = useState<string | null>(user)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [result, setResult] = useState<{ zapisane: any[]; bledy: any[] } | null>(null)

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Logowanie nieudane")
      setSession(body?.user?.name || email)
      setPassword("")
    } catch (problem: any) {
      setError(problem?.message || "Logowanie nieudane")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" })
    setSession(null)
    setAnalysis(null)
    setRows([])
    setResult(null)
  }

  async function analyse(sheet?: number) {
    if (!file) return
    setBusy(true)
    setError("")
    setResult(null)

    try {
      const form = new FormData()
      form.set("plik", file)
      if (typeof sheet === "number") form.set("arkusz", String(sheet))

      const response = await fetch("/api/admin/cenniki/analiza", { method: "POST", body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Nie udało się odczytać pliku")

      setAnalysis(body)
      setRows(
        (body.pozycje || []).map((item: Proposal) => ({
          ...item,
          // Domyślnie zaznaczone są tylko pewne dopasowania ze zmienioną ceną —
          // resztę człowiek świadomie dokłada.
          include:
            Boolean(item.modelId) && item.score >= 0.78 && item.price !== item.currentPrice,
        }))
      )
    } catch (problem: any) {
      setError(problem?.message || "Nie udało się odczytać pliku")
      setAnalysis(null)
      setRows([])
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const zmiany = rows
      .filter((row) => row.include && row.modelId && typeof row.price === "number")
      .map((row) => ({ modelId: row.modelId, price: row.price, currency: row.currency }))

    if (!zmiany.length) return
    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/admin/cenniki/zapis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zmiany }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Zapis nieudany")

      setResult(body)
      // Zapisane pozycje przestają być zmianami — po zapisie stan „obecny"
      // to już nowa cena.
      setRows((current) =>
        current.map((row) =>
          zmiany.some((change) => change.modelId === row.modelId)
            ? { ...row, include: false, currentPrice: row.price, currentCurrency: row.currency }
            : row
        )
      )
    } catch (problem: any) {
      setError(problem?.message || "Zapis nieudany")
    } finally {
      setBusy(false)
    }
  }

  const selected = rows.filter((row) => row.include).length
  const matched = rows.filter((row) => row.modelId).length

  const sorted = useMemo(() => {
    // Najpierw to, co wymaga decyzji: bez dopasowania, potem niepewne,
    // na końcu pewne i bez zmiany ceny.
    return [...rows].sort((a, b) => {
      const rank = (row: Row) => {
        if (!row.modelId) return 0
        if (row.score < 0.78) return 1
        if (row.price !== row.currentPrice) return 2
        return 3
      }
      return rank(a) - rank(b) || a.line - b.line
    })
  }, [rows])

  function update(line: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.line === line ? { ...row, ...patch } : row)))
  }

  if (!session) {
    return (
      <form onSubmit={login} className="max-w-md rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Zaloguj się</h2>
        <p className="mt-2 text-sm leading-6 text-[#111827]/55">
          Tym samym e-mailem i hasłem, co do panelu Directus.
        </p>

        <div className="mt-5 grid gap-3">
          <input
            className={input}
            type="email"
            autoComplete="username"
            placeholder="E-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            placeholder="Hasło"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error ? <p className="mt-4 text-sm text-[#B42318]">{error}</p> : null}

        <button className={`${button} mt-5`} disabled={busy}>
          {busy ? "Sprawdzam…" : "Zaloguj"}
        </button>
      </form>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm">
        <p className="text-sm text-[#111827]/60">
          Zalogowany: <span className="font-semibold text-[#111827]">{session}</span>
        </p>
        <button onClick={logout} className="text-sm font-semibold text-[#2E64A8]">
          Wyloguj
        </button>
      </div>

      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">1. Wgraj cennik</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#111827]/55">
          Plik od producenta w oryginale — .xlsx albo .csv, po angielsku, w dowolnym
          układzie kolumn. Szukam w nim kolumny z nazwą modelu i kolumny z ceną.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv,.txt"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setAnalysis(null)
              setRows([])
              setResult(null)
            }}
            className="text-sm"
          />
          <button className={button} onClick={() => analyse()} disabled={!file || busy}>
            {busy ? "Czytam…" : "Sprawdź plik"}
          </button>
        </div>

        {analysis && analysis.arkusze.length > 1 ? (
          <div className="mt-5">
            <label className="text-sm text-[#111827]/60">Arkusz:</label>
            <select
              className={`${input} mt-2 max-w-sm`}
              value={analysis.arkusz}
              onChange={(event) => analyse(Number(event.target.value))}
            >
              {analysis.arkusze.map((sheet) => (
                <option key={sheet.index} value={sheet.index}>
                  {sheet.name} ({sheet.rows} wierszy)
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-[#B42318]">{error}</p> : null}
        {analysis?.uwaga ? (
          <p className="mt-4 rounded-sm bg-[#FEF3C7] px-4 py-3 text-sm leading-6 text-[#92400E]">
            {analysis.uwaga}
          </p>
        ) : null}
      </div>

      {rows.length ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">2. Sprawdź, zanim zapiszę</h2>
              <p className="mt-2 text-sm leading-6 text-[#111827]/55">
                Znalazłem {rows.length} pozycji, dopasowałem {matched}. Zaznaczone
                zostaną zapisane — resztę mogę zostawić w spokoju.
              </p>
            </div>

            <button className={button} onClick={save} disabled={!selected || busy}>
              {busy ? "Zapisuję…" : `Zapisz ${selected} ${pluralPrices(selected)}`}
            </button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[#111827]/10 text-left text-xs uppercase tracking-wide text-[#111827]/40">
                  <th className="py-2 pr-3">Zapisz</th>
                  <th className="py-2 pr-3">Z cennika</th>
                  <th className="py-2 pr-3">Model w bazie</th>
                  <th className="py-2 pr-3">Obecnie</th>
                  <th className="py-2 pr-3">Nowa cena</th>
                  <th className="py-2 pr-3">Waluta</th>
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
                        <p className="font-medium leading-5">{row.label}</p>
                        <p className="mt-1 text-xs text-[#111827]/40">wiersz {row.line}</p>
                      </td>

                      <td className="py-3 pr-3">
                        <select
                          className={input}
                          value={row.modelId ? String(row.modelId) : ""}
                          onChange={(event) => {
                            const value = event.target.value
                            const model = analysis?.modele.find(
                              (item) => String(item.id) === value
                            )
                            update(row.line, {
                              modelId: model ? model.id : null,
                              modelName: model?.name || "",
                              currentPrice: model?.basePrice ?? null,
                              currentCurrency: model?.currency || "",
                              score: model ? 1 : 0,
                              include: Boolean(model) && typeof row.price === "number",
                            })
                          }}
                        >
                          <option value="">— nie zapisuj —</option>
                          {(analysis?.modele || []).map((model) => (
                            <option key={model.id} value={String(model.id)}>
                              {model.brand ? `${model.brand} · ` : ""}
                              {model.name}
                            </option>
                          ))}
                        </select>

                        {row.modelId && row.score < 0.78 ? (
                          <p className="mt-1 text-xs text-[#92400E]">
                            niepewne dopasowanie — sprawdź
                          </p>
                        ) : null}
                      </td>

                      <td className="py-3 pr-3 tabular-nums text-[#111827]/60">
                        {money(row.currentPrice, row.currentCurrency)}
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

                      <td className="py-3 pr-3">
                        <select
                          className={`${input} w-24`}
                          value={row.currency}
                          onChange={(event) => update(row.line, { currency: event.target.value })}
                        >
                          {CURRENCIES.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </select>
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
            Zaktualizowano {result.zapisane.length} modeli.
            {result.bledy.length ? ` Nie udało się: ${result.bledy.length}.` : ""}
          </p>

          <ul className="mt-4 grid gap-1 text-sm text-[#111827]/70">
            {result.zapisane.map((item: any) => (
              <li key={item.id}>
                {item.name || item.id} → {money(item.price)}
              </li>
            ))}
            {result.bledy.map((item: any) => (
              <li key={`e-${item.id}`} className="text-[#B42318]">
                {item.id}: {item.error}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-5 text-[#111827]/40">
            Strona pokaże nowe ceny w ciągu minuty — tyle trwa odświeżenie treści.
          </p>
        </div>
      ) : null}
    </div>
  )
}
