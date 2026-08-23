"use client"

import { useState } from "react"
import { readJson } from "@/lib/admin-fetch"

const input =
  "w-full rounded-sm border border-[#111827]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
const button =
  "inline-flex items-center justify-center rounded-sm bg-[#2E64A8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28588F] disabled:opacity-40"

type AdminLoginProps = {
  /** Gdy podane, po zalogowaniu strona nie przeładowuje się, tylko oddaje sterowanie. */
  onLogin?: (name: string) => void
}

/**
 * Logowanie kontem z Directusa — wspólne dla wszystkich narzędzi w `/admin`.
 * Nie ma osobnych haseł „do panelu": kto ma konto w Directusie, ten pisze
 * do bazy swoim tokenem.
 */
export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body?.error || "Logowanie nieudane")

      setPassword("")
      const name = body?.user?.name || email

      if (onLogin) onLogin(name)
      else window.location.reload()
    } catch (problem: any) {
      setError(problem?.message || "Logowanie nieudane")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-md rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold">Zaloguj się</h2>
      <p className="mt-2 text-sm leading-6 text-[#111827]/55">
        Tym samym e-mailem i hasłem, co do panelu Directus.
      </p>

      <div className="mt-5 grid gap-3">
        <input
          className={input}
          type="email"
          autoComplete="username"
          placeholder="E-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className={input}
          type="password"
          autoComplete="current-password"
          placeholder="Hasło"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error ? <p className="mt-4 text-sm text-[#B42318]">{error}</p> : null}

      <button className={`${button} mt-5`} disabled={busy}>
        {busy ? "Sprawdzam…" : "Zaloguj"}
      </button>
    </form>
  )
}
