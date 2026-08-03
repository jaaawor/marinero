// Fallbackowe galerie ze starej strony marinero.pl — używane tylko wtedy,
// gdy model nie ma zdjęć w Directusie (hero_image / boat_model_images).
// Każdy slug może zawierać WYŁĄCZNIE zdjęcia tego konkretnego modelu.

export const GENERATED_GALLERIES: Record<string, string[]> = {
  "aquila-28-molokai": [
    "https://marinero.pl/wp-content/uploads/2025/07/DJI_0300-2-scaled.jpg"
  ],
  "aquila-32-sport": [
    "https://marinero.pl/wp-content/uploads/2025/08/Aquila32S-scaled.jpg"
  ],
  "aquila-42-coupe": [
    "https://marinero.pl/wp-content/uploads/2025/08/Aquila42C-scaled.jpg"
  ],
  "aquila-50-yacht": [
    "https://marinero.pl/wp-content/uploads/2025/08/Aquila50Y-scaled.jpg"
  ],
  "jeanneau-cap-camarat-75-cc": [
    "https://marinero.pl/wp-content/uploads/2024/10/6-2.jpg"
  ],
  "jeanneau-cap-camarat-90-wa": [
    "https://marinero.pl/wp-content/uploads/2024/03/3-1-jpg.webp"
  ],
  "jeanneau-merry-fisher-795": [
    "https://marinero.pl/wp-content/uploads/2023/07/795-10.jpg"
  ],
  "jeanneau-merry-fisher-895": [
    "https://marinero.pl/wp-content/uploads/2024/10/mf895s2.jpg"
  ],
  "sting-485-s": [
    "https://marinero.pl/wp-content/uploads/2025/08/Sting-485-S-6.jpg"
  ],
  "xo-dfndr-8": [
    "https://marinero.pl/wp-content/uploads/2023/12/dfndr-8-3.jpg",
    "https://marinero.pl/wp-content/uploads/2023/12/dfndr-8-1.jpg"
  ],
  "xo-dfndr-9": [
    "https://marinero.pl/wp-content/uploads/2023/12/dfndr-9-3.jpg"
  ],
  "xo-dscvr-9": [
    "https://marinero.pl/wp-content/uploads/2024/09/xo-dscvr-9-t-top.jpg",
    "https://marinero.pl/wp-content/uploads/2023/12/dscvr-9-2.jpg"
  ],
  "xo-explr-10": [
    "https://marinero.pl/wp-content/uploads/2024/09/xo-explr-10S-IB.jpg",
    "https://marinero.pl/wp-content/uploads/2024/09/xo-explr-10S-1.jpg"
  ]
}
