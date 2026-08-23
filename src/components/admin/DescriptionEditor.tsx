"use client"

import { useCallback, useEffect, useState } from "react"
import { readJson } from "@/lib/admin-fetch"

type Row = {
  id: string
  title: string
  handle: string
  category: string
  thumbnail: string
  description: string
  proposal: string
  saved: boolean
  weak: boolean
}

type Category = { id: string; name: string; handle: string }

const input =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const button =
  "inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"
const ghost =
  "inline-flex items-center justify-center rounded-sm border border-[#111827]/15 px-4 py-2.5 text-sm text-[#111827]/65 transition hover:border-[#111827]/45 disabled:opacity-40"

/**
 * Opisy produktów: obecny tekst obok propozycji, propozycja do poprawienia
 * w miejscu. Zapis dopiero po kliknięciu — i osobno „odłóż jako szkic",
 * żeby dało się przejść sklep partiami, bez trzymania wszystkiego w głowie.
 */
export default function DescriptionEditor() {
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState("")
  const [query, setQuery] = useState("")
  const [onlyWeak, setOnlyWeak] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")

  const load = useCallback(
    async (options: { category?: string; query?: string; weak?: boolean } = {}) => {
      setBusy(true)
      setError("")
      setNote("")

      const params = new URLSearchParams()
      const nextCategory = options.category ?? category
      const nextQuery = options.query ?? query
      const nextWeak = options.weak ?? onlyWeak

      if (nextCategory) params.set("kategoria", nextCategory)
      if (nextQuery) params.set("szukaj", nextQuery)
      if (nextWeak) params.set("slabe", "1")

      try {
        const response = await fetch(`/api/admin/opisy?${params.toString()}`)
        const body = await readJson(response)
        if (!response.ok) throw new Error(body?.error || "Nie udało się pobrać produktów")

        setCategories(body.kategorie || [])
        setRows(body.produkty || [])
        setDrafts(
          Object.fromEntries((body.produkty || []).map((row: Row) => [row.id, row.proposal]))
        )

        if (!body.produkty?.length) {
          setNote("Nic tu nie ma — spróbuj innej kategorii albo odznacz „tylko słabe opisy”.")
        }
      } catch (problem: any) {
        setError(problem?.message || "Nie udało się pobrać produktów")
        setRows([])
      } finally {
        setBusy(false)
      }
    },
    [category, query, onlyWeak]
  )

  useEffect(() => {
    load()
    // Pierwsze wczytanie; kolejne robią przyciski, żeby nie strzelać po Medusie
    // przy każdej literze w wyszukiwarce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send(ids: string[], mode: "opis" | "szkic") {
    const zmiany = ids
      .map((id) => ({ id, text: (drafts[id] || "").trim() }))
      .filter((change) => change.text)

    if (!zmiany.length) return
    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/admin/opisy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zmiany, tryb: mode }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body?.error || "Zapis nieudany")

      setNote(
        mode === "opis"
          ? `Opublikowano ${body.zapisane.length} ${body.zapisane.length === 1 ? "opis" : "opisów"}.`
          : `Odłożono ${body.zapisane.length} ${body.zapisane.length === 1 ? "szkic" : "szkiców"}.`
      )

      if (mode === "opis") {
        setRows((current) =>
          current.map((row) =>
            ids.includes(row.id)
              ? { ...row, description: drafts[row.id] || row.description, weak: false, saved: false }
              : row
          )
        )
      }
    } catch (problem: any) {
      setError(problem?.message || "Zapis nieudany")
    } finally {
      setBusy(false)
    }
  }

  const changed = rows.filter((row) => (drafts[row.id] || "").trim() !== row.description.trim())

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] md:items-center">
          <select
            className={input}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              load({ category: event.target.value })
            }}
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            className={input}
            placeholder="Szukaj po nazwie…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") load()
            }}
          />

          <button className={ghost} onClick={() => load()} disabled={busy}>
            {busy ? "Szukam…" : "Pokaż"}
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-[#111827]/60">
          <input
            type="checkbox"
            checked={onlyWeak}
            onChange={(event) => {
              setOnlyWeak(event.target.checked)
              load({ weak: event.target.checked })
            }}
          />
          Pokaż tylko produkty ze słabym albo pustym opisem
        </label>

        {error ? <p className="mt-4 text-sm text-[#B42318]">{error}</p> : null}
        {note ? <p className="mt-4 text-sm text-[#047857]">{note}</p> : null}
      </div>

      {rows.length ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#111827]/10 bg-white p-5 shadow-sm">
          <p className="text-sm text-[#111827]/60">
            {rows.length} produktów na liście, zmienionych: <strong>{changed.length}</strong>
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              className={ghost}
              disabled={busy || !changed.length}
              onClick={() => send(changed.map((row) => row.id), "szkic")}
            >
              Odłóż jako szkice
            </button>

            <button
              className={button}
              disabled={busy || !changed.length}
              onClick={() => send(changed.map((row) => row.id), "opis")}
            >
              Opublikuj zmienione ({changed.length})
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5">
        {rows.map((row) => {
          const draft = drafts[row.id] ?? ""
          const dirty = draft.trim() !== row.description.trim()

          return (
            <div
              key={row.id}
              className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  {row.thumbnail ? (
                    <img
                      src={row.thumbnail}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-sm border border-[#111827]/10 object-contain"
                    />
                  ) : null}

                  <div className="min-w-0">
                    <p className="font-semibold leading-6">{row.title}</p>
                    <p className="mt-1 text-xs text-[#111827]/40">
                      {row.category || "bez kategorii"}
                      {row.weak ? " · opis do poprawy" : ""}
                      {row.saved ? " · jest odłożony szkic" : ""}
                    </p>
                  </div>
                </div>

                <a
                  href={`/sklep/produkt/${row.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[#2E64A8]"
                >
                  Zobacz w sklepie →
                </a>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#111827]/35">
                    Teraz w sklepie
                  </p>
                  <div className="min-h-[9rem] whitespace-pre-wrap rounded-sm bg-[#f6f5f2] p-4 text-sm leading-6 text-[#111827]/60">
                    {row.description || "— pusto —"}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111827]/35">
                      Propozycja {dirty ? "· zmieniona" : ""}
                    </p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#2E64A8]"
                      onClick={() =>
                        setDrafts((current) => ({ ...current, [row.id]: row.proposal }))
                      }
                    >
                      Przywróć propozycję
                    </button>
                  </div>

                  <textarea
                    className={`${input} min-h-[9rem] resize-y leading-6`}
                    value={draft}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy || !dirty}
                  onClick={() => send([row.id], "opis")}
                >
                  Opublikuj ten opis
                </button>
                <button
                  className={ghost}
                  disabled={busy || !dirty}
                  onClick={() => send([row.id], "szkic")}
                >
                  Odłóż na później
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
