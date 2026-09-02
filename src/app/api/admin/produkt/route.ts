import { NextResponse } from "next/server"
import { odswiezSklep } from "@/lib/odswiez"
import { parametryDoZapisu } from "@/lib/parametry"
import { dopiszCene } from "@/lib/historia-cen"
import { getAdminToken } from "@/lib/admin-auth"
import {
  hasAdminToken,
  listAdminCategories,
  pobierzProdukt,
  wgrajZdjecie,
  zalozProdukt,
  zapiszProdukt,
  zmienCeneWariantu,
} from "@/lib/medusa-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Adres produktu w sklepie — z nazwy, bez polskich znaków i bez śmieci. */
function naHandle(tekst: string): string {
  const bezOgonkow = tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")

  return bezOgonkow
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export async function GET(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }
  if (!hasAdminToken()) {
    return NextResponse.json({ dostepne: false, powod: "brak_klucza_medusy" })
  }

  const id = new URL(request.url).searchParams.get("id") || ""

  try {
    const kategorie = await listAdminCategories().catch(() => [])
    // Bez `id` oddajemy same kategorie — formularz nowego produktu ich potrzebuje.
    if (!id) return NextResponse.json({ dostepne: true, kategorie })

    return NextResponse.json({ dostepne: true, produkt: await pobierzProdukt(id), kategorie })
  } catch (problem: any) {
    return NextResponse.json(
      { dostepne: false, powod: "medusa", blad: problem?.message || "Medusa nie odpowiada" },
      { status: 502 }
    )
  }
}

export async function POST(request: Request) {
  if (!(await getAdminToken())) {
    return NextResponse.json({ error: "Zaloguj się" }, { status: 401 })
  }

  // Wgranie zdjęcia przychodzi jako formularz z plikiem, reszta jako JSON.
  const typ = request.headers.get("content-type") || ""

  if (typ.includes("multipart/form-data")) {
    try {
      const formularz = await request.formData()
      const plik = formularz.get("plik")
      if (!(plik instanceof File)) {
        return NextResponse.json({ ok: false, blad: "Brak pliku." }, { status: 400 })
      }
      return NextResponse.json({ ok: true, url: await wgrajZdjecie(plik) })
    } catch (problem: any) {
      return NextResponse.json({ ok: false, blad: problem?.message || "Nie udało się wgrać." }, { status: 500 })
    }
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  try {
    if (dane?.co === "nowy") {
      const tytul = String(dane?.tytul || "").trim()
      if (!tytul) return NextResponse.json({ ok: false, blad: "Podaj nazwę produktu." }, { status: 400 })

      const cena = Number(dane?.cena)
      if (!Number.isFinite(cena) || cena < 0) {
        return NextResponse.json({ ok: false, blad: "Cena musi być liczbą nieujemną." }, { status: 400 })
      }

      const { id } = await zalozProdukt({
        tytul,
        handle: String(dane?.handle || "").trim() || naHandle(tytul),
        opis: String(dane?.opis || ""),
        sku: String(dane?.sku || "").trim(),
        cena,
        kategoria: String(dane?.kategoria || ""),
        dostepnosc: String(dane?.dostepnosc || ""),
        ean: String(dane?.ean || "").trim(),
        parametry: parametryDoZapisu(dane?.parametry || {}),
        miniatura: String(dane?.miniatura || ""),
        opublikuj: Boolean(dane?.opublikuj),
      })

      return NextResponse.json({ ok: true, id })
    }

    const id = String(dane?.id || "")
    if (!id) return NextResponse.json({ ok: false, blad: "Brak produktu." }, { status: 400 })

    const metadata: Record<string, unknown> = {}
    if (typeof dane.dostepnosc === "string") metadata.dostepnosc = dane.dostepnosc
    if (dane.sztuki !== undefined) {
      const ile = Number(dane.sztuki)
      metadata.sztuki = dane.sztuki === "" || !Number.isFinite(ile) ? "" : Math.max(0, Math.round(ile))
    }
    if (typeof dane.ean === "string") metadata.ean = dane.ean.trim().slice(0, 40)

    // Waga w kilogramach — stąd bierze ją feed do Google. Puste pole zapisujemy
    // jako pustkę, a nie kasujemy klucza: metadane Medusy się scalają i klucza
    // nie da się usunąć, więc „nie wiem" trzeba umieć zapisać.
    if (dane.waga !== undefined) {
      const kg = Number(String(dane.waga).replace(",", "."))
      metadata.waga = dane.waga === "" || !Number.isFinite(kg) || kg <= 0 ? "" : kg
    }

    // Cena detaliczna: liczba do porównania; przełącznik obok decyduje, czy
    // klient zobaczy ją przekreśloną. Data zmienia się tylko razem z kwotą.
    if (dane.cenaDetaliczna !== undefined) {
      const kwota = Number(String(dane.cenaDetaliczna).replace(",", "."))
      const czysta = Number.isFinite(kwota) && kwota > 0 ? Math.round(kwota * 100) / 100 : ""
      metadata.cena_detaliczna = czysta
      if (czysta !== "") metadata.cena_detaliczna_zmieniona = new Date().toISOString()
    }
    if (dane.przekreslona !== undefined) {
      metadata.cena_przekreslona = Boolean(dane.przekreslona)
    }

    // „Wybrane produkty" na stronie głównej sklepu. Odznaczenie zapisujemy
    // jako `false`, nie kasujemy klucza: metadane Medusy się **scalają**
    // i klucza nie da się usunąć — `null` zostawiłby go z wartością `null`.
    if (dane.polecany !== undefined) {
      metadata.polecany = Boolean(dane.polecany)
    }
    if (dane.polecanyKolejnosc !== undefined) {
      const numer = Number(dane.polecanyKolejnosc)
      metadata.polecany_kolejnosc =
        dane.polecanyKolejnosc === "" || !Number.isFinite(numer)
          ? ""
          : Math.max(0, Math.round(numer))
    }

    // Parametry techniczne (moc, kolumna, sterowanie…) — po nich działają
    // filtry w katalogu. Wpisane w panelu wygrywają z odczytem z nazwy.
    if (dane.parametry && typeof dane.parametry === "object") {
      Object.assign(metadata, parametryDoZapisu(dane.parametry))
    }

    const produkt = await zapiszProdukt(id, {
      tytul: dane.tytul,
      podtytul: dane.podtytul,
      opis: dane.opis,
      handle: dane.handle,
      status: dane.status,
      miniatura: dane.miniatura,
      zdjecia: dane.zdjecia,
      kategorie: dane.kategorie,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    })

    // Cena osobno — należy do wariantu, nie do produktu.
    if (dane.cena !== undefined && dane.wariantId) {
      const cena = Number(dane.cena)
      if (!Number.isFinite(cena) || cena < 0) {
        return NextResponse.json({ ok: false, blad: "Cena musi być liczbą nieujemną." }, { status: 400 })
      }
      await zmienCeneWariantu(id, String(dane.wariantId), cena)

      // Data i wpis do historii po udanym zapisie — odrzucona cena nie może
      // zostawić świeżej daty ani fałszywego wpisu w archiwum, z którego
      // liczy się najniższą cenę z 30 dni.
      const przed = await pobierzProdukt(id).catch(() => null)
      await zapiszProdukt(id, {
        metadata: {
          cena_zmieniona: new Date().toISOString(),
          historia_cen: dopiszCene({ historia_cen: przed?.historia || [] }, cena),
        },
      }).catch(() => null)
    }

    // Odświeżamy tylko strony tego produktu — patrz `src/lib/odswiez.ts`.
    if (produkt.handle) odswiezSklep([produkt.handle])

    return NextResponse.json({ ok: true, produkt: await pobierzProdukt(id).catch(() => produkt) })
  } catch (problem: any) {
    return NextResponse.json({ ok: false, blad: problem?.message || "Nie udało się zapisać." }, { status: 500 })
  }
}
