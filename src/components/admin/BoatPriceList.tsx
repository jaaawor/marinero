"use client"

import { useEffect, useMemo, useState } from "react"
import { readJson, sendSpreadsheet } from "@/lib/admin-fetch"

type Boat = { slug: string; name: string; currency: string; basePrice: number; note: string }

type Summary = {
  id: number | string
  slug: string
  name: string
  currency: string
  basePrice: number
  groups: { id: number; title: string; type: string; count: number }[]
  options: number
  withCode: number
  note: string
}

type Item = {
  line: number
  code: string
  name: string
  price: number
  group: string
  groupType: string
  ourId: number | string | null
  ourName: string
  ourPrice: number | null
  score: number
  by: "kod" | "sugestia" | "reczne" | ""
}

type Ours = { id: number | string; name: string; price: number; group: string }

type Row = Item & { include: boolean; label: string }

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
 * Cennik jednej łodzi. Cennik producenta jest źródłem prawdy — ma komplet
 * pozycji, ceny i kody katalogowe. Nasz konfigurator jest po polsku, więc
 * przy pierwszym imporcie trzeba raz potwierdzić pary; potem kod robi robotę
 * i kolejne aktualizacje są bezobsługowe.
 */
export default function BoatPriceList() {
  const [boats, setBoats] = useState<Boat[]>([])
  const [slug, setSlug] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [ours, setOurs] = useState<Ours[]>([])
  const [basePrice, setBasePrice] = useState("")
  const [listBase, setListBase] = useState<number | null>(null)
  const [fileName, setFileName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ zapisane: any[]; bledy: any[] } | null>(null)

  useEffect(() => {
    fetch("/api/admin/cenniki/model")
      .then(readJson)
      .then((body) => setBoats(body?.lodzie || []))
      .catch(() => setBoats([]))
  }, [])

  async function analyse(nextSlug = slug) {
    if (!nextSlug) return
    setBusy(true)
    setError("")
    setResult(null)

    try {
      const body = await sendSpreadsheet("/api/admin/cenniki/model", file, { slug: nextSlug })

      setSummary(body.konfigurator || null)
      setBasePrice(String(body.cennik?.basePrice ?? body.konfigurator?.basePrice ?? ""))
      setListBase(body.cennik?.basePrice ?? null)
      setFileName(body.plik || "")
      setOurs(body.nasze || [])
      setRows(
        (body.cennik?.pozycje || []).map((item: Item) => ({
          ...item,
          // Zaznaczone są WYŁĄCZNIE dopasowania po kodzie — te są pewne.
          // Podpowiedź, choćby najmocniejsza, zostaje do potwierdzenia:
          // zły ptaszek po cichu podmienia cenę nie tej opcji, co trzeba.
          include: item.by === "kod" && item.price !== item.ourPrice,
          label: item.ourName || item.name,
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
    const chosen = rows.filter((row) => row.include)
    const aktualizacje = chosen
      .filter((row) => row.ourId)
      .map((row) => ({ ourId: row.ourId, code: row.code, name: row.label, price: row.price }))
    const nowe = chosen
      .filter((row) => !row.ourId)
      .map((row) => ({
        code: row.code,
        name: row.label,
        price: row.price,
        group: row.group,
        groupType: row.groupType,
      }))

    const nextBase = Number(basePrice)
    const baseChanged =
      summary && Number.isFinite(nextBase) && Math.round(nextBase) !== summary.basePrice

    if (!aktualizacje.length && !nowe.length && !baseChanged) return

    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/admin/cenniki/model-zapis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          konfigurator: summary?.id,
          cenaBazowa: baseChanged ? nextBase : null,
          aktualizacje,
          nowe,
          notatka: fileName ? `${fileName} — ${new Date().toISOString().slice(0, 10)}` : "",
        }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body?.error || "Zapis nieudany")

      setResult(body)
      setRows((current) =>
        current.map((row) =>
          row.include ? { ...row, include: false, ourPrice: row.price, by: "kod" } : row
        )
      )
      if (summary && baseChanged) setSummary({ ...summary, basePrice: Math.round(nextBase) })
    } catch (problem: any) {
      setError(problem?.message || "Zapis nieudany")
    } finally {
      setBusy(false)
    }
  }

  function update(line: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.line === line ? { ...row, ...patch } : row)))
  }

  /**
   * Ręczne sparowanie pozycji z cennika z naszą opcją. To jest sedno pierwszego
   * importu: nasze nazwy są po polsku, cennik po angielsku, więc automat trafia
   * ledwie w kilkanaście pozycji. Bez tego wyboru jedynym wyjściem byłoby
   * dołożenie duplikatu obok istniejącej opcji.
   *
   * Nazwę zostawiamy naszą — z cennika bierzemy cenę i kod.
   */
  function pair(line: number, id: string) {
    const match = ours.find((item) => String(item.id) === id)
    setRows((current) =>
      current.map((row) => {
        if (row.line !== line) return row
        if (!match) {
          // Cofnięcie pary zdejmuje też ptaszek: inaczej wiersz zostałby
          // zaznaczony do dołożenia jako nowa opcja, czego nikt nie chciał.
          return {
            ...row,
            ourId: null,
            ourName: "",
            ourPrice: null,
            score: 0,
            by: "",
            label: row.name,
            include: false,
          }
        }
        return {
          ...row,
          ourId: match.id,
          ourName: match.name,
          ourPrice: match.price,
          score: 0,
          by: "reczne",
          label: match.name,
          include: match.price !== row.price,
        }
      })
    )
  }

  // Opcje jeszcze nikomu nieprzypisane — tylko te trafiają do listy wyboru,
  // żeby jedna opcja nie dostała dwóch różnych cen z tego samego cennika.
  const free = useMemo(() => {
    const taken = new Set(rows.map((row) => row.ourId).filter(Boolean).map(String))
    return ours.filter((item) => !taken.has(String(item.id)))
  }, [rows, ours])

  const groups = useMemo(() => {
    const out: { title: string; rows: Row[] }[] = []
    for (const row of rows) {
      const last = out[out.length - 1]
      if (last && last.title === row.group) last.rows.push(row)
      else out.push({ title: row.group, rows: [row] })
    }
    return out
  }, [rows])

  const stats = useMemo(() => {
    const byCode = rows.filter((row) => row.by === "kod").length
    const suggested = rows.filter((row) => row.by === "sugestia").length
    const manual = rows.filter((row) => row.by === "reczne").length
    const fresh = rows.filter((row) => !row.ourId).length
    const changes = rows.filter((row) => row.include).length
    return { byCode, suggested, manual, fresh, changes }
  }, [rows])

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">1. Wybierz łódź i wgraj cennik producenta</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#111827]/55">
          Plik w oryginale — formularz zamówienia, cennik opcji, cokolwiek przyszło
          od producenta. Czytam z niego kody katalogowe, nazwy, ceny i cenę bazową.
          Przy pierwszym imporcie potwierdzasz, która pozycja to która; potem kod
          już zostaje i kolejne aktualizacje idą same.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)_auto] md:items-center">
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
            {busy ? "Czytam…" : "Sprawdź cennik"}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-[#B42318]">{error}</p> : null}
      </div>

      {summary ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold">{summary.name}</h2>
              <p className="mt-2 text-sm text-[#111827]/55">
                U nas: {summary.groups.length} grup, {summary.options} opcji
                {summary.withCode ? `, z kodem: ${summary.withCode}` : ", żadna nie ma jeszcze kodu"}
                {summary.note ? ` · ostatni cennik: ${summary.note}` : ""}
              </p>
              {rows.length ? (
                <p className="mt-1 text-sm text-[#111827]/55">
                  Z cennika: {rows.length} pozycji — po kodzie {stats.byCode}, z podpowiedzi{" "}
                  {stats.suggested}
                  {stats.manual ? `, sparowanych ręcznie ${stats.manual}` : ""}, bez pary{" "}
                  {stats.fresh}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm text-[#111827]/60">
                Cena bazowa netto
                {listBase !== null && listBase !== summary.basePrice ? (
                  <span className="ml-2 text-[#B42318]">z cennika: {money(listBase)}</span>
                ) : null}
              </label>
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
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#111827]/55">
                Nazwa po lewej jest z cennika (po angielsku), pole obok to nazwa,
                która pójdzie na stronę. Pod nią wybierasz, której naszej opcji
                dotyczy ta pozycja — na liście są tylko te jeszcze niesparowane.
                Zostawione na „dołóż jako nową" pojawią się w konfiguratorze jako
                nowa pozycja, więc zanim je zaznaczysz, sprawdź, czy nie masz ich
                już po polsku.
              </p>
            </div>

            <button className={button} onClick={save} disabled={busy}>
              {busy ? "Zapisuję…" : `Zapisz (${stats.changes})`}
            </button>
          </div>

          {/* Pierwszy import to kilkadziesiąt decyzji — bez tych trzech
              przycisków byłoby to klikanie po jednym wierszu. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["Zaznacz sparowane", (row: Row) => Boolean(row.ourId)],
                ["Zaznacz pozycje bez pary", (row: Row) => !row.ourId],
              ] as const
            ).map(([label, pick]) => (
              <button
                key={label}
                type="button"
                className="rounded-sm border border-[#111827]/15 px-3.5 py-2 text-xs text-[#111827]/65 transition hover:border-[#111827]/45"
                onClick={() =>
                  setRows((current) =>
                    current.map((row) => ({ ...row, include: row.include || pick(row) }))
                  )
                }
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              className="rounded-sm border border-[#111827]/15 px-3.5 py-2 text-xs text-[#111827]/65 transition hover:border-[#111827]/45"
              onClick={() => setRows((current) => current.map((row) => ({ ...row, include: false })))}
            >
              Wyczyść zaznaczenia
            </button>
          </div>

          <div className="mt-6 grid gap-8">
            {groups.map((group) => (
              <div key={group.title || "bez-grupy"}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111827]/40">
                  {group.title || "Bez sekcji"}
                </p>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <tbody>
                      {group.rows.map((row) => {
                        const isNew = !row.ourId
                        const diff =
                          row.ourPrice !== null && row.ourPrice !== row.price
                            ? row.price - row.ourPrice
                            : null

                        return (
                          <tr
                            key={row.line}
                            className={`border-b border-[#111827]/6 align-top ${
                              isNew ? "bg-[#FFF7ED]" : ""
                            }`}
                          >
                            <td className="w-8 py-3">
                              <input
                                type="checkbox"
                                checked={row.include}
                                onChange={(event) =>
                                  update(row.line, { include: event.target.checked })
                                }
                              />
                            </td>

                            <td className="py-3 pr-3">
                              <p className="max-w-[24rem] leading-5 text-[#111827]/70">
                                {row.name}
                              </p>
                              <p className="mt-1 text-xs text-[#111827]/35">
                                w.{row.line}
                                {row.code ? ` · kod ${row.code}` : " · bez kodu"}
                                {row.by === "kod" ? " · dopasowane po kodzie" : ""}
                                {row.by === "sugestia"
                                  ? ` · podpowiedź (${row.score}) — sprawdź`
                                  : ""}
                                {row.by === "reczne" ? " · sparowane ręcznie" : ""}
                                {isNew ? " · bez pary — dołoży nową opcję" : ""}
                              </p>
                            </td>

                            <td className="py-3 pr-3">
                              <input
                                className={input}
                                value={row.label}
                                onChange={(event) =>
                                  update(row.line, { label: event.target.value })
                                }
                              />

                              {/* Wybór pary. „Dołóż jako nową" jest tu celowo
                                  na pierwszym miejscu tylko wtedy, gdy nic nie
                                  wybrano — dokładanie duplikatu obok istniejącej
                                  opcji to najczęstszy sposób na zabałaganienie
                                  konfiguratora. */}
                              <select
                                className={`${input} mt-1.5 text-xs`}
                                value={row.ourId ? String(row.ourId) : ""}
                                onChange={(event) => pair(row.line, event.target.value)}
                              >
                                <option value="">— dołóż jako nową opcję —</option>
                                {row.ourId && row.ourName ? (
                                  <option value={String(row.ourId)}>
                                    {row.ourName.slice(0, 90)} · {money(row.ourPrice)}
                                  </option>
                                ) : null}
                                {free.map((item) => (
                                  <option key={item.id} value={String(item.id)}>
                                    {item.group ? `${item.group.slice(0, 24)} · ` : ""}
                                    {item.name.slice(0, 90)} · {money(item.price)}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="w-28 py-3 pr-3 tabular-nums text-[#111827]/55">
                              {money(row.ourPrice)}
                            </td>

                            <td className="w-32 py-3 pr-3">
                              <input
                                className={`${input} tabular-nums`}
                                inputMode="numeric"
                                value={row.price}
                                onChange={(event) =>
                                  update(row.line, {
                                    price: Number(event.target.value.replace(/[^\d]/g, "")) || 0,
                                  })
                                }
                              />
                            </td>

                            <td className="w-24 py-3 tabular-nums">
                              {diff === null ? (
                                <span className="text-[#111827]/35">{isNew ? "nowa" : "—"}</span>
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
            ))}
          </div>
        </div>
      ) : null}

      {rows.length && free.length ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            U nas jest, w cenniku nie ma ({free.length})
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#111827]/55">
            Lista topnieje w miarę parowania. To, co zostanie, to zwykle wycofane
            wersje silników albo opcje, których producent już nie oferuje. Niczego
            z nimi nie robię — jeśli mają zniknąć ze strony, usuń je w Directusie.
          </p>

          <ul className="mt-4 grid gap-1 text-sm text-[#111827]/60 sm:grid-cols-2">
            {free.map((item) => (
              <li key={item.id}>
                {item.name.slice(0, 70)}{" "}
                <span className="text-[#111827]/35">· {money(item.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">3. Zapisane</h2>
          <p className="mt-2 text-sm text-[#111827]/60">
            {result.zapisane.length} zmian.
            {result.bledy.length ? ` Nie udało się: ${result.bledy.length}.` : ""} Kody
            katalogowe zostały zapisane — następny cennik tej łodzi wgrasz jednym
            kliknięciem.
          </p>

          <ul className="mt-4 grid gap-1 text-sm text-[#111827]/70">
            {result.zapisane.slice(0, 40).map((item: any, index: number) => (
              <li key={index}>
                {item.what} → {money(item.value)}
              </li>
            ))}
            {result.bledy.map((item: any, index: number) => (
              <li key={`e-${index}`} className="text-[#B42318]">
                {item.what}: {item.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
