import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import PDFDocument from "pdfkit"
import nodemailer from "nodemailer"

export const runtime = "nodejs"

function formatNumber(value) {
  return String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function formatUsd(value) {
  return `${formatNumber(value)} USD`
}

function formatPln(value) {
  return `${formatNumber(value)} PLN`
}

function safeText(value) {
  return String(value || "").trim()
}

function chunkText(text, max = 110) {
  const words = String(text || "").split(/\s+/)
  const lines = []
  let line = ""

  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line)
      line = word
    } else {
      line = (line + " " + word).trim()
    }
  }

  if (line) lines.push(line)
  return lines
}

function addHeader(doc) {
  doc.font("Regular").fontSize(9).fillColor("#555")
  doc.text("MARINERO", 430, 36, { align: "right" })
  doc.text("A. Rybickiego 4B/U1", 430, 49, { align: "right" })
  doc.text("81-340 Gdynia", 430, 62, { align: "right" })
  doc.text("NIP: 586 235 53 76", 430, 75, { align: "right" })

  doc.font("Bold").fontSize(34).fillColor("#0047ff")
  doc.text("marinero", 72, 58)

  doc.font("Regular").fontSize(8).fillColor("#555")
  doc.text("Michał Jaworski", 72, 748)
  doc.text("+48 604 212 880", 72, 760)
  doc.text("michal@marinero.pl", 72, 772)

  doc.text("Autoryzowany dealer Nordkapp, Sting, XO Boats", 305, 748, { align: "right" })
  doc.text("Simrad, Garmin, Mercury oraz Suzuki Marine", 305, 760, { align: "right" })
  doc.text("Autoryzowany serwis Mercury oraz Suzuki Marine", 305, 772, { align: "right" })
}

function addFooterSignature(doc, y) {
  doc.font("Regular").fontSize(10).fillColor("#111")
  doc.text("Z poważaniem", 72, y)
  doc.text("Michał Jaworski", 72, y + 14)
  doc.text("Marinero.pl", 72, y + 28)
  doc.text("+48 604 212 880", 72, y + 42)
}

async function createOfferPdf(payload) {
  const storageDir = path.join(process.cwd(), "storage", "offers")
  await fs.mkdir(storageDir, { recursive: true })

  const filename = `oferta-${payload.modelSlug || "konfiguracja"}-${Date.now()}.pdf`
  const filePath = path.join(storageDir, filename)

  const fontRegular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
  const fontBold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: "A4",
    margin: 0,
    info: {
      Title: `Oferta ${payload.modelName}`,
      Author: "Marinero",
    },
  })

  const chunks = []
  doc.on("data", (chunk) => chunks.push(chunk))

  const handle = await fs.open(filePath, "w")
  doc.pipe(handle.createWriteStream())

  doc.registerFont("Regular", fontRegular)
  doc.registerFont("Bold", fontBold)

  doc.addPage()
  doc.font("Regular")

  addHeader(doc)

  doc.font("Regular").fontSize(15).fillColor("#111")
  doc.text(`Oferta ${payload.modelName}`, 72, 135)

  doc.font("Regular").fontSize(10).fillColor("#333")
  doc.text(`Klient: ${safeText(payload.clientName) || "-"}`, 72, 165)
  doc.text(`Email: ${safeText(payload.clientEmail) || "-"}`, 72, 180)
  doc.text(`Telefon: ${safeText(payload.clientPhone) || "-"}`, 72, 195)

  doc.roundedRect(72, 235, 452, 240, 8).fill("#f2f4f8")
  doc.fillColor("#2E64A8").font("Bold").fontSize(24)
  doc.text(payload.modelName || "Konfiguracja łodzi", 98, 285, { width: 400 })
  doc.font("Regular").fontSize(12).fillColor("#333")
  doc.text("Oferta przygotowana na podstawie konfiguratora Marinero.", 98, 345, { width: 380 })

  doc.addPage()
  addHeader(doc)

  let y = 115

  doc.font("Regular").fontSize(14).fillColor("#111")
  doc.text("Wyposażenie dodatkowe:", 72, y)
  y += 30

  doc.font("Regular").fontSize(9).fillColor("#111")

  const selected = Array.isArray(payload.selectedOptions) ? payload.selectedOptions : []

  if (selected.length === 0) {
    doc.text("✓ Nie wybrano dodatkowych opcji", 88, y)
    y += 18
  } else {
    for (const option of selected) {
      const label = `${option.name} + ${formatUsd(option.price)}`
      const lines = chunkText(label, 95)

      if (y > 690) {
        doc.addPage()
        addHeader(doc)
        y = 115
      }

      doc.text("✓", 88, y)
      doc.text(lines[0] || "", 108, y, { width: 390 })

      y += 15

      for (const extra of lines.slice(1)) {
        doc.text(extra, 108, y, { width: 390 })
        y += 15
      }

      y += 2
    }
  }

  y += 18

  if (y > 645) {
    doc.addPage()
    addHeader(doc)
    y = 115
  }

  doc.font("Regular").fontSize(10).fillColor("#111")
  doc.text(`Cena bazowa łodzi: ${formatUsd(payload.basePrice)} netto`, 72, y)
  y += 22
  doc.text(`Wyposażenie dodatkowe: ${formatUsd(payload.optionsTotal)} netto`, 72, y)
  y += 22
  doc.font("Bold").fontSize(12)
  doc.text(`Cena razem: ${formatUsd(payload.netTotal)} netto`, 72, y)
  y += 24
  doc.font("Regular").fontSize(10)
  doc.text(`Orientacyjnie brutto PLN (VAT 23%): ${formatPln(payload.grossPln)}`, 72, y)

  if (payload.notes) {
    y += 35
    doc.font("Regular").fontSize(10).fillColor("#111")
    doc.text("Uwagi:", 72, y)
    y += 16
    doc.text(payload.notes, 72, y, { width: 452 })
  }

  addFooterSignature(doc, 690)

  doc.end()

  await new Promise((resolve, reject) => {
    doc.on("end", resolve)
    doc.on("error", reject)
  })

  await handle.close()

  const buffer = Buffer.concat(chunks)
  return { filename, filePath, buffer }
}

async function uploadPdfToDirectus(pdf, payload) {
  const directusUrl = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL
  const token = process.env.DIRECTUS_ADMIN_TOKEN

  if (!directusUrl || !token) {
    return { ok: false, reason: "missing_directus_token" }
  }

  const form = new FormData()
  const blob = new Blob([pdf.buffer], { type: "application/pdf" })

  form.append("file", blob, pdf.filename)
  form.append("title", `Oferta ${payload.modelName}`)
  form.append("description", `Oferta z konfiguratora dla ${payload.clientName || payload.clientEmail || "klienta"}`)

  const response = await fetch(`${directusUrl}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  const text = await response.text()

  if (!response.ok) {
    return { ok: false, reason: text }
  }

  const json = JSON.parse(text)
  return { ok: true, id: json?.data?.id, data: json?.data }
}

async function saveToDirectus(payload, pdfFilename, emailStatus, pdfFileId) {
  const directusUrl = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL

  if (!directusUrl) {
    return { ok: false, reason: "DIRECTUS_URL missing" }
  }

  const body = {
    status: "new",
    model_slug: payload.modelSlug,
    model_name: payload.modelName,
    brand_name: payload.brandName,
    client_name: payload.clientName,
    client_email: payload.clientEmail,
    client_phone: payload.clientPhone,
    notes: payload.notes,
    currency: payload.currency || "USD",
    base_price: payload.basePrice,
    options_total: payload.optionsTotal,
    net_total: payload.netTotal,
    gross_pln: payload.grossPln,
    usd_to_pln: payload.usdToPln,
    vat_rate: payload.vatRate,
    selected_options: payload.selectedOptions || [],
    summary: payload.summary,
    pdf_filename: pdfFilename,
    email_status: emailStatus,
  }

  if (pdfFileId) {
    body.pdf_file = pdfFileId
  }

  const response = await fetch(`${directusUrl}/items/quote_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    return { ok: false, reason: text }
  }

  return { ok: true, data: await response.json() }
}

async function sendEmails(payload, pdf) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.MAIL_FROM || user
  const toAdmin = process.env.MAIL_TO || "michal@marinero.pl"

  if (!host || !user || !pass || !from) {
    return "email_skipped_no_smtp"
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  })

  const subject = `Konfiguracja ${payload.modelName}`

  const html = `
    <p>Dzień dobry,</p>
    <p>w załączeniu przesyłamy konfigurację modelu <strong>${payload.modelName}</strong>.</p>
    <p>Razem netto: <strong>${formatUsd(payload.netTotal)}</strong><br>
    Orientacyjnie brutto PLN (VAT 23%): <strong>${formatPln(payload.grossPln)}</strong></p>
    <p>Marinero</p>
  `

  const attachment = {
    filename: pdf.filename,
    content: pdf.buffer,
    contentType: "application/pdf",
  }

  await transporter.sendMail({
    from,
    to: payload.clientEmail || toAdmin,
    bcc: toAdmin,
    subject,
    html,
    attachments: [attachment],
  })

  return "sent"
}

export async function POST(request) {
  try {
    const payload = await request.json()

    if (!payload?.modelName) {
      return NextResponse.json({ ok: false, error: "Brak modelu" }, { status: 400 })
    }

    if (!payload?.clientEmail) {
      return NextResponse.json({ ok: false, error: "Brak adresu email" }, { status: 400 })
    }

    const pdf = await createOfferPdf(payload)
    const directusPdf = await uploadPdfToDirectus(pdf, payload)
    const emailStatus = await sendEmails(payload, pdf)
    const saved = await saveToDirectus(
      payload,
      pdf.filename,
      emailStatus,
      directusPdf.ok ? directusPdf.id : null
    )

    return NextResponse.json({
      ok: true,
      emailStatus,
      directusPdf,
      saved,
      pdfFilename: pdf.filename,
    })
  } catch (error) {
    console.error("Configurator submit error", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Błąd wysyłki zapytania" },
      { status: 500 }
    )
  }
}
