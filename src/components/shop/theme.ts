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
  page: "min-h-screen bg-[#F4F1EC] text-[#0E1A2B]",
  container: "mx-auto max-w-[1500px] px-5 md:px-8",
  dark: "bg-[#0E1A2B] text-white",
  hairline: "border-[#0E1A2B]/10",

  // Typografia
  display: "font-semibold tracking-[-0.045em] leading-[1.02]",
  eyebrow:
    "text-[11px] font-bold uppercase tracking-[0.3em] text-[#0E1A2B]/40",
  eyebrowLight: "text-[11px] font-bold uppercase tracking-[0.3em] text-white/45",
  lead: "text-lg leading-8 text-[#0E1A2B]/60",

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
}
