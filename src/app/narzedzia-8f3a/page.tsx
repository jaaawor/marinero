import Link from "next/link"

// Spis narzędzi wewnętrznych. Bez niego trzeba było pamiętać adresy
// poszczególnych stron — nigdzie w serwisie nie ma do nich odnośnika
// i nie powinno być.
export const metadata = {
  title: "Narzędzia",
  robots: { index: false, follow: false },
}

const NARZEDZIA = [
  {
    href: "/narzedzia-8f3a/cenniki",
    title: "Cenniki",
    lead:
      "Cennik od producenta — zbiorczy dla marki albo osobny dla jednej łodzi. " +
      "Dopasowanie, podgląd zmian, zapis dopiero po zatwierdzeniu.",
  },
  {
    href: "/narzedzia-8f3a/wyposazenie",
    title: "Wyposażenie łodzi",
    lead:
      "Cała lista wyposażenia wklejona jednym wpisem — standardowego albo " +
      "dodatkowego z cenami. Rozbijam ją na grupy i pozycje.",
  },
  {
    href: "/narzedzia-8f3a/opisy",
    title: "Opisy produktów",
    lead: "Opisy w sklepie: obecny tekst obok propozycji, publikacja albo szkic.",
  },
  {
    href: "/narzedzia-8f3a/statystyki",
    title: "Statystyki",
    lead:
      "Czego ludzie szukają na stronie i w sklepie — z frazami bez wyników — " +
      "oraz co mają teraz w koszykach.",
  },
  {
    href: "/narzedzia-8f3a/kanaly",
    title: "Ceny na Allegro",
    lead:
      "Ceny z Allegro obok cen ze sklepu i obok wyliczonych z reguł. " +
      "Podgląd — nic nie wysyła.",
  },
  {
    href: "/narzedzia-8f3a/zamowienia-allegro",
    title: "Zamówienia z Allegro",
    lead:
      "Przyjęcie do realizacji, numer przesyłki i oznaczenie jako wysłane — " +
      "bez przełączania się na portal.",
  },
]

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1200px] px-5 py-12 md:px-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
          Marinero
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Narzędzia wewnętrzne
        </h1>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {NARZEDZIA.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm transition hover:border-[#2E64A8]/40"
            >
              <h2 className="text-xl font-semibold">{n.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#111827]/55">{n.lead}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
