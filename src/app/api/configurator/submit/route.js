import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import PDFDocument from "pdfkit"
import nodemailer from "nodemailer"
import { getStandardEquipment } from "@/lib/standard-equipment-data"

export const runtime = "nodejs"

function safeText(value) {
  return String(value || "").trim()
}

// Osoby przygotowujące oferty pochodzą z kolekcji `team` w panelu admina.
// Poniższa lista to tylko awaryjny fallback, gdyby Directus był niedostępny.
const FALLBACK_CONTACTS = [
  { id: "michal", name: "Michał Jaworski", phone: "+48 604 212 880", email: "michal@marinero.pl" },
  { id: "marek", name: "Marek Moszczyński", phone: "+48 609 052 100", email: "marek@marinero.pl" },
]

async function loadOfferContacts() {
  const directusUrl = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL

  if (!directusUrl) return FALLBACK_CONTACTS

  try {
    const response = await fetch(
      // `offers` odsiewa kontakty, które są tylko w stopce (sklep, serwis).
      `${directusUrl}/items/team?filter[status][_eq]=published&filter[offers][_eq]=true&fields=id,name,email,phone,sort&limit=50&sort=sort`,
      { cache: "no-store" }
    )

    if (!response.ok) return FALLBACK_CONTACTS

    const json = await response.json()
    const list = (Array.isArray(json?.data) ? json.data : [])
      .map((item) => ({
        id: String(item.id),
        name: safeText(item.name),
        phone: safeText(item.phone),
        email: safeText(item.email),
      }))
      .filter((item) => item.name && (item.phone || item.email))

    return list.length ? list : FALLBACK_CONTACTS
  } catch {
    return FALLBACK_CONTACTS
  }
}

// Bez wyboru osoby oferta wychodzi z kontaktem do całego zespołu sprzedaży.
function resolveContacts(preparedBy, allContacts) {
  const key = String(preparedBy || "").toLowerCase()
  if (!key) return allContacts

  const contact = allContacts.find(
    (item) => String(item.id).toLowerCase() === key || item.email.toLowerCase() === key
  )

  return contact ? [contact] : allContacts
}

const PAGE_LEFT = 60
const PAGE_WIDTH = 475
const CONTENT_TOP = 96
const CONTENT_BOTTOM = 740
const ITEM_INDENT = 34
const ITEM_WIDTH = PAGE_WIDTH - ITEM_INDENT
const ITEM_GAP = 6
const SIGNATURE_HEIGHT = 45
const SIGNATURE_BOTTOM = 755

// Wysokość pozycji listy liczona przez PDFKit — tekst zawija się sam w ramach
// ITEM_WIDTH, więc długie opisy nie nachodzą na kolejną pozycję.
function itemHeight(doc, text) {
  return doc.heightOfString(String(text || ""), { width: ITEM_WIDTH })
}

function drawChecklistItem(doc, text, y) {
  doc.text("✓", PAGE_LEFT + 14, y)
  doc.text(String(text || ""), PAGE_LEFT + ITEM_INDENT, y, { width: ITEM_WIDTH })
}

// Nagłówek i stopka jak w referencyjnej ofercie: logo z pliku po lewej,
// dane firmy po prawej, kontakty + linie dealerskie na dole każdej strony.
function addHeader(doc, logoBuffer, contacts) {
  if (logoBuffer) {
    doc.image(logoBuffer, PAGE_LEFT, 30, { width: 165 })
  } else {
    doc.font("Bold").fontSize(26).fillColor("#2E64A8")
    doc.text("marinero", PAGE_LEFT, 32)
  }

  doc.font("Regular").fontSize(9).fillColor("#555")
  doc.text("MARINERO", 335, 28, { width: 200, align: "right" })
  doc.text("A. Rybickiego 4B/U1", 335, 41, { width: 200, align: "right" })
  doc.text("81-340 Gdynia", 335, 54, { width: 200, align: "right" })
  doc.text("NIP: 586 235 53 76", 335, 67, { width: 200, align: "right" })

  doc.font("Regular").fontSize(8).fillColor("#555")

  // Dwie kolumny kontaktów mieszczą się obok linii dealerskich — przy większym
  // zespole w stopce pokazujemy pierwsze dwie osoby wg kolejności z panelu.
  contacts.slice(0, 2).forEach((contact, index) => {
    const x = PAGE_LEFT + index * 125
    doc.text(contact.name, x, 776)
    doc.text(contact.phone, x, 788)
    doc.text(contact.email, x, 800)
  })

  doc.text("Autoryzowany dealer Nordkapp, Sting, XO Boats", 235, 776, { width: 300, align: "right" })
  doc.text("Simrad, Garmin, Mercury oraz Suzuki Marine", 235, 788, { width: 300, align: "right" })
  doc.text("Autoryzowany serwis Mercury oraz Suzuki Marine", 235, 800, { width: 300, align: "right" })
}

function addFooterSignature(doc, y, contacts) {
  doc.font("Regular").fontSize(10).fillColor("#111")
  doc.text("Z poważaniem", PAGE_LEFT, y)

  if (contacts.length === 1) {
    doc.text(contacts[0].name, PAGE_LEFT, y + 15)
    doc.text("Marinero.pl", PAGE_LEFT, y + 30)
    doc.text(contacts[0].phone, PAGE_LEFT, y + 45)
  } else {
    doc.text("Zespół Marinero", PAGE_LEFT, y + 15)
    doc.text("Marinero.pl", PAGE_LEFT, y + 30)
    doc.text(
      contacts
        .slice(0, 2)
        .map((contact) => contact.phone)
        .filter(Boolean)
        .join("  ·  "),
      PAGE_LEFT,
      y + 45
    )
  }
}

// Zdjęcie wkadrowane w prostokąt (cover + clip), żeby dwa duże kadry na
// stronie tytułowej wyglądały jak w ofercie wzorcowej.
function addCoverPhoto(doc, imageBuffer, y, height) {
  try {
    doc.save()
    doc.rect(PAGE_LEFT, y, PAGE_WIDTH, height).clip()
    doc.image(imageBuffer, PAGE_LEFT, y, {
      cover: [PAGE_WIDTH, height],
      align: "center",
      valign: "center",
    })
    doc.restore()
    return true
  } catch {
    doc.restore()
    return false
  }
}

async function readOptionalFile(filePath) {
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

async function createOfferPdf(payload, offerContacts) {
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
    // `font` w konstruktorze omija domyślną Helveticę (brak pliku .afm
    // w zbundlowanym buildzie Next) — nie usuwać.
    font: fontRegular,
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

  const logoBuffer = await readOptionalFile(
    path.join(process.cwd(), "public", "logo-marinero.png")
  )

  const contacts = resolveContacts(payload.preparedBy, offerContacts)

  const photosDir = path.join(process.cwd(), "public", "images", "models", payload.modelSlug || "")
  const photo1 = payload.modelSlug ? await readOptionalFile(path.join(photosDir, "01.jpg")) : null
  const photo2 = payload.modelSlug ? await readOptionalFile(path.join(photosDir, "02.jpg")) : null

  // --- Strona 1: tytuł oferty + dwa duże zdjęcia łodzi ---
  doc.addPage()
  doc.font("Regular")
  addHeader(doc, logoBuffer, contacts)

  doc.font("Bold").fontSize(20).fillColor("#111")
  doc.text(`Oferta ${payload.modelName}`, PAGE_LEFT, CONTENT_TOP, { width: PAGE_WIDTH })

  const clientLine = [safeText(payload.clientName), safeText(payload.clientEmail), safeText(payload.clientPhone)]
    .filter(Boolean)
    .join("  ·  ")

  if (clientLine) {
    doc.font("Regular").fontSize(9).fillColor("#555")
    doc.text(`Przygotowano dla: ${clientLine}`, PAGE_LEFT, CONTENT_TOP + 27, { width: PAGE_WIDTH })
  }

  const photoTop = CONTENT_TOP + 56
  const photoHeight = 295
  let photosDrawn = 0

  if (photo1) {
    photosDrawn += addCoverPhoto(doc, photo1, photoTop, photoHeight) ? 1 : 0
  }
  if (photo2) {
    const y2 = photosDrawn > 0 ? photoTop + photoHeight + 15 : photoTop
    photosDrawn += addCoverPhoto(doc, photo2, y2, photoHeight) ? 1 : 0
  }

  if (photosDrawn === 0) {
    doc.rect(PAGE_LEFT, photoTop, PAGE_WIDTH, photoHeight).fill("#f2f4f8")
    doc.fillColor("#2E64A8").font("Bold").fontSize(22)
    doc.text(payload.modelName || "Konfiguracja łodzi", PAGE_LEFT + 30, photoTop + 120, {
      width: PAGE_WIDTH - 60,
    })
  }

  // --- Strona 2: wyposażenie dodatkowe + podsumowanie ceny + podpis ---
  doc.addPage()
  addHeader(doc, logoBuffer, contacts)

  let y = CONTENT_TOP

  doc.font("Bold").fontSize(14).fillColor("#111")
  doc.text("Wyposażenie dodatkowe:", PAGE_LEFT, y)
  y += 26

  doc.font("Regular").fontSize(9).fillColor("#111")

  const selected = Array.isArray(payload.selectedOptions) ? payload.selectedOptions : []

  const ensureSpace = (needed) => {
    if (y + needed > CONTENT_BOTTOM) {
      doc.addPage()
      addHeader(doc, logoBuffer, contacts)
      y = CONTENT_TOP
      doc.font("Regular").fontSize(9).fillColor("#111")
    }
  }

  if (selected.length === 0) {
    drawChecklistItem(doc, "Nie wybrano dodatkowych opcji", y)
    y += itemHeight(doc, "Nie wybrano dodatkowych opcji") + ITEM_GAP
  } else {
    for (const option of selected) {
      const height = itemHeight(doc, option.name)
      ensureSpace(height + ITEM_GAP)
      drawChecklistItem(doc, option.name, y)
      y += height + ITEM_GAP
    }
  }

  y += 16

  if (payload.notes) {
    ensureSpace(60)
    doc.font("Bold").fontSize(10).fillColor("#111")
    doc.text("Uwagi:", PAGE_LEFT, y)
    y += 16
    doc.font("Regular").fontSize(10)
    doc.text(safeText(payload.notes), PAGE_LEFT, y, { width: PAGE_WIDTH })
    y = doc.y + 8
  }

  y += 12

  // Podpis może zejść niżej niż zwykła treść — dzięki temu nie ląduje sam
  // na osobnej stronie, gdy lista opcji kończy się przy dole strony.
  if (y + SIGNATURE_HEIGHT > SIGNATURE_BOTTOM) {
    doc.addPage()
    addHeader(doc, logoBuffer, contacts)
    y = CONTENT_TOP
  }

  addFooterSignature(doc, y, contacts)

  // --- Strona 3+: wyposażenie standardowe modelu ---
  const equipmentGroups = getStandardEquipment(payload.modelSlug || "")

  if (equipmentGroups.length > 0) {
    doc.addPage()
    addHeader(doc, logoBuffer, contacts)
    y = CONTENT_TOP

    doc.font("Bold").fontSize(14).fillColor("#111")
    doc.text(`${payload.modelName} wyposażenie standardowe:`, PAGE_LEFT, y, { width: PAGE_WIDTH })
    y += 28

    for (const group of equipmentGroups) {
      doc.font("Regular").fontSize(9)
      const firstItemHeight = group.items.length ? itemHeight(doc, group.items[0]) : 0
      ensureSpace(22 + firstItemHeight + ITEM_GAP)

      doc.font("Bold").fontSize(10).fillColor("#111")
      doc.text(group.title, PAGE_LEFT, y, { width: PAGE_WIDTH })
      y += 18

      doc.font("Regular").fontSize(9).fillColor("#111")

      for (const item of group.items) {
        const height = itemHeight(doc, item)
        ensureSpace(height + ITEM_GAP)
        drawChecklistItem(doc, item, y)
        y += height + ITEM_GAP
      }

      y += 12
    }
  }

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

async function sendEmails(payload, pdf, offerContacts) {
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

  const contacts = resolveContacts(payload.preparedBy, offerContacts)
  const signature =
    contacts.length === 1
      ? `${contacts[0].name}<br>Marinero.pl<br>${contacts[0].phone}`
      : `Zespół Marinero<br>Marinero.pl<br>${contacts.map((contact) => contact.phone).join(" · ")}`

  const subject = `Oferta ${payload.modelName} — Marinero`

  const html = `
    <p>Dzień dobry,</p>
    <p>w załączeniu przesyłamy ofertę modelu <strong>${payload.modelName}</strong>
    przygotowaną na podstawie konfiguratora Marinero.</p>
    <p>W razie pytań jesteśmy do dyspozycji.</p>
    <p>Z poważaniem<br>${signature}</p>
  `

  const attachment = {
    filename: pdf.filename,
    content: pdf.buffer,
    contentType: "application/pdf",
  }

  const bcc = Array.from(new Set([toAdmin, ...contacts.map((contact) => contact.email)]))

  await transporter.sendMail({
    from,
    to: payload.clientEmail || toAdmin,
    bcc,
    replyTo: contacts.map((contact) => contact.email).join(", "),
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

    const offerContacts = await loadOfferContacts()
    const pdf = await createOfferPdf(payload, offerContacts)
    const directusPdf = await uploadPdfToDirectus(pdf, payload)
    const emailStatus = await sendEmails(payload, pdf, offerContacts)
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
