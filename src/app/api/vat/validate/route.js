// Weryfikacja numeru VAT UE w rejestrze VIES (Komisja Europejska).
// Sklep pyta o to przed zdjęciem VAT-u — bez potwierdzenia numeru
// zamówienie zostaje z polskim VAT-em.

export const runtime = "nodejs"

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"

export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return Response.json({ valid: false, error: "bad_request" }, { status: 400 })
  }

  const raw = String(payload?.vatId || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const countryCode = raw.slice(0, 2)
  const vatNumber = raw.slice(2)

  if (!/^[A-Z]{2}$/.test(countryCode) || vatNumber.length < 4) {
    return Response.json({ valid: false, error: "format" })
  }

  try {
    const response = await fetch(VIES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode, vatNumber }),
      cache: "no-store",
    })

    if (!response.ok) {
      return Response.json({ valid: false, error: "vies_unavailable" }, { status: 502 })
    }

    const data = await response.json()

    return Response.json({
      valid: Boolean(data?.valid),
      countryCode,
      vatNumber,
      name: data?.name && data.name !== "---" ? data.name : "",
      address: data?.address && data.address !== "---" ? data.address : "",
    })
  } catch {
    return Response.json({ valid: false, error: "vies_unavailable" }, { status: 502 })
  }
}
