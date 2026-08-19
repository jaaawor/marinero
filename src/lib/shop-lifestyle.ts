import { getBoatModelsPublic } from "@/lib/public-site-data"
import { getModelImage } from "@/lib/model-taxonomy"

export type LifestyleShot = { image: string; name: string }

/**
 * Kadry z życia do bloków redakcyjnych sklepu. Pakshoty na bieli nie zbudują
 * nastroju, a zdjęcia łodzi i tak są nasze — bierzemy je z galerii modeli.
 */
export async function getShopLifestyle(): Promise<LifestyleShot[]> {
  const boats = await getBoatModelsPublic()

  return (boats || [])
    .map((boat: any) => ({ image: getModelImage(boat), name: String(boat.name || "") }))
    .filter((shot: LifestyleShot) => Boolean(shot.image))
}

/**
 * Stały wybór kadru dla klucza (np. uchwytu kategorii) — ta sama kategoria
 * zawsze dostaje to samo zdjęcie, więc strona nie „mruga" przy przebudowie.
 */
export function pickLifestyle(shots: LifestyleShot[], key: string): LifestyleShot | null {
  if (!shots.length) return null

  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }

  return shots[hash % shots.length]
}
