type CategoryIconProps = {
  handle: string
  className?: string
}

// Ikony działów sklepu. Wcześniej kafelek działu brał zdjęcie pierwszego
// produktu z kategorii — „Serwis" wyglądał wtedy jak filtr oleju, a „Części"
// jak przypadkowa śruba. Rysunek liniowy mówi, co jest w środku, i nie zmienia
// się przy każdym imporcie z Medusy.
//
// Klucz to uchwyt działu z `shop-taxonomy.ts`; nieznane dopasowujemy po nazwie.
const ICONS: Record<string, React.ReactNode> = {
  // Śruba napędowa — czytelniejsza niż sylwetka silnika w tej skali
  silniki: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <path
        d="M12 9.6c.2-2.7 1.2-4.6 3-5.4.9-.4 1.9.4 1.6 1.4-.5 1.9-2.1 3.4-4.6 4Z"
        transform="rotate(0 12 12)"
      />
      <path
        d="M12 9.6c.2-2.7 1.2-4.6 3-5.4.9-.4 1.9.4 1.6 1.4-.5 1.9-2.1 3.4-4.6 4Z"
        transform="rotate(120 12 12)"
      />
      <path
        d="M12 9.6c.2-2.7 1.2-4.6 3-5.4.9-.4 1.9.4 1.6 1.4-.5 1.9-2.1 3.4-4.6 4Z"
        transform="rotate(240 12 12)"
      />
    </>
  ),
  // Ploter — ekran ze śladem trasy i podstawą
  garmin: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.4" />
      <path d="M6.5 13.5c2.2-3.6 4.2-1.4 5.6-3.8 1-1.7 2.6-2.2 4.2-2.2" />
      <path d="M10 16.5v3.5M14 16.5v3.5M8 20.5h8" />
    </>
  ),
  // Części — koło zębate (pierścień + piasta + zęby; bez pierścienia
  // rysunek czytało się jak słońce)
  czesci: (
    <>
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="12" cy="12" r="1.5" />
      {/* Zęby dochodzą do pierścienia — z przerwą rysunek czytało się jak słońce */}
      <path d="M12 5.6v2.4M12 16v2.4M18.4 12H16M8 12H5.6M16.5 7.5l-1.7 1.7M9.2 14.8l-1.7 1.7M16.5 16.5l-1.7-1.7M9.2 9.2 7.5 7.5" />
    </>
  ),
  // Serwis — klucz nasadowy z wycięciem szczęki
  "czesci-serwisowe": (
    <>
      <path d="M17.4 4.2a5 5 0 0 0-6 7.8l-7.6 7.6 2.6 2.6L14 14.6a5 5 0 0 0 6.4-6.9l-2.8 2.8-2.4-.7-.7-2.4 2.9-3.2Z" />
    </>
  ),
  // Oleje — kanister z kroplą
  "oleje-suzuki": (
    <>
      <path d="M6.5 8.5h9v12h-9z" />
      <path d="M9 8.5v-3h4v3" />
      <path d="M15.5 11.5h3v5" />
      <path d="M12 12.6c-1 1.3-1.6 2.2-1.6 3a1.6 1.6 0 0 0 3.2 0c0-.8-.6-1.7-1.6-3Z" />
    </>
  ),
  // Akcesoria — koło ratunkowe
  akcesoria: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" />
    </>
  ),
  // Mapy morskie — złożona mapa
  mapy: (
    <>
      <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  // Elektryka i baterie
  elektryczne: (
    <>
      <path d="M4.5 8.5h11v7h-11z" />
      <path d="M15.5 11h2.5v2h-2.5z" />
      <path d="M7.5 6.5v2M12.5 6.5v2" />
    </>
  ),
}

/** Dopasowanie po nazwie, gdy uchwyt nie jest jednym z sześciu działów. */
function pickIcon(handle: string): React.ReactNode {
  if (ICONS[handle]) return ICONS[handle]

  const key = handle.toLowerCase()
  if (/mapy|navionics/.test(key)) return ICONS.mapy
  if (/silnik|zaburtow|trolingow/.test(key)) return ICONS.silniki
  if (/garmin|echomap|gps|striker|lowrance|fusion|elektronik/.test(key)) return ICONS.garmin
  if (/olej|chemia|ecstar|quicksilver|eksploatacyj/.test(key)) return ICONS["oleje-suzuki"]
  if (/serwis|filtr|swiec|uszczel|anod|pompy|maintenance|zestaw/.test(key)) {
    return ICONS["czesci-serwisowe"]
  }
  if (/akcesor|lodzie|promocj/.test(key)) return ICONS.akcesoria
  if (/elektrycz|akumulator|bateria/.test(key)) return ICONS.elektryczne

  return ICONS.czesci
}

export default function CategoryIcon({ handle, className }: CategoryIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {pickIcon(handle)}
    </svg>
  )
}
