import "../globals.css"

// `/admin` stoi poza grupami tras `(pl)` i `(intl)`, więc nie dziedziczy
// ich layoutów — bez tego pliku narzędzia wewnętrzne renderowały się
// zupełnie bez stylów. Celowo nie ma tu nagłówka serwisu, analityki ani
// czatu: to nie jest strona dla klientów.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}
