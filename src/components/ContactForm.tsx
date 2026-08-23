"use client"

import { useState } from "react"

// Zakresy serwisu — te same nazwy, którymi posługuje się warsztat, żeby
// zgłoszenie dało się od razu wycenić bez telefonu zwrotnego.
const SERVICE_TYPES = [
  "Przegląd okresowy silnika",
  "Przygotowanie do sezonu",
  "Zimowanie silnika i łodzi",
  "Naprawa — silnik nie pracuje prawidłowo",
  "Montaż elektroniki lub wyposażenia",
  "Inne — opiszę poniżej",
]

const field =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#2E64A8]"
const label = "block text-sm font-medium text-[#111827]/70"

export default function ContactForm() {
  const [kind, setKind] = useState<"pytanie" | "serwis">("pytanie")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")

    const data = new FormData(event.currentTarget)
    const payload = {
      kind,
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      phone: String(data.get("phone") || ""),
      boat: String(data.get("boat") || ""),
      serviceType: String(data.get("serviceType") || ""),
      preferredDate: String(data.get("preferredDate") || ""),
      message: String(data.get("message") || ""),
      website: String(data.get("website") || ""),
    }

    try {
      const response = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Nie udało się wysłać")
      setDone(true)
    } catch (problem: any) {
      setError(problem?.message || "Nie udało się wysłać zgłoszenia")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Zgłoszenie przyjęte</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#111827]/60">
          {kind === "serwis"
            ? "Odezwiemy się z potwierdzeniem terminu. Jeśli sprawa jest pilna, zadzwoń — numery są wyżej."
            : "Odpowiemy najszybciej, jak się da. Jeśli sprawa jest pilna, zadzwoń — numery są wyżej."}
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
        Napisz do nas
      </p>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Zadaj pytanie albo umów serwis
      </h2>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["pytanie", "Mam pytanie"],
            ["serwis", "Umawiam serwis okresowy"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            aria-pressed={kind === value}
            className={`rounded-sm border px-4 py-2.5 text-sm transition ${
              kind === value
                ? "border-[#2E64A8] bg-[#2E64A8] text-white"
                : "border-[#111827]/15 text-[#111827]/65 hover:border-[#111827]/40"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="k-name">
            Imię i nazwisko
          </label>
          <input id="k-name" name="name" className={`${field} mt-1.5`} required maxLength={120} />
        </div>

        <div>
          <label className={label} htmlFor="k-phone">
            Telefon
          </label>
          <input
            id="k-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className={`${field} mt-1.5`}
            maxLength={40}
          />
        </div>

        <div>
          <label className={label} htmlFor="k-email">
            E-mail
          </label>
          <input
            id="k-email"
            name="email"
            type="email"
            className={`${field} mt-1.5`}
            maxLength={160}
          />
        </div>

        <div>
          <label className={label} htmlFor="k-boat">
            {kind === "serwis" ? "Łódź i silnik (marka, model, rocznik)" : "Czego dotyczy pytanie"}
          </label>
          <input id="k-boat" name="boat" className={`${field} mt-1.5`} maxLength={160} />
        </div>

        {kind === "serwis" ? (
          <>
            <div>
              <label className={label} htmlFor="k-service">
                Zakres
              </label>
              <select id="k-service" name="serviceType" className={`${field} mt-1.5`}>
                {SERVICE_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label} htmlFor="k-date">
                Preferowany termin
              </label>
              <input
                id="k-date"
                name="preferredDate"
                type="date"
                className={`${field} mt-1.5`}
              />
            </div>
          </>
        ) : null}

        <div className="md:col-span-2">
          <label className={label} htmlFor="k-message">
            Wiadomość
          </label>
          <textarea
            id="k-message"
            name="message"
            rows={5}
            className={`${field} mt-1.5 resize-y`}
            maxLength={4000}
            placeholder={
              kind === "serwis"
                ? "Np. Suzuki DF150 z 2019, przegląd po sezonie, łódź stoi w Marina Yacht Park."
                : "Napisz, w czym możemy pomóc."
            }
          />
        </div>
      </div>

      {/* Pułapka na boty — ukryta przed człowiekiem i przed czytnikiem ekranu. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {error ? <p className="mt-5 text-sm text-[#B42318]">{error}</p> : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          className="inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"
          disabled={busy}
        >
          {busy ? "Wysyłam…" : kind === "serwis" ? "Umów serwis" : "Wyślij pytanie"}
        </button>

        <p className="text-xs leading-5 text-[#111827]/40">
          Dane wykorzystamy tylko do odpowiedzi na to zgłoszenie.
        </p>
      </div>
    </form>
  )
}
