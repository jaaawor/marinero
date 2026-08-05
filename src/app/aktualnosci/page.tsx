import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { newsItems } from "@/lib/marinero-content"

export const revalidate = 60

export default function AktualnosciPage() {
  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <div className="mb-10 rounded-lg bg-white p-8 shadow-sm md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Aktualności
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Co nowego w Marinero
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]/60 md:text-lg md:leading-8">
            Informacje o ofercie, sklepie, markach, modelach i rozwoju strony.
            Docelowo aktualności będą zarządzane z Directusa.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {newsItems.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#2E64A8]">
                {item.date}
              </p>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#111827]/55">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}
