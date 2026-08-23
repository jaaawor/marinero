// Podpowiedź tłumaczenia nazw opcji z cennika producenta.
//
// Cenniki przychodzą po angielsku, a konfigurator na stronie jest po polsku.
// Przy pierwszym imporcie zupełnie nowej łodzi trzeba przepisać kilkadziesiąt
// nazw — i to jest jedyne, co ta funkcja robi: **daje pierwszą wersję do
// poprawienia**, żeby nie zaczynać od pustego pola.
//
// To nie jest tłumacz. Podmienia zwroty ze słownika sprzętu łodziowego,
// nie odmienia przez przypadki i nie rozumie zdania. „Pre-rig for Mercury
// Verado including hydraulic steering" wyjdzie jako „Pre-rigg pod Mercury
// Verado ze sterowanie hydrauliczne" — poprawne dopiero po ludzkiej ręce.
// Dlatego w narzędziu wynik ląduje w polu do edycji, nigdy prosto do bazy.
//
// Nazwy własne i symbole zostają nietknięte: Simrad, Garmin, Webasto, NSS16,
// RAL 9003, 3M CA-421, LNT-9502 — po nich rozpoznaje się pozycję niezależnie
// od języka.

/**
 * Zwroty wielowyrazowe. Kolejność ma znaczenie: dłuższe muszą stać przed
 * krótszymi, bo „anchor winch" ma wygrać z samym „anchor".
 */
const PHRASES: [RegExp, string][] = [
  // — pozycje szczególne, całe nazwy wierszy
  [/boat price according to standard equipment list/gi, "Cena łodzi w wyposażeniu standardowym"],
  [/according to nmma certification standards/gi, "wg certyfikacji NMMA"],
  [/customer comments? (&|and) special requirements/gi, "Uwagi klienta"],
  [/hull and deck exterior\s*[–-]\s*colou?r selection/gi, "Kolor kadłuba i pokładu"],
  [/exterior boat upholstery\s*[–-]\s*selection/gi, "Tapicerka zewnętrzna"],
  [/pilothouse (&|and) cabin upholstery\s*[–-]\s*selection/gi, "Tapicerka sterówki i kabiny"],
  [/additional features\s*[–-]\s*boat equipment/gi, "Wyposażenie dodatkowe"],
  [/navigation (&|and) boat handling options/gi, "Nawigacja i sterowanie"],
  [/boat with engine options/gi, "Łódź z silnikiem"],
  [/\(\s*choose one\s*\)/gi, "(wybierz jedną)"],

  // — silniki i osprzęt napędowy
  [/engines? installed and tested/gi, "silnik zamontowany i przetestowany"],
  [/joystick piloting steering/gi, "sterowanie joystickiem"],
  // Granica `\b` po `rigg?` jest konieczna: bez niej drugi wzorzec trafiał
  // w „Pre-rigg" wyprodukowane przez pierwszy i wychodziło „Pre-riggg".
  [/pre-?rigg?\b for/gi, "Pre-rigg pod"],
  [/pre-?rigg?\b/gi, "Pre-rigg"],
  [/hydraulic steering/gi, "sterowanie hydrauliczne"],
  [/electric steering/gi, "sterowanie elektryczne"],
  [/twin engines?/gi, "dwa silniki"],
  [/single engines?/gi, "pojedynczy silnik"],
  [/per engine/gi, "za silnik"],
  [/active trimm?/gi, "aktywny trym"],
  [/(\d+)\s*-?\s*or\s*-?\s*(\d+)\s*-?\s*cylinders?/gi, "$1/$2 cyl."],
  [/(\d+)\s*-?\s*cylinders?/gi, "$1 cyl."],
  [/\bin-?line 4\b/gi, "R4"],

  // — nawigacja i elektronika
  [/chartplotters?/gi, "Ploter nawigacyjny"],
  [/gps antenna/gi, "antena GPS"],
  [/fishfinder/gi, "echosonda wędkarska"],
  [/echosounder/gi, "echosonda"],
  [/transducer/gi, "przetwornik"],
  [/searchlight/gi, "szperacz"],
  [/bow thruster/gi, "Ster strumieniowy dziobowy"],
  [/stern thruster/gi, "Ster strumieniowy rufowy"],
  [/remote control system/gi, "zdalne sterowanie"],
  [/remote control unit/gi, "pilot"],
  [/remote control/gi, "zdalne sterowanie"],
  [/transmitter and receiver/gi, "nadajnik i odbiornik"],
  [/wireless phone charger/gi, "Ładowarka bezprzewodowa do telefonu"],
  [/forward-?facing light/gi, "oświetlenie dziobowe"],
  [/aft-?facing light/gi, "oświetlenie rufowe"],
  [/ambient floor lighting/gi, "Oświetlenie przypodłogowe"],
  [/digital radio/gi, "radio cyfrowe"],
  [/mast-?mounted/gi, "na maszcie"],

  // — kotwiczenie i cumowanie
  [/anchor winch/gi, "winda kotwiczna"],
  [/anchor package/gi, "Pakiet kotwiczny"],
  [/mooring kit/gi, "Pakiet cumowniczy"],
  [/mooring ropes?/gi, "cumy"],
  [/mooring cleats?/gi, "knagi cumownicze"],
  [/carbine hook/gi, "karabińczyk"],
  [/\bwindlass\b/gi, "wciągarka"],
  [/\bflagpole\b/gi, "Flagsztok"],
  [/\bshackle\b/gi, "szekla"],
  [/\bfenders?\b/gi, "odbijacze"],
  [/\bcleats?\b/gi, "knagi"],
  [/\bchain\b/gi, "łańcuch"],
  [/\banchor\b/gi, "kotwica"],

  // — pokład, kadłub, okna
  [/walking area covered by/gi, "Pokład pokryty"],
  [/soft deck/gi, "miękkim pokładem"],
  [/synthetic flooring/gi, "wykładziną syntetyczną"],
  [/black seams/gi, "czarne fugi"],
  [/sliding glass and laminate door/gi, "przesuwne drzwi szklano-laminatowe"],
  [/aft wall enclosure/gi, "zabudowa ściany rufowej"],
  [/sliding window/gi, "Przesuwne okno"],
  [/fixed window/gi, "Stałe okno"],
  [/roof hatch/gi, "szyberdach"],
  [/wiper with washer system/gi, "Wycieraczka ze spryskiwaczem"],
  [/external blinds/gi, "Zasłony zewnętrzne"],
  [/\bwindshield\b/gi, "szyba czołowa"],
  [/\bantifouling\b/gi, "antifouling"],
  [/\bhull\b/gi, "kadłub"],
  [/wrapped in/gi, "oklejony folią"],
  // „light" znaczy tu jasny odcień, nie oświetlenie — stąd kolory obok.
  [/light (colou?r|gray|grey|blue|green|beige)/gi, "jasny"],
  [/\bfilm\b/gi, "folia"],

  // — komfort i wyposażenie wnętrza
  [/air conditioning/gi, "klimatyzacja"],
  [/for entire boat/gi, "na całą łódź"],
  [/freshwater pressure system/gi, "System wody słodkiej"],
  [/hot water system/gi, "System ciepłej wody"],
  [/hot and cold water/gi, "ciepła i zimna woda"],
  [/waste tank/gi, "zbiornik na fekalia"],
  [/water tank/gi, "zbiornik wody"],
  [/electric toilet/gi, "toaleta elektryczna"],
  [/manual toilet/gi, "toaleta manualna"],
  [/separate toilet area/gi, "Wydzielona toaleta"],
  [/\bwashbasin\b/gi, "umywalka"],
  [/drawer refrigerator/gi, "Lodówka szufladowa"],
  [/\brefrigerator\b|\bfridge\b/gi, "lodówka"],
  [/shore power/gi, "Przyłącze portowe"],
  [/\bcharger\b/gi, "ładowarka"],
  [/\bsocket\b/gi, "gniazdko"],
  [/\bboiler\b/gi, "bojler"],
  [/\bdefroster\b/gi, "nadmuch na szybę"],
  [/\bheater\b/gi, "ogrzewanie postojowe"],
  [/\bshower\b/gi, "prysznic"],
  [/\bspeakers?\b/gi, "głośniki"],

  // — siedzenia, leżanki, zadaszenia
  [/padded seating with a folding backrest/gi, "siedzisko z składanym oparciem"],
  [/full-?suspension/gi, "amortyzowany"],
  [/adjustable/gi, "regulowany"],
  [/helmsman seat/gi, "fotel sternika"],
  [/co-?pilot seat/gi, "fotel pasażera"],
  [/driver seat/gi, "fotel sternika"],
  [/removable side seats/gi, "Zdejmowane siedzenia boczne"],
  [/side seat sofas/gi, "Boczne kanapy"],
  [/rain covers?/gi, "pokrowiec przeciwdeszczowy"],
  [/canopy system/gi, "zadaszenie"],
  [/sun shade/gi, "daszek przeciwsłoneczny"],
  [/foredeck sunbed/gi, "Dziobowy pokład słoneczny"],
  [/water ski pole/gi, "Uchwyt narciarza"],
  [/fishing rod holder/gi, "Uchwyt na wędki"],
  [/drink holders?/gi, "Uchwyty na napoje"],
  [/sunglasses storage box(es)?/gi, "Schowek na okulary"],
  [/life jacket/gi, "Kamizelka ratunkowa"],
  [/\barmrest\b/gi, "podłokietnik"],
  [/\bbacklrests?\b|\bbackrests?\b/gi, "oparcia"],
  [/\bmattresses\b|\bmattress\b/gi, "materace"],
  [/\bberth\b/gi, "koja"],
  [/\bcarpet\b/gi, "dywan"],
  [/\bheadliner\b/gi, "podsufitka"],
  [/\bupholstery\b/gi, "tapicerka"],
  [/foam shipping cradle/gi, "Kołyska transportowa piankowa"],
  [/\bcradle\b/gi, "kołyska transportowa"],
  [/steel reinforcement/gi, "wzmocnienie stalowe"],
  [/forklift unloading/gi, "rozładunek wózkiem widłowym"],
  [/storage under the seats/gi, "bakisty pod siedzeniami"],

  // — miejsca na łodzi
  // „for helmsman" musi paść PRZED zamianą samego „helmsman", inaczej
  // zostaje „do sternik" — reguła trafia już w podmieniony tekst.
  [/\bfor helmsman\b/gi, "po stronie sternika"],
  [/\bfor co-?pilot\b/gi, "po stronie pasażera"],
  [/\bpilothouse\b/gi, "sterówka"],
  [/\bforedeck\b/gi, "dziób"],
  [/\baft deck\b/gi, "pokład rufowy"],
  [/\bcockpit\b/gi, "kokpit"],
  [/\bhelmsman\b/gi, "sternik"],
  [/\bco-?pilot\b/gi, "pasażer"],
  [/right side/gi, "prawa burta"],
  [/left side/gi, "lewa burta"],
  [/\bstarboard\b/gi, "prawa burta"],
  [/\bport side\b/gi, "lewa burta"],

  // — spójniki i drobiazgi (na końcu, bo są najkrótsze)
  [/\brequires?\b/gi, "wymaga"],
  // Bez kropki w zasięgu wzorca zostawała sierota: „Pakiet cumowniczy ze.".
  [/\bincluding\b|\bincl\.?/gi, "ze"],
  [/\bwith\b/gi, "z"],
  [/\bfor\b/gi, "do"],
  [/\band\b/gi, "i"],
  [/\bor\b/gi, "lub"],
  [/\bper unit\b/gi, "za sztukę"],
  [/\bprice per unit\b/gi, "cena za sztukę"],
  [/\bmultiple units can be ordered\b/gi, "można zamówić więcej sztuk"],
  [/\bunits?\b/gi, "szt."],
  [/\bpcs\.?\b/gi, "szt."],
  [/\bmanual\b/gi, "ręczny"],
  [/\bfabric\b/gi, "materiałowy"],
  // Kolory TYLKO małą literą. Wielka litera w środku nazwy znaczy, że to
  // część nazwy własnej produktu — „XO White", „White Carbon 3M CA-419".
  // Tłumaczenie ich psuło identyfikator, po którym rozpoznaje się pozycję.
  [/\bblack\b/g, "czarny"],
  [/\bwhite\b/g, "biały"],
  [/\bgrey\b|\bgray\b/g, "szary"],
  [/\bhousing\b/gi, "obudowa"],
  [/\bonly\b/gi, "tylko"],
  [/\bmarket\b/gi, "rynek"],
  [/\bdashboard\b/gi, "deska rozdzielcza"],
  [/\bconverts? into\b/gi, "rozkładane w"],
  [/steering console/gi, "konsola sterowa"],
  [/\bcovers?\b/gi, "pokrowce"],
  [/\bbag\b/gi, "torba"],
  [/\bropes?\b/gi, "liny"],
  // „200hp" nie ma granicy słowa przed „hp", więc sam `\bhp\b` go nie łapał.
  [/(\d)\s*hp\b/gi, "$1 KM"],
  [/\bhp\b/gi, "KM"],
  // Na samym końcu, po zwrotach typu „engine installed and tested" —
  // inaczej zjadłoby im pierwsze słowo.
  [/\bengines\b/gi, "silniki"],
  [/\bengine\b/gi, "silnik"],
  [/\bintegrated\b/gi, "wbudowana"],
  [/\bfolding\b/gi, "składane"],
  [/\bcentral\b/gi, "środkowe"],
  [/\broof-?mounted\b/gi, "dachowy"],
  [/\bsupports?\b/gi, "podpory"],
  [/\bcharts?\b/gi, "mapa"],
  [/\btwin\b/gi, "2x"],
  [/\bsingle\b/gi, "pojedynczy"],
  [/\bprice\b/gi, "cena"],
  [/\bbow\b/gi, "dziobowy"],
  [/\bstern\b/gi, "rufowy"],
  [/\bdecks?\b/gi, "pokład"],
  [/\bseats?\b/gi, "siedzenie"],
  [/\blights?\b/gi, "oświetlenie"],
  [/\bon\b/gi, "na"],
  [/\bin\b/gi, "w"],
  [/\(\s*one\s*\)/gi, "(1 szt.)"],
]

/**
 * Podpowiedź polskiej nazwy. Wynik ZAWSZE idzie do pola do edycji — nigdy
 * wprost do bazy.
 */
export function translateOption(name: string): string {
  let text = String(name || "").trim()
  if (!text) return ""

  for (const [pattern, replacement] of PHRASES) {
    text = text.replace(pattern, replacement)
  }

  // Sprzątanie po podmianach: podwójne spacje i spacje przed przecinkiem.
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([,.)])/g, "$1").trim()

  return text ? text[0].toUpperCase() + text.slice(1) : ""
}

/**
 * Czy dla tej nazwy mamy w ogóle co zaproponować.
 *
 * Nie zgadujemy języka po liście słów — próbowaliśmy i „EU Version" wypadało
 * jako polskie. Pytanie brzmi po prostu: czy słownik cokolwiek tu zmienia.
 * Nazwy własne w rodzaju „Linetex Chalk (LNT-9502)" przechodzą bez zmian
 * i nie trafiają na listę do tłumaczenia — i bardzo dobrze.
 */
export function canTranslate(name: string): boolean {
  const text = String(name || "").trim()
  return Boolean(text) && translateOption(text) !== text
}
