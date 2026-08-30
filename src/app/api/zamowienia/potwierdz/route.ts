import { NextResponse } from "next/server"
import { wyslijPotwierdzenie } from "@/lib/potwierdzenie-zamowienia"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Potwierdzenie zamówienia opłacanego przelewem.
 *
 * Przy PayU mail wychodzi z powiadomienia od nich (`/api/payu/notify`), bo
 * dopiero wtedy wiadomo, że pieniądze są. Przy przelewie tradycyjnym nikt się
 * już nie odzywa — zamówienie domyka przeglądarka i to ona musi powiedzieć,
 * że jest gotowe.
 *
 * Endpoint przyjmuje **sam identyfikator zamówienia**, a treść maila składa
 * z danych odczytanych z Medusy. Nic z przeglądarki nie trafia do wiadomości,
 * więc podszycie się pod cudze zamówienie nic nie daje: mail i tak pójdzie na
 * adres zapisany w zamówieniu, a znacznik w metadanych pilnuje, żeby poszedł
 * tylko raz.
 */
export async function POST(request: Request) {
  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, powod: "zly_json" }, { status: 400 })
  }

  const zamowienie = String(dane?.zamowienie || "").trim()
  if (!zamowienie) return NextResponse.json({ ok: false, powod: "brak_zamowienia" }, { status: 400 })

  const wynik = await wyslijPotwierdzenie(zamowienie).catch(() => ({
    wyslane: false,
    powod: "blad",
  }))

  return NextResponse.json({ ok: true, ...wynik })
}
