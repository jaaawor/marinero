import Script from "next/script"

type AnalyticsProps = {
  /** Identyfikator GA4, np. `G-XXXXXXX`. */
  ga?: string
  /** Identyfikator Google Ads, np. `AW-123456789`. */
  ads?: string
}

// Google Analytics 4 i Google Ads na jednym `gtag.js` — obie usługi używają
// tego samego skryptu, więc ładujemy go raz i konfigurujemy dwa razy.
//
// Bez identyfikatorów komponent nie renderuje niczego: strona nie odpytuje
// Google i nie zapisuje żadnego ciasteczka. To celowe — kod może stać na
// produkcji, zanim konta w ogóle powstaną, a wyłączenie pomiaru to usunięcie
// zmiennej, nie wdrożenie.
//
// Identyfikatory czytamy w komponencie serwerowym ze zwykłych zmiennych
// (`GA_ID`, `GOOGLE_ADS_ID`) — `NEXT_PUBLIC_*` Next wstrzykuje w czasie
// builda, więc ich zmiana wymagałaby przebudowy, a nie restartu usługi.
export default function Analytics({ ga, ads }: AnalyticsProps) {
  const ids = [ga, ads].filter(Boolean) as string[]
  if (!ids.length) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`}
        strategy="afterInteractive"
      />

      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${ids.map((id) => `gtag('config', '${id}');`).join("\n          ")}
        `}
      </Script>
    </>
  )
}
