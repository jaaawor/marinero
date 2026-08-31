"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Wariant = { id: string; tytul: string; sku: string; cena: number }
type Kategoria = { id: string; name: string }

type Produkt = {
  id: string
  tytul: string
  podtytul: string
  opis: string
  handle: string
  status: string
  miniatura: string
  zdjecia: { id: string; url: string }[]
  kategorie: string[]
  dostepnosc: string
  sztuki: number | null
  ean: string
  warianty: Wariant[]
}

const DOSTEPNOSCI = [
  { klucz: "", nazwa: "— zgaduje po marce —" },
  { klucz: "od-reki", nazwa: "Od ręki" },
  { klucz: "2-3-dni", nazwa: "2–3 dni" },
  { klucz: "7-10-dni", nazwa: "7–10 dni" },
  { klucz: "14-dni", nazwa: "Do 14 dni" },
  { klucz: "na-zamowienie", nazwa: "Na zamówienie" },
  { klucz: "niedostepny", nazwa: "Niedostępny" },
]

const pole =
  "w-full rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const etykieta =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]/40"

export default function ProduktEdytor({ id }: { id?: string }) {
  const router = useRouter()
  const nowy = !id

  const [kategorie, setKategorie] = useState<Kategoria[]>([])
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad">("laduje")
  const [blad, setBlad] = useState("")
  const [komunikat, setKomunikat] = useState("")
  const [zapisuje, setZapisuje] = useState(false)
  const [wgrywa, setWgrywa] = useState(false)

  const [dane, setDane] = useState({
    tytul: "",
    podtytul: "",
    opis: "",
    handle: "",
    status: "draft",
    sku: "",
    cena: "",
    kategoria: "",
    dostepnosc: "",
    sztuki: "",
    ean: "",
    miniatura: "",
  })
  const [zdjecia, setZdjecia] = useState<string[]>([])
  const [wariantId, setWariantId] = useState("")

  const pobierz = useCallback(async () => {
    setStan("laduje")
    try {
      const odpowiedz = await fetch(`/api/admin/produkt${id ? `?id=${id}` : ""}`)
      const wynik = await odpowiedz.json()

      if (!wynik.dostepne) {
        setStan("blad")
        setBlad(
          wynik.powod === "brak_klucza_medusy"
            ? "Brak klucza do Medusy. Dopisz MEDUSA_ADMIN_TOKEN do .env.local na serwerze."
            : wynik.blad || "Medusa nie odpowiada."
        )
        return
      }

      setKategorie(wynik.kategorie || [])

      const p: Produkt | undefined = wynik.produkt
      if (p) {
        const wariant = p.warianty[0]
        setDane({
          tytul: p.tytul,
          podtytul: p.podtytul,
          opis: p.opis,
          handle: p.handle,
          status: p.status,
          sku: wariant?.sku || "",
          cena: wariant ? String(wariant.cena) : "",
          kategoria: p.kategorie[0] || "",
          dostepnosc: p.dostepnosc,
          sztuki: p.sztuki === null ? "" : String(p.sztuki),
          ean: p.ean,
          miniatura: p.miniatura,
        })
        setZdjecia(p.zdjecia.map((z) => z.url))
        setWariantId(wariant?.id || "")
      }

      setStan("gotowe")
    } catch {
      setStan("blad")
      setBlad("Brak połączenia z serwerem.")
    }
  }, [id])

  useEffect(() => {
    pobierz()
  }, [pobierz])

  function ustaw(nazwa: keyof typeof dane, wartosc: string) {
    setDane((teraz) => ({ ...teraz, [nazwa]: wartosc }))
    setKomunikat("")
  }

  async function wgraj(pliki: FileList | null) {
    if (!pliki?.length) return
    setWgrywa(true)
    setKomunikat("")

    for (const plik of Array.from(pliki)) {
      const formularz = new FormData()
      formularz.append("plik", plik)

      try {
        const odpowiedz = await fetch("/api/admin/produkt", { method: "POST", body: formularz })
        const wynik = await odpowiedz.json()

        if (!wynik.ok) {
          setKomunikat(`Nie wgrano ${plik.name}: ${wynik.blad || "błąd"}`)
          continue
        }

        setZdjecia((teraz) => [...teraz, wynik.url])
        // Pierwsze zdjęcie zostaje miniaturą — to ono trafia na kafelki
        // w sklepie, a osobne klikanie „ustaw jako główne" przy jednym
        // zdjęciu byłoby pustą robotą.
        setDane((teraz) => (teraz.miniatura ? teraz : { ...teraz, miniatura: wynik.url }))
      } catch {
        setKomunikat(`Nie wgrano ${plik.name}: brak połączenia`)
      }
    }

    setWgrywa(false)
  }

  async function zapisz() {
    setZapisuje(true)
    setKomunikat("")

    const tresc = nowy
      ? {
          co: "nowy",
          tytul: dane.tytul,
          handle: dane.handle,
          opis: dane.opis,
          sku: dane.sku,
          cena: Number(dane.cena || 0),
          kategoria: dane.kategoria,
          dostepnosc: dane.dostepnosc,
          ean: dane.ean,
          miniatura: dane.miniatura || zdjecia[0] || "",
          opublikuj: dane.status === "published",
        }
      : {
          id,
          tytul: dane.tytul,
          podtytul: dane.podtytul,
          opis: dane.opis,
          handle: dane.handle,
          status: dane.status,
          miniatura: dane.miniatura,
          zdjecia,
          kategorie: dane.kategoria ? [dane.kategoria] : [],
          dostepnosc: dane.dostepnosc,
          sztuki: dane.sztuki,
          ean: dane.ean,
          ...(wariantId ? { wariantId, cena: Number(dane.cena || 0) } : {}),
        }

    try {
      const odpowiedz = await fetch("/api/admin/produkt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tresc),
      })
      const wynik = await odpowiedz.json()

      if (!wynik.ok) {
        setKomunikat(wynik.blad || "Nie udało się zapisać.")
        return
      }

      if (nowy && wynik.id) {
        router.push(`/narzedzia-8f3a/produkty/${wynik.id}`)
        return
      }

      setKomunikat("Zapisane.")
      await pobierz()
    } catch {
      setKomunikat("Brak połączenia z serwerem.")
    } finally {
      setZapisuje(false)
    }
  }

  if (stan === "laduje") return <p className="text-sm text-[#111827]/50">Wczytuję…</p>

  if (stan === "blad") {
    return <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{blad}</p>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-5 rounded-lg border border-[#111827]/10 bg-white p-6">
        <div>
          <label className={etykieta} htmlFor="tytul">
            Nazwa
          </label>
          <input
            id="tytul"
            value={dane.tytul}
            onChange={(z) => ustaw("tytul", z.target.value)}
            className={pole}
          />
        </div>

        {!nowy ? (
          <div>
            <label className={etykieta} htmlFor="podtytul">
              Podtytuł
            </label>
            <input
              id="podtytul"
              value={dane.podtytul}
              onChange={(z) => ustaw("podtytul", z.target.value)}
              className={pole}
            />
          </div>
        ) : null}

        <div>
          <label className={etykieta} htmlFor="opis">
            Opis
          </label>
          <textarea
            id="opis"
            rows={8}
            value={dane.opis}
            onChange={(z) => ustaw("opis", z.target.value)}
            className={pole}
          />
        </div>

        <div>
          <label className={etykieta} htmlFor="handle">
            Adres w sklepie
          </label>
          <input
            id="handle"
            value={dane.handle}
            onChange={(z) => ustaw("handle", z.target.value)}
            placeholder={nowy ? "zostaw puste — zrobię z nazwy" : ""}
            className={pole}
          />
          {dane.handle ? (
            <p className="mt-1.5 text-xs text-[#111827]/40">
              marinero.pl/sklep/produkt/{dane.handle}
            </p>
          ) : null}
        </div>

        <div>
          <label className={etykieta}>Zdjęcia</label>

          {zdjecia.length ? (
            <div className="mb-3 flex flex-wrap gap-3">
              {zdjecia.map((url) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt=""
                    className={`h-24 w-24 rounded border object-contain ${
                      dane.miniatura === url ? "border-[#2E64A8]" : "border-[#111827]/10"
                    }`}
                  />
                  <div className="mt-1.5 flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => ustaw("miniatura", url)}
                      className={dane.miniatura === url ? "font-semibold text-[#2E64A8]" : "text-[#111827]/45 hover:text-[#2E64A8]"}
                    >
                      {dane.miniatura === url ? "główne" : "ustaw główne"}
                    </button>
                    {!nowy ? (
                      <button
                        type="button"
                        onClick={() => {
                          setZdjecia((teraz) => teraz.filter((z) => z !== url))
                          if (dane.miniatura === url) ustaw("miniatura", "")
                        }}
                        className="text-[#111827]/45 hover:text-red-600"
                      >
                        usuń
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <input
            type="file"
            accept="image/*"
            multiple
            disabled={wgrywa}
            onChange={(z) => wgraj(z.target.files)}
            className="text-sm"
          />
          {wgrywa ? <p className="mt-2 text-sm text-[#111827]/50">Wgrywam…</p> : null}
          <p className="mt-2 text-xs text-[#111827]/40">
            Pakshoty na białym tle — takie same jak reszta katalogu.
          </p>
        </div>
      </div>

      <aside className="grid h-fit gap-5 rounded-lg border border-[#111827]/10 bg-white p-6">
        <div>
          <label className={etykieta} htmlFor="status">
            Stan
          </label>
          <select
            id="status"
            value={dane.status}
            onChange={(z) => ustaw("status", z.target.value)}
            className={pole}
          >
            <option value="draft">Szkic — niewidoczny w sklepie</option>
            <option value="published">Opublikowany</option>
          </select>
        </div>

        <div>
          <label className={etykieta} htmlFor="kategoria">
            Kategoria
          </label>
          <select
            id="kategoria"
            value={dane.kategoria}
            onChange={(z) => ustaw("kategoria", z.target.value)}
            className={pole}
          >
            <option value="">— bez kategorii —</option>
            {kategorie.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etykieta} htmlFor="cena">
            Cena brutto (zł)
          </label>
          <input
            id="cena"
            inputMode="decimal"
            value={dane.cena}
            onChange={(z) => ustaw("cena", z.target.value)}
            className={`${pole} text-right tabular-nums`}
          />
        </div>

        <div>
          <label className={etykieta} htmlFor="sku">
            SKU
          </label>
          <input
            id="sku"
            value={dane.sku}
            onChange={(z) => ustaw("sku", z.target.value)}
            disabled={!nowy}
            className={`${pole} disabled:bg-[#111827]/3 disabled:text-[#111827]/45`}
          />
          {!nowy ? (
            <p className="mt-1.5 text-xs text-[#111827]/40">
              SKU zmienia się w panelu Medusy — po nim łączymy oferty z Allegro.
            </p>
          ) : null}
        </div>

        <div>
          <label className={etykieta} htmlFor="dostepnosc">
            Dostępność
          </label>
          <select
            id="dostepnosc"
            value={dane.dostepnosc}
            onChange={(z) => ustaw("dostepnosc", z.target.value)}
            className={pole}
          >
            {DOSTEPNOSCI.map((d) => (
              <option key={d.klucz} value={d.klucz}>
                {d.nazwa}
              </option>
            ))}
          </select>
        </div>

        {!nowy ? (
          <div>
            <label className={etykieta} htmlFor="sztuki">
              Sztuk na stanie
            </label>
            <input
              id="sztuki"
              inputMode="numeric"
              value={dane.sztuki}
              onChange={(z) => ustaw("sztuki", z.target.value)}
              className={`${pole} text-right tabular-nums`}
            />
          </div>
        ) : null}

        <div>
          <label className={etykieta} htmlFor="ean">
            EAN
          </label>
          <input
            id="ean"
            value={dane.ean}
            onChange={(z) => ustaw("ean", z.target.value)}
            className={`${pole} tabular-nums`}
          />
          <p className="mt-1.5 text-xs text-[#111827]/40">
            Bez niego Google Merchant dostaje „brak identyfikatora”.
          </p>
        </div>

        <button
          type="button"
          onClick={zapisz}
          disabled={zapisuje || !dane.tytul}
          className="rounded-md bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-60"
        >
          {zapisuje ? "Zapisuję…" : nowy ? "Załóż produkt" : "Zapisz zmiany"}
        </button>

        {komunikat ? <p className="text-sm text-[#111827]/70">{komunikat}</p> : null}

        {!nowy && dane.status === "published" && dane.handle ? (
          <a
            href={`/sklep/produkt/${dane.handle}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#2E64A8] hover:underline"
          >
            Zobacz w sklepie →
          </a>
        ) : null}
      </aside>
    </div>
  )
}
