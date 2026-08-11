import { IMPORTED_EQUIPMENT } from "@/lib/generated-equipment"

export type StandardEquipmentGroup = {
  title: string
  items: string[]
}

export const STANDARD_EQUIPMENT_DATA: Record<string, StandardEquipmentGroup[]> = {
  "aquila-42-coupe": [
    {
      title: "Cechy",
      items: [
        "System Aquila Hydro Glide™ z włókna węglowego zwiększający efektywność paliwową, komfort i osiągi",
        "Układ jednopoziomowy łączący przestrzeń wewnętrzną i zewnętrzną",
        "Przestronne kabiny z oknami burtowymi",
        "Cyfrowy system sterowania C-Zone dla komponentów zasilanych prądem stałym",
        "Możliwość wyboru napędu Mercury lub Volvo Penta",
        "Boczne drzwi kokpitu na lewej i prawej burcie",
      ],
    },
    {
      title: "Konstrukcja",
      items: [
        "Kadłub i pokład wykonane w technologii infuzji z żywicą winyloestrową",
        "Elementy wzmacniające wykonane w tej samej technologii",
        "Rdzeń PVC o zróżnicowanej gęstości",
        "Żelkot NPG na kadłubie",
        "Wodoszczelne grodzie dziobowe i rufowe",
        "Główna płetwa nośna z włókna węglowego",
      ],
    },
    {
      title: "Układ wnętrza",
      items: [
        "Duże kabiny w każdym kadłubie",
        "Kabina armatorska w lewym kadłubie i kabina VIP w prawym",
        "Każda kabina z prysznicem, toaletką i toaletą",
        "Salon z kanapą w kształcie L i stołem konwertowanym w łóżko",
        "Duże okna z hartowanego szkła zapewniające widok 360°",
        "Aneks kuchenny z kuchenką mikrofalową, zlewem i szafkami",
        "Elektrycznie otwierany centralny luk/drzwi z włókna węglowego do strefy dziobowej",
      ],
    },
    {
      title: "Kadłub i pokład",
      items: [
        "Podwójny stopień w kadłubie",
        "System półunoszący Aquila Hydro Glide z włókna węglowego",
        "Osłonięta strefa dziobowa dla maks. 4 osób",
        "Rufowa leżanka słoneczna z możliwością konwersji",
        "Relingi i uchwyty ze stali nierdzewnej AISI316",
        "Otwierane okna burtowe w kadłubie",
        "Listwa odbojowa PVC ze wstawką ze stali 316",
        "Oświetlenie nawigacyjne LED",
        "Składana drabinka kąpielowa ze stali nierdzewnej",
        "Samoodpływowy kokpit rufowy i dziobowy",
      ],
    },
    {
      title: "Pokład rufowy i kokpit",
      items: [
        "Przesuwne drzwi wielopanelowe zamykane od wewnątrz i z zewnątrz",
        "Leżanka z regulowanym oparciem i schowkiem",
        "Siedzenie skierowane do przodu po lewej stronie",
        "Rufowy schowek z koszem i opcją lodówki",
        "Uchylne pokrywy silników z włókna szklanego",
        "Wodoodporne głośniki Fusion 7.7”",
        "Bramki wejściowe na pokład boczny",
        "Oświetlenie LED kokpitu i sufitowe",
        "Prysznic rufowy z ciepłą i zimną wodą",
      ],
    },
    {
      title: "Cumowanie",
      items: [
        "Elektryczna winda kotwiczna 12V 1000W z przewodowym sterowaniem",
        "Polerowana kotwica ze stali nierdzewnej 35 lbs",
        "Lina 200 ft i łańcuch 30 ft",
        "Zestaw cumowniczy – 6 odbijaczy i 6 cum",
      ],
    },
    {
      title: "Dziobowy pokład słoneczny",
      items: [
        "Centralne elektryczne drzwi/luk z włókna węglowego do strefy dziobowej",
        "Leżanki dziobowe z zagłówkami i uchylnymi podłokietnikami",
        "8 uchwytów na napoje",
        "Ukryte schowki boczne na telefon i napoje",
        "Zintegrowane oświetlenie LED",
      ],
    },
  ],
}

export function getStandardEquipment(slug: string): StandardEquipmentGroup[] {
  return STANDARD_EQUIPMENT_DATA[slug] || IMPORTED_EQUIPMENT[slug] || []
}
