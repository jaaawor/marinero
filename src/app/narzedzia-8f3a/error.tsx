"use client"

/**
 * Ekran błędu panelu.
 *
 * Bez tego pliku Next pokazywał własną stronę awarii: sam numer `digest`
 * („ERROR 1105452560") i prośbę o odświeżenie — po angielsku i bez cienia
 * informacji, co się stało. Numer jest przydatny w logach serwera i dlatego
 * zostaje, ale schowany pod tekstem, a nie zamiast niego.
 *
 * Przycisk woła `reset()`, czyli ponawia render tej samej strony bez
 * przeładowania całej aplikacji — przy potknięciu sieci (Directus, Medusa,
 * Allegro) to zwykle wystarcza.
 */
export default function BladPanelu({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[640px] px-5 py-20">
        <div className="mb-8 flex items-center gap-2.5">
          <img src="/logo-marinero.png" alt="" className="h-7 w-auto object-contain" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#111827]/35">
            Panel
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Nie udało się otworzyć strony</h1>

        <p className="mt-3 text-sm leading-7 text-[#111827]/65">
          Najczęściej to chwilowe: panel pyta o dane Directusa, Medusę i Allegro, a każde
          z nich stoi na tym samym serwerze co reszta i bywa zajęte. Spróbuj jeszcze raz —
          zwykle za drugim razem wchodzi.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-[#2E64A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#28588F]"
          >
            Spróbuj ponownie
          </button>

          <a
            href="/narzedzia-8f3a"
            className="rounded-md border border-[#111827]/15 px-5 py-2 text-sm font-semibold text-[#111827]/70 transition hover:border-[#111827]/30 hover:text-[#111827]"
          >
            Wróć do spisu narzędzi
          </a>
        </div>

        <p className="mt-8 text-xs leading-6 text-[#111827]/40">
          Gdy powtarza się za każdym razem, warto zajrzeć na serwer:{" "}
          <code className="rounded bg-[#111827]/5 px-1 py-0.5">docker ps</code>,{" "}
          <code className="rounded bg-[#111827]/5 px-1 py-0.5">free -h</code> i{" "}
          <code className="rounded bg-[#111827]/5 px-1 py-0.5">
            journalctl -u marinero-frontend -n 100
          </code>
          .{error?.digest ? ` Numer w logach: ${error.digest}.` : ""}
        </p>
      </div>
    </main>
  )
}
