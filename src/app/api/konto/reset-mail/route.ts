import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { SITE_URL } from "@/lib/seo"

// nodemailer nie ma typów w tym projekcie — reszta serwisu używa go tak samo.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require("nodemailer")

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Mail z linkiem do ustawienia nowego hasła.
 *
 * Wygląda okrężnie, ale inaczej się nie da. Medusa na `reset-password` nie
 * oddaje tokenu w odpowiedzi — emituje zdarzenie `auth.password_reset`
 * **wewnątrz swojego kontenera**. Kontener stoi osobno (`/opt/marinero`)
 * i nie da się do niego dołożyć kodu z tego repozytorium, więc token przynosi
 * tu mały subskrybent po stronie Medusy (`deploy/medusa/reset-hasla/`),
 * a treść maila i SMTP zostają w jednym miejscu — u nas.
 *
 * Wejście chroni `RESET_HOOK_TOKEN`: bez niego endpoint w ogóle nie działa.
 * Otwarty pozwalałby komukolwiek wysyłać z naszej skrzynki listy „zresetuj
 * hasło" na dowolny adres, z linkiem, który sam by wymyślił.
 */

function rowne(a: string, b: string): boolean {
  const pierwszy = Buffer.from(a)
  const drugi = Buffer.from(b)
  // Porównanie stałoczasowe wymaga równej długości — inaczej `timingSafeEqual`
  // rzuca wyjątkiem i sama długość klucza wyciekłaby przez błąd.
  if (pierwszy.length !== drugi.length) return false
  return crypto.timingSafeEqual(pierwszy, drugi)
}

function tresc(link: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#0E1A2B;max-width:620px">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#2E64A8;margin:0 0 8px">
      Marinero
    </p>

    <h1 style="font-size:22px;margin:0 0 16px">Ustaw nowe hasło</h1>

    <p style="line-height:1.7;margin:0 0 20px">
      Ktoś — mamy nadzieję, że Ty — poprosił o zmianę hasła do konta w sklepie Marinero.
      Kliknij poniżej i ustaw nowe.
    </p>

    <p style="margin:0 0 24px">
      <a href="${link}"
         style="display:inline-block;background:#2E64A8;color:#fff;text-decoration:none;
                padding:14px 26px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;
                font-size:13px">
        Ustaw nowe hasło
      </a>
    </p>

    <p style="line-height:1.7;margin:0 0 20px;color:#6b7280;font-size:13px">
      Odnośnik działa <strong>raz</strong> i tylko przez ograniczony czas. Jeśli to nie Ty
      prosiłeś o zmianę, po prostu zignoruj tę wiadomość — hasło zostaje bez zmian.
    </p>

    <p style="line-height:1.7;margin:0;color:#6b7280;font-size:13px">
      Gdyby przycisk nie działał, wklej ten adres w przeglądarkę:<br />
      <span style="word-break:break-all">${link}</span>
    </p>
  </div>`
}

export async function POST(request: Request) {
  const klucz = process.env.RESET_HOOK_TOKEN || ""
  if (!klucz) {
    return NextResponse.json(
      { ok: false, blad: "Reset hasła nie jest skonfigurowany (brak RESET_HOOK_TOKEN)." },
      { status: 503 }
    )
  }

  const podany = request.headers.get("x-reset-token") || ""
  if (!rowne(podany, klucz)) {
    return NextResponse.json({ ok: false, blad: "Brak dostępu." }, { status: 401 })
  }

  let dane: any
  try {
    dane = await request.json()
  } catch {
    return NextResponse.json({ ok: false, blad: "Nieprawidłowe dane." }, { status: 400 })
  }

  const email = String(dane?.email || "").trim()
  const token = String(dane?.token || "").trim()
  if (!email || !token) {
    return NextResponse.json({ ok: false, blad: "Brak adresu albo tokenu." }, { status: 400 })
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Ten sam stan co przy ofertach i zamówieniach: brak SMTP to nie awaria,
    // tylko brak konfiguracji, i ma się nazywać tak samo.
    return NextResponse.json({ ok: false, powod: "email_skipped_no_smtp" }, { status: 503 })
  }

  const link =
    `${SITE_URL}/sklep/konto/nowe-haslo` +
    `?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      // Bez kopii do biura: w załączniku jest link, którym da się przejąć
      // konto klienta, a skrzynka firmowa jest wspólna.
      subject: "Marinero — ustaw nowe hasło",
      html: tresc(link),
    })
  } catch (problem: any) {
    return NextResponse.json(
      { ok: false, blad: problem?.message || "Nie udało się wysłać maila." },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
