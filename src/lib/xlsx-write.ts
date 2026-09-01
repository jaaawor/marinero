// Zapis XLSX bez zewnętrznej biblioteki — para dla `xlsx-read.ts`.
//
// „Eksport do Excela" przez CSV kończy się w polskim Excelu kreatorem importu,
// pytaniem o kodowanie i przecinkiem czytanym jako separator tysięcy. Prawdziwy
// skoroszyt otwiera się jednym kliknięciem i wraca do nas tym samym czytnikiem,
// którym czytamy cenniki producentów.
//
// Skoroszyt to ZIP z kilkoma plikami XML. Wpisy pakujemy **bez kompresji**
// (metoda 0, „stored"): oszczędza to całego deflate'a, a arkusz z czterystoma
// wierszami waży i tak kilkadziesiąt kilobajtów. Ceną jest własne CRC-32,
// którego ZIP wymaga nawet dla danych nieskompresowanych.

const KOD = new TextEncoder()

// Tablica CRC-32 liczona raz — bez niej każdy bajt to osiem operacji.
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[i] = c >>> 0
  }
  return tabela
})()

function crc32(dane: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < dane.length; i += 1) c = TABELA_CRC[(c ^ dane[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Zamienia znaki, które w XML-u znaczą co innego niż literalnie. */
function xml(tekst: string): string {
  return (
    String(tekst)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // Znaki sterujące wywracają Excelowi otwieranie pliku, a w danych z API
      // trafiają się w opisach przeklejonych z PDF-a. Tabulator, nowa linia
      // i powrót karetki są dozwolone i zostają.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  )
}

/** Adres komórki: 0 → A1, 26 → AA1. */
function adres(kolumna: number, wiersz: number): string {
  let litery = ""
  let n = kolumna
  do {
    litery = String.fromCharCode(65 + (n % 26)) + litery
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${litery}${wiersz}`
}

export type Komorka = string | number | null | undefined

function komorka(wartosc: Komorka, kolumna: number, wiersz: number): string {
  const gdzie = adres(kolumna, wiersz)

  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return `<c r="${gdzie}"/>`
  }

  if (typeof wartosc === "number" && Number.isFinite(wartosc)) {
    return `<c r="${gdzie}"><v>${wartosc}</v></c>`
  }

  // Tekst wpisujemy **w komórkę** (`inlineStr`), zamiast trzymać go w osobnej
  // tablicy `sharedStrings`. Przy jednym arkuszu oszczędność jest żadna,
  // a plik zostaje czytelny i o jeden element mniej może się rozjechać.
  return `<c r="${gdzie}" t="inlineStr"><is><t xml:space="preserve">${xml(String(wartosc))}</t></is></c>`
}

function wpisZip(nazwa: string, tresc: string) {
  const dane = KOD.encode(tresc)
  return { nazwa: KOD.encode(nazwa), dane, crc: crc32(dane) }
}

function u16(wartosc: number): number[] {
  return [wartosc & 0xff, (wartosc >>> 8) & 0xff]
}

function u32(wartosc: number): number[] {
  return [wartosc & 0xff, (wartosc >>> 8) & 0xff, (wartosc >>> 16) & 0xff, (wartosc >>> 24) & 0xff]
}

function spakuj(pliki: { nazwa: string; tresc: string }[]): Uint8Array {
  const wpisy = pliki.map((p) => wpisZip(p.nazwa, p.tresc))

  // Bufor liczymy z góry i piszemy po bajcie, zamiast zbierać liczby w tablicy
  // i rozwijać ją przez `push(...)`. Rozwinięcie przekazuje **każdy bajt jako
  // osobny argument** — przy arkuszu z czterystoma produktami (setki kilobajtów)
  // kończy się to „Maximum call stack size exceeded" i eksport w ogóle nie
  // wychodzi. Rozmiar pliku nie może decydować o tym, czy kod zadziała.
  const NAGLOWEK_LOKALNY = 30
  const WPIS_KATALOGU = 46
  const KONIEC = 22

  let rozmiar = KONIEC
  for (const wpis of wpisy) {
    rozmiar += NAGLOWEK_LOKALNY + wpis.nazwa.length + wpis.dane.length
    rozmiar += WPIS_KATALOGU + wpis.nazwa.length
  }

  const bufor = new Uint8Array(rozmiar)
  const widok = new DataView(bufor.buffer)
  let pozycja = 0

  const pisz16 = (wartosc: number) => {
    widok.setUint16(pozycja, wartosc, true)
    pozycja += 2
  }
  const pisz32 = (wartosc: number) => {
    widok.setUint32(pozycja, wartosc, true)
    pozycja += 4
  }
  const piszBajty = (dane: Uint8Array) => {
    bufor.set(dane, pozycja)
    pozycja += dane.length
  }

  const poczatki: number[] = []

  for (const wpis of wpisy) {
    poczatki.push(pozycja)
    pisz32(0x04034b50)
    pisz16(20) // wymagana wersja
    pisz16(0)
    pisz16(0) // metoda 0 = bez kompresji
    pisz16(0)
    pisz16(0) // czas i data — zerowe, Excel ich nie sprawdza
    pisz32(wpis.crc)
    pisz32(wpis.dane.length)
    pisz32(wpis.dane.length)
    pisz16(wpis.nazwa.length)
    pisz16(0)
    piszBajty(wpis.nazwa)
    piszBajty(wpis.dane)
  }

  const poczatekKatalogu = pozycja

  wpisy.forEach((wpis, numer) => {
    pisz32(0x02014b50)
    pisz16(20)
    pisz16(20)
    pisz16(0)
    pisz16(0)
    pisz16(0)
    pisz16(0)
    pisz32(wpis.crc)
    pisz32(wpis.dane.length)
    pisz32(wpis.dane.length)
    pisz16(wpis.nazwa.length)
    pisz16(0)
    pisz16(0)
    pisz16(0)
    pisz16(0)
    pisz32(0)
    pisz32(poczatki[numer])
    piszBajty(wpis.nazwa)
  })

  // Rozmiar katalogu bierzemy **przed** pisaniem stopki: `pozycja` przesuwa się
  // z każdym zapisem, więc policzona w locie byłaby o dwanaście bajtów za duża.
  // Nasz własny czytnik tego nie sprawdza i plik otwierał się u nas poprawnie —
  // Excel i każda porządna implementacja ZIP-a odrzuca go jako uszkodzony.
  const rozmiarKatalogu = pozycja - poczatekKatalogu

  pisz32(0x06054b50)
  pisz16(0)
  pisz16(0)
  pisz16(wpisy.length)
  pisz16(wpisy.length)
  pisz32(rozmiarKatalogu)
  pisz32(poczatekKatalogu)
  pisz16(0)

  return bufor
}

/**
 * Buduje skoroszyt z jednym arkuszem. Pierwszy wiersz to nagłówki i zostaje
 * zamrożony — przy czterystu produktach inaczej nie wiadomo, w której
 * kolumnie się jest.
 */
export function buildXlsx(opcje: {
  nazwaArkusza: string
  naglowki: string[]
  wiersze: Komorka[][]
  /** Szerokości kolumn w znakach; bez nich SKU i nazwy chowają się pod „####". */
  szerokosci?: number[]
}): Uint8Array {
  const { nazwaArkusza, naglowki, wiersze, szerokosci } = opcje

  const wierszXml = (komorki: Komorka[], numer: number) =>
    `<row r="${numer}">${komorki.map((w, i) => komorka(w, i, numer)).join("")}</row>`

  const kolumny = szerokosci?.length
    ? `<cols>${szerokosci
        .map((sz, i) => `<col min="${i + 1}" max="${i + 1}" width="${sz}" customWidth="1"/>`)
        .join("")}</cols>`
    : ""

  const arkusz =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    kolumny +
    `<sheetData>` +
    wierszXml(naglowki, 1) +
    wiersze.map((w, i) => wierszXml(w, i + 2)).join("") +
    `</sheetData></worksheet>`

  return spakuj([
    {
      nazwa: "[Content_Types].xml",
      tresc:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `</Types>`,
    },
    {
      nazwa: "_rels/.rels",
      tresc:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nazwa: "xl/workbook.xml",
      tresc:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${xml(nazwaArkusza).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    },
    {
      nazwa: "xl/_rels/workbook.xml.rels",
      tresc:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `</Relationships>`,
    },
    { nazwa: "xl/worksheets/sheet1.xml", tresc: arkusz },
  ])
}
