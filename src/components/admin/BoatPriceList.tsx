"use client"

import { useEffect, useMemo, useState } from "react"
import { readJson, sendSpreadsheet } from "@/lib/admin-fetch"
import { canTranslate, translateOption } from "@/lib/marine-glossary"
import { rowKey } from "@/lib/order-form-match"

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
  /** Pozycja świadomie pomijana — zapamiętana z poprzedniego importu. */
  skip: boolean
}

type Ours = {
  id: number | string
  name: string
  price: number
  group: string
  offList: boolean
}

type Row = Item & { include: boolean; label: string }

/** Wartość w liście wyboru oznaczająca „tej pozycji nie chcę". */
const SKIP = "__pomin"

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
  // Zmiany oznaczenia „spoza cennika" — trzymamy tylko to, co ktoś przestawił.
  const [offList, setOffList] = useState<Map<string, boolean>>(new Map())
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
      setOffList(new Map())
      setRows(
        (body.cennik?.pozycje || []).map((item: Item) => ({
          ...item,
          // Zaznaczone są WYŁĄCZNIE dopasowania po kodzie — te są pewne.
          // Podpowiedź, choćby najmocniejsza, zostaje do potwierdzenia:
          // zły ptaszek po cichu podmienia cenę nie tej opcji, co trzeba.
          include: !item.skip && item.by === "kod" && item.price !== item.ourPrice,
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

    // Lista pomijanych jest pełna tylko wtedy, gdy widzimy cennik — bez
    // wgranego pliku nie ma czym jej nadpisać i wysyłamy `null`.
    const pomijane = rows.length
      ? rows.filter((row) => row.skip).map((row) => rowKey(row.code, row.name))
      : null
    const spozaCennika = [...offList].map(([id, value]) => ({ id, value }))

    if (!aktualizacje.length && !nowe.length && !baseChanged && !spozaCennika.length && !pomijane)
      return

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
          pomijane,
          spozaCennika,
          notatka: fileName ? `${fileName} — ${new Date().toISOString().slice(0, 10)}` : "",
        }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body?.error || "Zapis nieudany")

      setResult(body)
      setOffList(new Map())
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

        // „Pomiń" to trzeci stan obok „sparowane" i „dołóż jako nową":
        // pozycja z cennika, której u siebie nie chcemy. Zapamiętujemy ją,
        // żeby przy kolejnym cenniku nie decydować o tym samym drugi raz.
        if (id === SKIP) {
          return { ...row, ourId: null, ourName: "", ourPrice: null, score: 0, by: "", include: false, skip: true }
        }

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
            skip: false,
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
          skip: false,
        }
      })
    )
  }

  /** Czy opcja jest oznaczona jako spoza cennika — z uwzględnieniem zmian. */
  function isOffList(item: Ours): boolean {
    const changed = offList.get(String(item.id))
    return changed === undefined ? item.offList : changed
  }

  // Opcje jeszcze nikomu nieprzypisane — tylko te trafiają do listy wyboru,
  // żeby jedna opcja nie dostała dwóch różnych cen z tego samego cennika.
  const free = useMemo(() => {
    const taken = new Set(rows.map((row) => row.ourId).filter(Boolean).map(String))
    return ours.filter((item) => !taken.has(String(item.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ours])

  // Podział tego, co zostało: czego producent nie ma w cenniku, a czego my
  // sami dołożyliśmy i nie chcemy o tym słyszeć przy każdym imporcie.
  const missing = useMemo(() => free.filter((item) => !isOffList(item)), [free, offList])
  const mine = useMemo(() => free.filter((item) => isOffList(item)), [free, offList])

  // Ile nazw czeka na tłumaczenie: tylko te, których nikt jeszcze nie tknął.
  const toTranslate = useMemo(
    () => rows.filter((row) => !row.skip && row.label === row.name && canTranslate(row.name)).length,
    [rows]
  )

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
                która pójdzie na stronę — możesz ją tu poprawić. Pod nią lista
                wyboru z trzema wyjściami: wskazać naszą opcję (są tylko jeszcze
                niesparowane), <strong>dołożyć nową</strong> albo{" "}
                <strong>pominąć</strong> pozycję, której nie sprzedajemy —
                pominięcie zapamiętuję i przy następnym cenniku nie zapytam
                o nią drugi raz.
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
                    current.map((row) => ({
                      ...row,
                      include: row.skip ? false : row.include || pick(row),
                    }))
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

            {/* Przy zupełnie nowej łodzi wszystkie nazwy są angielskie
                i przepisanie ich to kilkadziesiąt pól. To jest podpowiedź
                do poprawienia, nie tłumaczenie — stąd wyraźny dopisek. */}
            {toTranslate ? (
              <button
                type="button"
                className="rounded-sm border border-[#2E64A8]/40 px-3.5 py-2 text-xs font-semibold text-[#2E64A8] transition hover:border-[#2E64A8]"
                onClick={() =>
                  setRows((current) =>
                    current.map((row) =>
                      !row.skip && row.label === row.name && canTranslate(row.name)
                        ? { ...row, label: translateOption(row.name) }
                        : row
                    )
                  )
                }
              >
                Podpowiedz polskie nazwy ({toTranslate})
              </button>
            ) : null}
          </div>

          {toTranslate ? (
            <p className="mt-3 text-xs leading-5 text-[#111827]/45">
              Podpowiedź podmienia słownictwo łodziowe i zostawia nazwy własne
              (Simrad, Webasto, LNT-9502). Nie odmienia przez przypadki — wyjdzie
              z tego szkic w rodzaju „Pre-rigg pod Mercury Verado ze sterowanie
              hydrauliczne", który trzeba poprawić ręcznie. Po to nazwy siedzą
              w polach do edycji.
            </p>
          ) : null}

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
                              row.skip ? "opacity-45" : isNew ? "bg-[#FFF7ED]" : ""
                            }`}
                          >
                            <td className="w-8 py-3">
                              <input
                                type="checkbox"
                                checked={row.include}
                                disabled={row.skip}
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
                                {row.skip
                                  ? " · pomijane — zapamiętam na kolejne cenniki"
                                  : isNew
                                    ? " · bez pary — dołoży nową opcję"
                                    : ""}
                              </p>
                            </td>

                            <td className="py-3 pr-3">
                              <input
                                className={input}
                                value={row.label}
                                disabled={row.skip}
                                onChange={(event) =>
                                  update(row.line, {
                                    label: event.target.value,
                                    // Poprawka samej nazwy też jest zmianą do
                                    // zapisania. Bez tego ptaszka poprawione
                                    // tłumaczenie przepadało, bo cena się
                                    // nie zmieniła i wiersz zostawał pusty.
                                    include: true,
                                  })
                                }
                              />

                              {/* Wybór pary. „Dołóż jako nową" jest tu celowo
                                  na pierwszym miejscu tylko wtedy, gdy nic nie
                                  wybrano — dokładanie duplikatu obok istniejącej
                                  opcji to najczęstszy sposób na zabałaganienie
                                  konfiguratora. */}
                              <select
                                className={`${input} mt-1.5 text-xs`}
                                value={row.skip ? SKIP : row.ourId ? String(row.ourId) : ""}
                                onChange={(event) => pair(row.line, event.target.value)}
                              >
                                <option value="">— dołóż jako nową opcję —</option>
                                <option value={SKIP}>— pomiń, nie chcę tej pozycji —</option>
                                {row.ourId && row.ourName ? (
                                  <option value={String(row.ourId)}>
                                    {row.ourName.slice(0, 90)} · {money(row.ourPrice)}
                                  </option>
                                ) : null}
                                {free.map((item) => (
                                  <option key={item.id} value={String(item.id)}>
                                    {item.group ? `${item.group.slice(0, 24)} · ` : ""}
                                    {item.name.slice(0, 90)} · {money(item.price)}
                                    {isOffList(item) ? " · spoza cennika" : ""}
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
          <h2 className="text-xl font-semibold">U nas jest, w cenniku nie ma ({missing.length})</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#111827]/55">
            Lista topnieje w miarę parowania. Część z tego to nasze własne pozycje,
            których producent nigdy nie miał w cenniku — silniki Suzuki, COX, „bez
            silnika". Zaznacz przy nich „spoza cennika", a przestaną się dopominać
            przy każdym imporcie. Reszta to zwykle wycofane wersje; niczego z nimi
            nie robię, usuwa się je w Directusie.
          </p>

          <ul className="mt-4 grid gap-1.5 text-sm text-[#111827]/60 sm:grid-cols-2">
            {missing.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={false}
                  title="Oznacz jako pozycję spoza cennika producenta"
                  onChange={() =>
                    setOffList((current) => new Map(current).set(String(item.id), true))
                  }
                />
                <span>
                  {item.name.slice(0, 70)}{" "}
                  <span className="text-[#111827]/35">· {money(item.price)}</span>
                </span>
              </li>
            ))}
          </ul>

          {mine.length ? (
            <div className="mt-6 border-t border-[#111827]/10 pt-5">
              <p className="text-sm font-semibold text-[#111827]/70">
                Nasze pozycje spoza cennika ({mine.length})
              </p>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#111827]/55">
                Import ich nie rusza i nie podpowiada ich przy parowaniu. Odznacz,
                jeśli któraś jednak pojawiła się u producenta.
              </p>
              <ul className="mt-3 grid gap-1.5 text-sm text-[#111827]/60 sm:grid-cols-2">
                {mine.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked
                      onChange={() =>
                        setOffList((current) => new Map(current).set(String(item.id), false))
                      }
                    />
                    <span>
                      {item.name.slice(0, 70)}{" "}
                      <span className="text-[#111827]/35">· {money(item.price)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {offList.size ? (
            <button className={`${button} mt-5`} onClick={save} disabled={busy}>
              {busy ? "Zapisuję…" : "Zapisz oznaczenia"}
            </button>
          ) : null}
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
                {item.what}
                {typeof item.value === "number" ? ` → ${money(item.value)}` : ""}
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
