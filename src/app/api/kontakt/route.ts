import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIRECTUS_URL =
  process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "https://dms.marinero.150197.pl"

const SERVICE_MAIL = "serwis@marinero.pl"
const OFFICE_MAIL = "biuro@marinero.pl"

type Payload = {
  kind?: string
  name?: string
  email?: string
  phone?: string
  boat?: string
  serviceType?: string
  preferredDate?: string
  message?: string
  /** Pole-pułapka: człowiek go nie widzi, bot je wypełnia. */
  website?: string
}

/**
 * Formularz ze strony kontaktu — pytanie albo zapis na serwis okresowy.
 *
 * Zgłoszenie ZAWSZE ląduje w Directusie (`contact_requests`), a mail jest
 * dodatkiem. Odwrotna kolejność gubiłaby zgłoszenia za każdym razem, gdy
 * SMTP nie odpowie — a to już raz kosztowało nas oferty z konfiguratora.
 */
export async function POST(request: Request) {
  let body: Payload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 })
  }

  // Bot wypełnia każde pole formularza, także to ukryte. Człowiek nie ma jak.
  if (body.website) {
    return NextResponse.json({ ok: true })
  }

  const kind = body.kind === "serwis" ? "serwis" : "pytanie"
  const name = String(body.name || "").trim().slice(0, 120)
  const email = String(body.email || "").trim().slice(0, 160)
  const phone = String(body.phone || "").trim().slice(0, 40)
  const message = String(body.message || "").trim().slice(0, 4000)

  if (!name || (!email && !phone)) {
    return NextResponse.json(
      { error: "Podaj imię oraz e-mail albo telefon — inaczej nie mamy jak odpisać." },
      { status: 400 }
    )
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Adres e-mail wygląda na niepełny." }, { status: 400 })
  }

  if (kind === "serwis" && !message && !body.boat) {
    return NextResponse.json(
      { error: "Napisz, jaka łódź albo silnik — bez tego nie umówimy terminu." },
      { status: 400 }
    )
  }

  const record = {
    status: "nowe",
    kind,
    name,
    email,
    phone,
    boat: String(body.boat || "").trim().slice(0, 160),
    service_type: String(body.serviceType || "").trim().slice(0, 120),
    preferred_date: normalizeDate(body.preferredDate),
    message,
  }

  const saved = await saveToDirectus(record)
  const mail = await notify(record)

  if (!saved.ok && !mail.ok) {
    return NextResponse.json(
      { error: "Nie udało się wysłać zgłoszenia. Zadzwoń albo napisz na biuro@marinero.pl." },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, saved: saved.ok, mail: mail.reason })
}

function normalizeDate(value?: string): string | null {
  const text = String(value || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : text
}

async function saveToDirectus(record: Record<string, unknown>) {
  const token = process.env.DIRECTUS_ADMIN_TOKEN
  if (!token) return { ok: false, reason: "directus_skipped_no_token" }

  try {
    const response = await fetch(`${DIRECTUS_URL}/items/contact_requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(record),
      cache: "no-store",
    })
    return { ok: response.ok, reason: response.ok ? "saved" : `directus_${response.status}` }
  } catch {
    return { ok: false, reason: "directus_unreachable" }
  }
}

async function notify(record: Record<string, any>) {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return { ok: false, reason: "email_skipped_no_smtp" }

  try {
    // `nodemailer` nie ma typów w projekcie (jak w `configurator/submit`).
    const nodemailer: any = (await import("nodemailer" as string)).default
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user, pass },
    })

    const serwis = record.kind === "serwis"
    const lines = [
      `Rodzaj: ${serwis ? "zapis na serwis okresowy" : "pytanie ze strony"}`,
      `Imię: ${record.name}`,
      record.phone ? `Telefon: ${record.phone}` : "",
      record.email ? `E-mail: ${record.email}` : "",
      record.boat ? `Łódź / silnik: ${record.boat}` : "",
      record.service_type ? `Zakres: ${record.service_type}` : "",
      record.preferred_date ? `Preferowany termin: ${record.preferred_date}` : "",
      "",
      record.message || "",
    ].filter(Boolean)

    await transport.sendMail({
      from: process.env.MAIL_FROM || user,
      // Zgłoszenia serwisowe idą do serwisu, reszta do biura — inaczej
      // wszystko lądowało w jednej skrzynce i ginęło.
      to: serwis ? SERVICE_MAIL : process.env.MAIL_TO || OFFICE_MAIL,
      replyTo: record.email || undefined,
      subject: serwis
        ? `Serwis okresowy — ${record.name}`
        : `Pytanie ze strony — ${record.name}`,
      text: lines.join("\n"),
    })

    return { ok: true, reason: "sent" }
  } catch {
    return { ok: false, reason: "email_failed" }
  }
}
