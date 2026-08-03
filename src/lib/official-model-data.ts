// Official manufacturer model data used as enriched content.
// Sources are manufacturer pages/spec sheets and Aquila SmugMug galleries.

export type OfficialModelData = {
  sourceUrl: string
  gallerySourceUrl?: string
  specSheetUrl?: string
  description?: string
  gallery?: string[]
  specs?: {
    label: string
    value: string
  }[]
  standardEquipmentNote?: string
}

export const OFFICIAL_MODEL_DATA: Record<string, OfficialModelData> = {
  "aquila-42-coupe": {
    "sourceUrl": "https://www.aquilaboats.com/models/coupes/42",
    "specSheetUrl": "https://www.aquilaboats.com/hubfs/42%20Coupe/AQU_SpecSheet_2024_42-Coupe-multipage-1.pdf",
    "description": "Aquila 42 Coupe to nowoczesny katamaran motorowy typu coupe, który łączy przestrzeń pokładu dziennego z komfortem jachtowym. Szeroki kadłub zapewnia dużo miejsca do wypoczynku i spotkań, a układ single-level ułatwia poruszanie się po pokładzie. Model wyróżnia się dynamiczną sylwetką, dwiema prywatnymi kabinami z łazienkami oraz rozwiązaniami poprawiającymi stabilność i osiągi.",
    "gallery": [
      "https://photos.smugmug.com/COUPE/42-Coupe/A42C-Hero/i-v45QFkW/0/LPjft3gvNrMtFx6DMHzpWVnLkRtLbNHg8KbNfGhkk/X5/42C-Exterior-Running-A75I5222-X5.jpg",
      "https://photos.smugmug.com/COUPE/42-Coupe/A42C-Hero/i-pJcZ85K/0/LzqK6xkPzKQFmjMMmCmzZGPsTjKVqpgcd9spm9Zhg/M/42C-Aft-Cockpit-DJI_20250907100149_0045_D-M.jpg",
      "https://photos.smugmug.com/COUPE/42-Coupe/A42C-Hero/i-Mm64Sfj/0/L9kPNCbrRMwPGcQt9qpPKRbQFZ9ZGtqJtNZmKmm95/M/42C-Bow-DSC00699-M.jpg",
      "https://photos.smugmug.com/COUPE/42-Coupe/A42C-Hero/i-RPDXsgf/0/KGHvFhBWhHSdwZ7F8nV3MgKjbGP9H5sfP23DQnHGG/M/42C-Cabin-DSC00687-M.jpg",
      "https://photos.smugmug.com/COUPE/42-Coupe/A42C-Hero/i-MWJ7wKF/0/NDWXNCvmH6C5J9VfF22ZTPFLD3ZMMjNhS73DB9LK9/M/42C-Exterior-Idle-42Offboard_22-M.jpg",
      "https://photos.smugmug.com/COUPE/42-Coupe/A42C-Hero/i-CNvZ2qd/0/Kt29g94G89NzwjZ74T9FQK6rH4RKBMLWTNGgjq9rF/XL/42C-Exterior-Idle-A75I9931-XL.jpg"
    ],
    "specs": [
      {
        "label": "Długość całkowita z silnikami zaburtowymi",
        "value": "13,06 m / 42'10\""
      },
      {
        "label": "Długość całkowita z silnikami stacjonarnymi",
        "value": "12,88 m / 42'3\""
      },
      {
        "label": "Szerokość całkowita",
        "value": "4,85 m / 15'11\""
      },
      {
        "label": "Wysokość nad linią wody z hardtopem",
        "value": "3,13 m / 10'3\""
      },
      {
        "label": "Zanurzenie — silniki zaburtowe podniesione z foilem",
        "value": "0,88 m / 2'10\""
      },
      {
        "label": "Zanurzenie — silniki zaburtowe opuszczone",
        "value": "0,90 m / 2'11\""
      },
      {
        "label": "Zanurzenie — silniki stacjonarne opuszczone",
        "value": "0,98 m / 3'3\""
      },
      {
        "label": "Masa sucha",
        "value": "8 500 kg / 18 740 lb"
      },
      {
        "label": "Zbiornik paliwa",
        "value": "1 552 l / 410 gal"
      },
      {
        "label": "Certyfikacja CE",
        "value": "B:12 / C:20 / D:29"
      }
    ],
    "standardEquipmentNote": "Wyposażenie standardowe pobierzemy w kolejnym kroku ze spec sheetu PDF i przeniesiemy do osobnej sekcji / konfiguratora.",
    "gallerySourceUrl": "https://aquila.smugmug.com/COUPE/42-Coupe/A42C-Hero"
  }
}

export function getOfficialModelData(slug: string) {
  return OFFICIAL_MODEL_DATA[slug] || null
}
