// Jeden język wizualny sklepu — używany przez wszystkie strony sklepu,
// żeby katalog, kategorie, produkt i zamówienie wyglądały jak jeden serwis.
//
// Paleta: atramentowy granat (sekcje wyróżnione), piaskowa biel (tło),
// morski błękit (akcent, wspólny z resztą strony), czysta biel (karty).

export const INK = "#0E1A2B"
export const SAND = "#F4F1EC"
export const ACCENT = "#2E64A8"

export const shop = {
  // Sekcje. Sklep jest jasny — ciemny granat zostaje na akcenty
  // (cienki pasek na samej górze), nie na całe sekcje.
  // Zdjęcia produktów to pakshoty na bieli — całe płótno sklepu jest białe,
  // a strukturę trzymają cienkie linie, nie zmiana koloru tła.
  // Baza 17 px — sklepy, na których się wzorujemy, mają duży tekst
  // (pak-in.pl ma 18 px w `body`); 15 px wyglądało jak panel administracyjny.
  page: "min-h-screen bg-white text-[17px] text-[#0E1A2B]",
  container: "mx-auto max-w-[1500px] px-5 md:px-8",
  dark: "bg-[#0E1A2B] text-white",
  hairline: "border-[#0E1A2B]/10",

  // Typografia: nagłówki szeryfowe (redakcyjnie, jak leferment.pl),
  // tekst bezszeryfowy. Newsreader ma niski kontrast i dobrze znosi duże stopnie.
  display: "font-serif font-normal tracking-[-0.015em] leading-[1.06]",
  eyebrow:
    "text-[11px] font-bold uppercase tracking-[0.3em] text-[#0E1A2B]/40",
  eyebrowLight: "text-[11px] font-bold uppercase tracking-[0.3em] text-white/45",
  lead: "text-lg leading-[1.75] text-[#0E1A2B]/60 md:text-xl",

  // Przyciski
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-sm bg-[#0E1A2B] px-8 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#2E64A8]",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-sm border border-[#0E1A2B]/20 px-8 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B] transition hover:border-[#0E1A2B] hover:bg-[#0E1A2B] hover:text-white",
  btnLight:
    "inline-flex items-center justify-center gap-2 rounded-sm border border-white/25 px-8 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[#0E1A2B]",
  // Wypełniony przycisk na ciemnym tle — osobny wariant, bo nadpisywanie
  // koloru tekstu w `btnLight` gubi się w kolejności klas Tailwinda.
  btnOnDark:
    "inline-flex items-center justify-center gap-2 rounded-sm bg-white px-8 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B] transition hover:bg-[#2E64A8] hover:text-white",

  // Formularze
  input:
    "w-full rounded-sm border border-[#0E1A2B]/15 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#0E1A2B]",
  label: "mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/45",

  // Karty
  card: "rounded-sm border border-[#0E1A2B]/10 bg-white",
  link: "text-[13px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/50 transition hover:text-[#2E64A8]",

  // JEDEN układ dla wszystkiego, co jest listą (produkty, działy, marki).
  // Wzorzec: store.ferrari.com trzyma proporcje kadru w jednym tokenie
  // (`--product-media-aspect-ratio: 408 / 523`) i siatkę `repeat(4, 1fr)`,
  // dzięki czemu żaden kafelek nie odstaje wielkością od sąsiada.
  // Na telefonie DWIE kolumny, nie jedna — przy jednej na ekran wchodził
  // dokładnie jeden produkt. Kadr jest kwadratowy, bo pakshot na bieli i tak
  // nie wypełnia wysokiego prostokąta, a niższy kafelek mieści więcej rzędów.
  grid: "grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 2xl:grid-cols-5",
  /** Ta sama siatka tam, gdzie po lewej stoi szyna filtrów. */
  gridNarrow: "grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4",
  /** Kadr kafelka — jedne proporcje w całym sklepie. */
  tile: "relative flex aspect-square items-center justify-center overflow-hidden bg-white",
  /** Odstęp sekcji — żeby rytm strony był równy. */
  // 16/24 dawało przy czterech zajawkach marek ściany pustki —
  // 12/16 trzyma rytm, nie rozjeżdżając strony na kilkanaście ekranów.
  section: "py-12 md:py-16",
}
