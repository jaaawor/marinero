export type ConfiguratorOption = {
  id: string
  name: string
  price: number
  selected?: boolean
}

export type ConfiguratorGroup = {
  id: string
  title: string
  type: "checkbox" | "radio"
  options: ConfiguratorOption[]
}

export type BoatConfiguratorData = {
  currency: "USD" | "EUR" | "PLN"
  vatRate: number
  defaultUsdToPln: number
  basePrice: number
  basePackageName: string
  groups: ConfiguratorGroup[]
}

// Aquila wycenia w USD, pozostałe marki w EUR.
export function getCurrencyForBrand(brandName?: string | null): "USD" | "EUR" {
  return /aquila/i.test(String(brandName || "")) ? "USD" : "EUR"
}

export const DEFAULT_PLN_RATES: Record<string, number> = {
  USD: 3.75,
  EUR: 4.3,
  PLN: 1,
}

export const CONFIGURATOR_DATA: Record<string, BoatConfiguratorData> = {
  "aquila-42-coupe": {
    currency: "USD",
    vatRate: 0.23,
    defaultUsdToPln: 3.75,
    basePrice: 885000,
    basePackageName:
      "W cenie bazowej: 2 kabiny, 2 łazienki, 2 × Mercury Verado V10 400 KM, joystick, autopilot, Skyhook, Active Trim, SmartCraft Connect, Aquila Hydro Glide z włókna węglowego, winda kotwiczna, lina, łańcuch, kotwica nierdzewna, drabinka kąpielowa, stojak transportowy i folia termokurczliwa.",
    groups: [
      {
        id: "41",
        title: "Silnik spalinowy",
        type: "checkbox",
        options: [
          {
            id: "41-1",
            name: "2× silniki diesla Volvo Penta D6-440 KM DPI sterndrive",
            price: 156408,
          },
        ],
      },
      {
        id: "28",
        title: "Sterowanie",
        type: "checkbox",
        options: [
          {
            id: "28-1",
            name: "Pojedynczy ster strumieniowy dziobowy z płynną regulacją i integracją Mercury JPO",
            price: 15000,
          },
          {
            id: "28-2",
            name: "Pojedynczy ster strumieniowy dziobowy z płynną regulacją bez integracji z systemem Volvo Joystick",
            price: 13550,
          },
        ],
      },
      {
        id: "26",
        title: "Wykończenie wnętrza",
        type: "radio",
        options: [
          {
            id: "26-28",
            name: "Ciemny orzech z tapicerowanymi akcentami ścian i sufitu",
            price: 0,
          },
          {
            id: "26-29",
            name: "Jasna wiśnia Bianco z tapicerowanymi akcentami ścian i sufitu",
            price: 0,
          },
        ],
      },
      {
        id: "25",
        title: "Kolor tapicerki zewnętrznej",
        type: "radio",
        options: [
          {
            id: "25-24",
            name: "Quartz — standard, kwarcowy",
            price: 0,
          },
          {
            id: "25-25",
            name: "Storm Grey Diamond Stitched — burzowa szarość z przeszyciami w romby",
            price: 3780,
          },
          {
            id: "25-26",
            name: "Surf Mocha Diamond Stitched — brąz Surf Mocha z przeszyciami w romby",
            price: 3780,
          },
        ],
      },
      {
        id: "30",
        title: "Kokpit",
        type: "checkbox",
        options: [
          {
            id: "30-1",
            name: "Lodówka/zamrażarka 85 l ze stali nierdzewnej w rufowej baku na prawej burcie",
            price: 3337,
          },
          {
            id: "30-2",
            name: "2 × rozkładane leżanki słoneczne zamiast rufowego siedziska i modułu",
            price: 1890,
          },
          {
            id: "30-3",
            name: "Kenyon Electric BBQ — 2 × pojedyncze palniki z niezależnym sterowaniem",
            price: 4257,
          },
          {
            id: "30-5",
            name: "Lodówka/zamrażarka 49 l ze stali nierdzewnej pod strefą BBQ",
            price: 3148,
          },
          {
            id: "30-7",
            name: "Kostkarka do lodu pod strefą BBQ",
            price: 3637,
          },
        ],
      },
      {
        id: "31",
        title: "Salon",
        type: "checkbox",
        options: [
          {
            id: "31-1",
            name: "Elektryczny, regulowany stół w salonie, obniżany lub konwertowany na miejsce do spania",
            price: 1675,
          },
          {
            id: "31-2",
            name: "Opuszczany telewizor z sufitu do 40 cali z gniazdami zasilania, bez TV",
            price: 1100,
          },
          {
            id: "31-3",
            name: "Elektryczna dwupalnikowa płyta indukcyjna w aneksie kuchennym",
            price: 1466,
          },
        ],
      },
      {
        id: "32",
        title: "Pokrowce i zadaszenie",
        type: "checkbox",
        options: [
          {
            id: "32-1",
            name: "Elektrycznie rozsuwany dach z włókna szklanego nad konsolą / salonem",
            price: 31500,
          },
          {
            id: "32-2",
            name: "Pokrowiec na poduszki dziobowe — czarny",
            price: 2300,
          },
          {
            id: "32-3",
            name: "Ręczny, zdejmowany system przeciwsłoneczny dla dziobowej strefy wypoczynkowej — czarny",
            price: 3100,
          },
          {
            id: "32-5",
            name: "Elektrycznie rozsuwany system przeciwsłoneczny w tylnej części hardtopu",
            price: 20700,
          },
        ],
      },
      {
        id: "33",
        title: "Komfort",
        type: "checkbox",
        options: [
          {
            id: "33-1",
            name: "Klimatyzacja dla obu kabin oraz salonu / konsoli / aneksu kuchennego, 45 000 BTU",
            price: 19665,
          },
          {
            id: "33-5",
            name: "Pokład syntetyczny jasnoszary z białymi fugami — kokpit rufowy i dziobowa strefa wypoczynkowa",
            price: 18630,
          },
          {
            id: "33-2",
            name: "Pokład syntetyczny jasnoszary z białymi fugami — kokpit, wnętrze salonu i dziób",
            price: 29200,
          },
          {
            id: "33-3",
            name: "Pokład syntetyczny teakowy z białymi fugami — kokpit, wnętrze salonu i dziób",
            price: 29200,
          },
        ],
      },
      {
        id: "34",
        title: "Wyposażenie pokładowe",
        type: "checkbox",
        options: [
          {
            id: "34-1",
            name: "Dźwig do pontonu z ręcznym systemem bloczkowym, maks. ładowność 79 kg na każde ramię",
            price: 3679,
          },
          {
            id: "34-2",
            name: "Zdalne sterowanie wciągarką kotwiczną",
            price: 666,
          },
        ],
      },
      {
        id: "35",
        title: "Elektryka",
        type: "checkbox",
        options: [
          {
            id: "35-1",
            name: "Generator Kohler diesel 9 kW 60 Hz z obudową dźwiękochłonną i sterowaniem zdalnym",
            price: 36900,
          },
          {
            id: "35-2",
            name: "Generator Kohler diesel 10 kW 50 Hz z obudową dźwiękochłonną i sterowaniem zdalnym",
            price: 42590,
          },
          {
            id: "35-3",
            name: "Upgrade akumulatorów AGM na 2 × Mastervolt Lithium 230Ah 12V monitorowane przez C-Zone",
            price: 10772,
          },
        ],
      },
      {
        id: "36",
        title: "Oświetlenie",
        type: "checkbox",
        options: [
          {
            id: "36-1",
            name: "Reflektor zdalnie sterowany z konsoli",
            price: 3800,
          },
          {
            id: "36-2",
            name: "Podwodne oświetlenie LED wielokolorowe — 4 × OceanLED Sport DMX + 2 × OceanLED E3",
            price: 14600,
          },
        ],
      },
      {
        id: "37",
        title: "Instalacja wodna",
        type: "checkbox",
        options: [
          {
            id: "37-1",
            name: "Pompa wody słodkiej do mycia pokładu dziobowego",
            price: 778,
          },
          {
            id: "37-2",
            name: "Automatyczny system płukania słodką wodą — tylko dla silników zaburtowych",
            price: 3200,
          },
        ],
      },
      {
        id: "1",
        title: "Elektronika",
        type: "checkbox",
        options: [
          {
            id: "1-992",
            name: "Pakiet nawigacyjny Silver: Raymarine Axiom 2 XL 19\", B164-20, Ray90 VHF, głośnik i antena",
            price: 23800,
          },
          {
            id: "1-991",
            name: "Pakiet nawigacyjny Platinum: 2 × Raymarine Axiom 2 XL 19\", B175M, Ray90 VHF, radar Quantum 2 Q24D",
            price: 45900,
          },
          {
            id: "1-997",
            name: "Raymarine Sirius/XM SR200 Infolink — pogoda i radio satelitarne",
            price: 1161,
          },
          {
            id: "1-996",
            name: "Raymarine AIS 700 ze sprzęgaczem antenowym",
            price: 2008,
          },
          {
            id: "1-993",
            name: "Kamera CAM300 Eyeball CCTV dzień/noc IP",
            price: 1722,
          },
          {
            id: "1-994",
            name: "Kamera termowizyjna FLIR M232 z funkcją obrotu i pochyłu",
            price: 6940,
          },
          {
            id: "1-995",
            name: "System audio premium Fusion",
            price: 3400,
          },
          {
            id: "1-1003",
            name: "Panele słoneczne 200 W na tylnej części hardtopu",
            price: 1956,
          },
          {
            id: "1-1004",
            name: "Panele słoneczne 700 W na przedniej i środkowej części hardtopu",
            price: 6641,
          },
        ],
      },
      {
        id: "38",
        title: "Część podwodna",
        type: "checkbox",
        options: [
          {
            id: "38-5",
            name: "Farba antyporostowa na kadłubie",
            price: 5800,
          },
          {
            id: "38-2",
            name: "Farba antyporostowa na głównym skrzydle Aquila Hydro Glide z włókna węglowego",
            price: 582,
          },
          {
            id: "38-3",
            name: "Powłoka Propspeed na tylnych statecznikach systemu Hydro Glide",
            price: 2150,
          },
          {
            id: "38-7",
            name: "Ochrona antyporostowa ultradźwiękowa Hull Shield",
            price: 4938,
          },
        ],
      },
      {
        id: "39",
        title: "Transport",
        type: "checkbox",
        options: [
          {
            id: "39-1",
            name: "Transport z Szanghaju — orientacyjny koszt do europejskiego portu",
            price: 90000,
          },
        ],
      },
    ],
  },
}

export function getConfiguratorData(slug: string) {
  return CONFIGURATOR_DATA[slug] || null
}
