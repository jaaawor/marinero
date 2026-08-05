import Header from "@/components/Header"
import Footer from "@/components/Footer"

export const revalidate = 60

export default function KontaktPage() {
  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <div className="mb-10 rounded-lg bg-white p-8 shadow-sm md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Kontakt
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Skontaktuj się z Marinero
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
            Napisz, jakiej łodzi, silnika lub części szukasz. Przygotujemy
            odpowiedź, ofertę albo pomożemy dobrać właściwe rozwiązanie.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sprzedaż łodzi i silników</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              Doradztwo przy wyborze łodzi, silnika, wyposażenia i konfiguracji.
            </p>
            <a
              className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
              href="mailto:info@marinero.pl"
            >
              info@marinero.pl
            </a>
          </div>

          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sklep internetowy</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              Części, akcesoria, elektronika i produkty dostępne online.
            </p>
            <a
              className="mt-5 inline-flex text-sm font-semibold text-[#2E64A8]"
              href="https://sklep.marinero.150197.pl"
            >
              Przejdź do sklepu →
            </a>
          </div>

          <div className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Formularz kontaktowy</h2>
            <p className="mt-3 text-sm leading-6 text-[#111827]/55">
              Formularz podłączymy w kolejnym etapie razem z powiadomieniami
              e-mail.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
