import { revalidatePath } from "next/cache"
import { LOCALES } from "@/lib/i18n"

/**
 * Odświeżenie stron sklepu po zapisie z panelu.
 *
 * Kusi, żeby napisać `revalidatePath("/sklep", "layout")` i mieć spokój — ale
 * to unieważnia **całe poddrzewo**: 387 produktów razy osiem języków to ponad
 * trzy tysiące stron. Każde następne wejście (także bota) regeneruje jedną
 * z nich i pyta Medusę, więc po jednym zapisie ceny serwer dostaje lawinę
 * pracy: procesor pod sufitem, pamięć w górę i 504 na części żądań.
 *
 * Dlatego odświeżamy **tylko to, co się zmieniło**: strony zmienionych
 * produktów we wszystkich językach (osiem adresów na produkt, nie trzy
 * tysiące) i dwie listy w wersji polskiej. Listy w pozostałych językach
 * dojdą do siebie same przy najbliższym odświeżeniu ISR — czyli tak, jak
 * działało to przed dołożeniem tego mechanizmu.
 */
export function odswiezSklep(handles: string[]) {
  const unikalne = Array.from(new Set(handles.filter(Boolean)))

  try {
    for (const handle of unikalne) {
      for (const jezyk of LOCALES) {
        const prefiks = jezyk === "pl" ? "" : `/${jezyk}`
        revalidatePath(`${prefiks}/sklep/produkt/${handle}`)
      }
    }

    // Listy pokazują ceny, więc też muszą się odświeżyć — ale tylko polskie,
    // bo to one niosą ruch, a każdy dołożony adres to kolejna regeneracja.
    revalidatePath("/sklep/produkty")
    revalidatePath("/sklep")
  } catch {
    // Odświeżenie to wygoda, nie warunek zapisu — cena jest już w Medusie.
  }
}
