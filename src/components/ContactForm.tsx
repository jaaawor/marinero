"use client"

import { useState } from "react"

import { getDictionary, type Locale } from "@/lib/i18n"

const field =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#2E64A8]"
const label = "block text-sm font-medium text-[#111827]/70"

export default function ContactForm({ locale }: { locale?: Locale }) {
  const t = getDictionary(locale)
  // Zakresy serwisu — te same nazwy, którymi posługuje się warsztat, żeby
  // zgłoszenie dało się od razu wycenić bez telefonu zwrotnego.
  const serviceTypes = t.contactServiceTypes

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
      if (!response.ok) throw new Error(body?.error || t.contactSendError)
      setDone(true)
    } catch (problem: any) {
      setError(problem?.message || t.contactSendError)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">{t.contactDoneTitle}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#111827]/60">
          {kind === "serwis"
            ? t.contactDoneService
            : t.contactDoneQuestion}
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
        {t.contactFormEyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {t.contactFormTitle}
      </h2>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["pytanie", t.contactTabQuestion],
            ["serwis", t.contactTabService],
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
            {t.contactFieldName}
          </label>
          <input id="k-name" name="name" className={`${field} mt-1.5`} required maxLength={120} />
        </div>

        <div>
          <label className={label} htmlFor="k-phone">
            {t.contactFieldPhone}
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
            {t.contactFieldEmail}
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
            {kind === "serwis" ? t.contactFieldBoat : t.contactFieldTopic}
          </label>
          <input id="k-boat" name="boat" className={`${field} mt-1.5`} maxLength={160} />
        </div>

        {kind === "serwis" ? (
          <>
            <div>
              <label className={label} htmlFor="k-service">
                {t.contactFieldScope}
              </label>
              <select id="k-service" name="serviceType" className={`${field} mt-1.5`}>
                {serviceTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label} htmlFor="k-date">
                {t.contactFieldDate}
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
            {t.contactFieldMessage}
          </label>
          <textarea
            id="k-message"
            name="message"
            rows={5}
            className={`${field} mt-1.5 resize-y`}
            maxLength={4000}
            placeholder={
              kind === "serwis"
                ? t.contactPlaceholderService
                : t.contactPlaceholderQuestion
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
          {busy ? t.contactSubmitting : kind === "serwis" ? t.contactSubmitService : t.contactSubmitQuestion}
        </button>

        <p className="text-xs leading-5 text-[#111827]/40">
          {t.contactPrivacyNote}
        </p>
      </div>
    </form>
  )
}
