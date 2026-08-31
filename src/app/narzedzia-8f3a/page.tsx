import Link from "next/link"
import PanelShell from "@/components/admin/PanelShell"

// Spis narzędzi wewnętrznych. Bez niego trzeba było pamiętać adresy
// poszczególnych stron — nigdzie w serwisie nie ma do nich odnośnika
// i nie powinno być.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Narzędzia",
  robots: { index: false, follow: false },
}

const NARZEDZIA = [
  {
    href: "/narzedzia-8f3a/zamowienia",
    title: "Zamówienia ze sklepu",
    lead:
      "Zamówienia z marinero.pl: płatność (także PayU), stan obsługi, numer " +
      "przesyłki, uwagi i ponowna wysyłka potwierdzenia dla klienta.",
  },
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
      "Które strony ludzie otwierają, czego szukają — z frazami bez wyników — " +
      "które konfiguratory porzucają i co mają teraz w koszykach.",
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

export default async function AdminHome() {
  return (
    <PanelShell
      tytul="Narzędzia wewnętrzne"
      szeroko={false}
      lead={
        <p>
          Wszystko do obsługi sklepu i katalogu łodzi. Po narzędziach chodzi się
          paskiem u góry — te kafelki są po to, żeby zobaczyć, co która strona robi.
        </p>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
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
    </PanelShell>
  )
}
