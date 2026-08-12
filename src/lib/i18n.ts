// Wielojęzyczność interfejsu. Treści redakcyjne (opisy modeli, aktualności)
// pochodzą z Directusa i pozostają w języku, w którym je wpisano.

export const LOCALES = ["pl", "en", "de", "fr", "ru", "uk", "it", "es"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "pl"

export const LOCALE_NAMES: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  ru: "Русский",
  uk: "Українська",
  it: "Italiano",
  es: "Español",
}

export const LOCALE_SHORT: Record<Locale, string> = {
  pl: "PL",
  en: "EN",
  de: "DE",
  fr: "FR",
  ru: "RU",
  uk: "UK",
  it: "IT",
  es: "ES",
}

// Kod dla atrybutu lang / formatowania dat.
export const LOCALE_TAGS: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  ru: "ru-RU",
  uk: "uk-UA",
  it: "it-IT",
  es: "es-ES",
}

export function isLocale(value: any): value is Locale {
  return LOCALES.includes(String(value) as Locale)
}

export function normalizeLocale(value: any): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

// Polski działa bez prefiksu, pozostałe języki mają prefiks w adresie.
export function localeHref(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`
  if (locale === DEFAULT_LOCALE) return clean
  return `/${locale}${clean === "/" ? "" : clean}`
}

export function stripLocale(path: string): { locale: Locale; path: string } {
  const match = path.match(/^\/([a-z]{2})(\/.*)?$/)

  if (match && isLocale(match[1])) {
    return { locale: match[1] as Locale, path: match[2] || "/" }
  }

  return { locale: DEFAULT_LOCALE, path: path || "/" }
}

type Dictionary = {
  navBrands: string
  navBoats: string
  navModels: string
  navShop: string
  navNews: string
  navContact: string
  navCall: string

  searchPlaceholder: string
  searchEmpty: string

  homeHeroTitle: string
  homeHeroLead: string
  homeSeeModels: string
  homeDealerLabel: string
  homeBrandsTitle: string
  homeAllBrands: string
  homeFeaturedLabel: string
  homeFeaturedTitle: string
  homeAllModels: string
  homeNewsLabel: string
  homeNewsTitle: string
  homeAllNews: string

  cardLength: string
  cardBeam: string
  cardCabins: string
  cardPersons: string

  modelsTitle: string
  modelsLead: string
  filtersLabel: string
  findModel: string
  archiveLink: string
  fieldBrand: string
  allBrandsOption: string
  fieldSeries: string
  allSeriesOption: string
  searchButton: string
  resultsLabel: string
  inCatalog: string
  clearFilter: string

  archiveTitle: string
  archiveLead: string
  archiveBadge: string

  boatsTitle: string
  boatsLead: string
  brandLabel: string
  brandModelsLead: string

  galleryTitle: string
  photosWord: string
  showMorePhotos: string
  showLess: string
  descriptionTitle: string
  specificationTitle: string
  requestSpec: string
  askOffer: string
  configuratorTitle: string
  otherModels: string
  modelCtaTitle: string
  modelCtaLead: string
  basePriceLabel: string
  seriesLabel: string

  newsTitle: string
  newsLead: string
  newsLabel: string
  newsEmpty: string
  newsReadMore: string

  cfgBaseIncludes: string
  cfgStandardEquipment: string
  cfgExpand: string
  cfgCollapse: string
  cfgExtraOptions: string
  cfgSelected: string
  cfgContactData: string
  cfgName: string
  cfgEmail: string
  cfgPhone: string
  cfgNotes: string
  cfgPreparedBy: string
  cfgTeam: string
  cfgPreparedByHint: string
  cfgCalculator: string
  cfgBasePrice: string
  cfgOptions: string
  cfgNetTotal: string
  cfgRate: string
  cfgGrossPln: string
  cfgChosenOptions: string
  cfgNoOptions: string
  cfgSubmit: string
  cfgSending: string
  cfgMissingEmail: string
  cfgSavedNoSmtp: string
  cfgSavedSent: string
  cfgUnavailable: string
  cfgUnavailableLead: string

  shopTitle: string
  shopLead: string
  shopCategories: string
  shopAllProducts: string
  shopSearchPlaceholder: string
  shopNoResults: string
  shopAddToCart: string
  shopAdded: string
  shopInCart: string
  shopCart: string
  shopCartEmpty: string
  shopCartEmptyLead: string
  shopContinue: string
  shopQuantity: string
  shopRemove: string
  shopSubtotal: string
  shopShipping: string
  shopTotal: string
  shopCheckout: string
  shopOrderTitle: string
  shopCustomer: string
  shopFirstName: string
  shopLastName: string
  shopAddress: string
  shopCity: string
  shopPostal: string
  shopCountry: string
  shopDelivery: string
  shopPayment: string
  shopPaymentLead: string
  shopAnnouncement: string
  shopTrust1: string
  shopTrust1Lead: string
  shopTrust2: string
  shopTrust2Lead: string
  shopTrust3: string
  shopTrust3Lead: string
  shopQuickAdd: string
  shopDescriptionTitle: string
  shopHeroTitle: string
  shopHeroLead: string
  shopHeroCta: string
  shopHeroSecondary: string
  shopPopular: string
  shopNewest: string
  shopBrandsTitle: string
  shopBrandsLead: string
  shopBrowseAll: string
  shopCategoriesLead: string
  shopStatsEyebrow: string
  shopStatsTitle: string
  shopStatsLead: string
  shopStatsService: string
  shopContactTitle: string
  shopCollections: string
  shopFeatured: string
  shopViewCategory: string
  shopPlaceOrder: string
  shopOrderSending: string
  shopOrderDone: string
  shopOrderDoneLead: string
  shopBackToShop: string
  shopProducts: string
  shopPrice: string
  shopSort: string
  shopSortNewest: string
  shopSortPriceAsc: string
  shopSortPriceDesc: string
  shopVariant: string
  shopStepCart: string
  shopStepData: string
  shopStepDone: string
  shopSummary: string
  shopFree: string
  shopTax: string
  shopVatIncluded: string
  shopVatExcluded: string
  shopAvailability: string
  shopInStock: string
  shopOnOrder: string
  shopShippingFast: string
  shopWarranty: string
  shopWarrantyValue: string
  shopFamilyEyebrow: string
  shopFamilyTitle: string
  shopSpecsTitle: string
  shopInStockCount: string
  shopFilters: string
  shopBrandLabel: string
  shopFuel: string
  shopPower: string
  shopShaft: string
  shopControl: string
  shopFiltersClear: string
  shopServiceTitle: string
  shopServiceEyebrow: string
  shopVatNote: string
  shopVatId: string
  shopVatIdHint: string
  shopVatCheck: string
  shopVatChecking: string
  shopVatOk: string
  shopVatInvalid: string
  shopVatError: string
  shopVatRemoved: string
  shopNet: string
  shopNeedHelp: string
  shopNeedHelpLead: string

  footerCompany: string
  footerBrands: string
  footerContact: string
  footerServices: string
  footerPrivacy: string
}

const pl: Dictionary = {
  navBrands: "Marki",
  navBoats: "Łodzie",
  navModels: "Modele",
  navShop: "Sklep",
  navNews: "Aktualności",
  navContact: "Kontakt",
  navCall: "Zadzwoń",

  searchPlaceholder: "Szukaj modelu…",
  searchEmpty: "Brak modeli pasujących do zapytania",

  homeHeroTitle: "Łodzie, silniki i konfiguracje ofertowe.",
  homeHeroLead:
    "Marinero prezentuje modele łodzi, umożliwia wybór wyposażenia i przygotowanie oferty dla klienta.",
  homeSeeModels: "Zobacz modele",
  homeDealerLabel: "Autoryzowany dealer",
  homeBrandsTitle: "Marki w ofercie",
  homeAllBrands: "Wszystkie marki",
  homeFeaturedLabel: "Polecane",
  homeFeaturedTitle: "Wybrane modele",
  homeAllModels: "Wszystkie modele",
  homeNewsLabel: "Targi, wydarzenia, premiery",
  homeNewsTitle: "Aktualności",
  homeAllNews: "Wszystkie aktualności",

  cardLength: "Długość",
  cardBeam: "Szerokość",
  cardCabins: "Kabiny",
  cardPersons: "Osoby",

  modelsTitle: "Modele łodzi",
  modelsLead:
    "Przegląd modeli marek dostępnych w ofercie Marinero. Wybierz model, sprawdź szczegóły i zapytaj o wycenę.",
  filtersLabel: "Filtry",
  findModel: "Znajdź model",
  archiveLink: "Archiwum modeli",
  fieldBrand: "Marka",
  allBrandsOption: "Wszystkie marki",
  fieldSeries: "Seria",
  allSeriesOption: "Wszystkie serie",
  searchButton: "Szukaj",
  resultsLabel: "Wyniki",
  inCatalog: "w katalogu",
  clearFilter: "Wyczyść filtr",

  archiveTitle: "Archiwum modeli",
  archiveLead: "Modele wycofane z produkcji, które wcześniej były w ofercie Marinero.",
  archiveBadge: "Wycofany z produkcji",

  boatsTitle: "Łodzie",
  boatsLead: "Modele dostępne w ofercie Marinero według marek i serii.",
  brandLabel: "Marka",
  brandModelsLead: "Modele dostępne w ofercie Marinero.",

  galleryTitle: "Galeria",
  photosWord: "zdjęć",
  showMorePhotos: "Zobacz więcej zdjęć",
  showLess: "Pokaż mniej",
  descriptionTitle: "Opis",
  specificationTitle: "Specyfikacja",
  requestSpec: "Poproś o specyfikację",
  askOffer: "Zapytaj o ofertę",
  configuratorTitle: "Konfigurator",
  otherModels: "Inne modele w ofercie",
  modelCtaTitle: "Chcesz poznać szczegóły tego modelu?",
  modelCtaLead:
    "Napisz lub zadzwoń — przygotujemy wycenę, doradzimy wyposażenie i termin dostawy.",
  basePriceLabel: "Cena bazowa netto",
  seriesLabel: "Seria",

  newsTitle: "Aktualności",
  newsLead:
    "Gdzie nas spotkasz, co nowego w ofercie marek i jakie modele trafiają do sprzedaży.",
  newsLabel: "Targi, wydarzenia, premiery",
  newsEmpty: "Nie ma jeszcze opublikowanych aktualności.",
  newsReadMore: "Czytaj dalej",

  cfgBaseIncludes: "Co zawiera cena bazowa",
  cfgStandardEquipment: "Wyposażenie standardowe",
  cfgExpand: "Rozwiń",
  cfgCollapse: "Zwiń",
  cfgExtraOptions: "Opcje dodatkowe",
  cfgSelected: "wybrane",
  cfgContactData: "Dane kontaktowe",
  cfgName: "Imię i nazwisko",
  cfgEmail: "Adres e-mail *",
  cfgPhone: "Telefon",
  cfgNotes: "Uwagi, termin zakupu, miejsce użytkowania",
  cfgPreparedBy: "Ofertę przygotowuje",
  cfgTeam: "Zespół Marinero",
  cfgPreparedByHint:
    "Steruje stopką i podpisem w ofercie PDF oraz adresem odpowiedzi w mailu.",
  cfgCalculator: "Kalkulator ceny",
  cfgBasePrice: "Cena bazowa",
  cfgOptions: "Opcje",
  cfgNetTotal: "Razem netto",
  cfgRate: "Kurs",
  cfgGrossPln: "Razem brutto PLN (VAT 23%)",
  cfgChosenOptions: "Wybrane opcje",
  cfgNoOptions: "Nie wybrano żadnych opcji",
  cfgSubmit: "Wyślij zapytanie i PDF",
  cfgSending: "Wysyłam...",
  cfgMissingEmail: "Podaj adres e-mail klienta.",
  cfgSavedNoSmtp:
    "Zapytanie zapisane w panelu admina. Wysyłka maila wymaga jeszcze konfiguracji SMTP.",
  cfgSavedSent: "Zapytanie zapisane, a oferta PDF została wysłana mailem.",
  cfgUnavailable: "Konfigurator w przygotowaniu",
  cfgUnavailableLead: "Dla tego modelu nie ma jeszcze dodanego cennika.",

    shopTitle: "Sklep",
  shopLead: "Silniki, elektronika i akcesoria motorowodne — wysyłka i odbiór w Gdyni.",
  shopCategories: "Kategorie",
  shopAllProducts: "Wszystkie produkty",
  shopSearchPlaceholder: "Szukaj w sklepie…",
  shopNoResults: "Brak produktów pasujących do wyszukiwania.",
  shopAddToCart: "Dodaj do koszyka",
  shopAdded: "Dodano do koszyka",
  shopInCart: "W koszyku",
  shopCart: "Koszyk",
  shopCartEmpty: "Twój koszyk jest pusty",
  shopCartEmptyLead: "Wybierz coś z naszej oferty — silniki, elektronika i akcesoria.",
  shopContinue: "Kontynuuj zakupy",
  shopQuantity: "Ilość",
  shopRemove: "Usuń",
  shopSubtotal: "Wartość produktów",
  shopShipping: "Dostawa",
  shopTotal: "Razem",
  shopCheckout: "Przejdź do zamówienia",
  shopOrderTitle: "Zamówienie",
  shopCustomer: "Dane zamawiającego",
  shopFirstName: "Imię",
  shopLastName: "Nazwisko",
  shopAddress: "Adres",
  shopCity: "Miasto",
  shopPostal: "Kod pocztowy",
  shopCountry: "Kraj",
  shopDelivery: "Sposób dostawy",
  shopPayment: "Płatność",
  shopPaymentLead: "Zamówienie potwierdzamy mailem, a dane do przelewu i szczegóły dostawy ustalamy indywidualnie — skontaktujemy się z Tobą od razu po złożeniu zamówienia.",
    shopAnnouncement: "Autoryzowany serwis Mercury i Suzuki · Wysyłka w 24 h · Odbiór osobisty w Gdyni",
  shopTrust1: "Autoryzowany dealer",
  shopTrust1Lead: "Oryginalne części i elektronika prosto od producentów.",
  shopTrust2: "Wysyłka w 24 h",
  shopTrust2Lead: "Produkty z magazynu wysyłamy tego samego lub następnego dnia roboczego.",
  shopTrust3: "Doradztwo serwisu",
  shopTrust3Lead: "Pomożemy dobrać części i osprzęt do Twojej łodzi — zadzwoń lub napisz.",
  shopQuickAdd: "Do koszyka",
  shopDescriptionTitle: "Opis produktu",
    shopHeroTitle: "Wszystko, czego potrzebuje Twoja łódź",
  shopHeroLead: "Silniki zaburtowe, elektronika nawigacyjna, części serwisowe i akcesoria. Autoryzowany dealer Mercury, Suzuki, Garmin, Simrad i Fusion.",
  shopHeroCta: "Zobacz produkty",
  shopHeroSecondary: "Skontaktuj się z serwisem",
  shopPopular: "Najczęściej kupowane",
  shopNewest: "Nowości w sklepie",
  shopBrandsTitle: "Marki, które sprzedajemy i serwisujemy",
  shopBrandsLead: "Sprzęt prosto od producentów, z gwarancją i wsparciem naszego serwisu.",
  shopBrowseAll: "Zobacz wszystkie produkty",
  shopCategoriesLead: "Wybierz kategorię i przejdź prosto do sprzętu, którego szukasz.",
    shopStatsEyebrow: "Marinero od 2004",
  shopStatsTitle: "Sprzęt, który sami serwisujemy",
  shopStatsLead: "Nie sprzedajemy katalogu z hurtowni. Każdy silnik, ploter i część przechodzi przez nasz serwis w Gdyni — dlatego wiemy, co polecamy.",
  shopStatsService: "Marki w serwisie",
  shopContactTitle: "Nie wiesz, co wybrać? Zadzwoń do serwisu.",
  shopCollections: "Kolekcje",
  shopFeatured: "Wybrane produkty",
  shopViewCategory: "Zobacz kategorię",
  shopPlaceOrder: "Złóż zamówienie",
  shopOrderSending: "Składam zamówienie…",
  shopOrderDone: "Dziękujemy za zamówienie",
  shopOrderDoneLead: "Potwierdzenie wysłaliśmy na podany adres e-mail. Skontaktujemy się w sprawie płatności i dostawy.",
  shopBackToShop: "Wróć do sklepu",
  shopProducts: "produktów",
  shopPrice: "Cena",
  shopSort: "Sortowanie",
  shopSortNewest: "Najnowsze",
  shopSortPriceAsc: "Cena rosnąco",
  shopSortPriceDesc: "Cena malejąco",
  shopVariant: "Wariant",
  shopStepCart: "Koszyk",
  shopStepData: "Dane i dostawa",
  shopStepDone: "Potwierdzenie",
  shopSummary: "Podsumowanie",
  shopFree: "Gratis",
  shopTax: "VAT 23%",
  shopNet: "Wartość netto",
  shopVatIncluded: "Cena zawiera VAT 23%",
  shopVatExcluded: "Cena netto — VAT 23% doliczamy w koszyku",
  shopAvailability: "Dostępność",
  shopInStock: "Wysyłamy od ręki",
  shopOnOrder: "Na zamówienie — potwierdzimy termin",
  shopShippingFast: "Wysyłka w 24 h lub odbiór w Gdyni",
  shopWarranty: "Gwarancja",
  shopWarrantyValue: "Gwarancja producenta, serwis w Gdyni",
  shopFamilyEyebrow: "Ta sama seria",
  shopFamilyTitle: "Pozostałe wersje tego modelu",
  shopSpecsTitle: "Dane techniczne",
  shopInStockCount: "na magazynie: {n} szt.",
  shopFilters: "Filtry",
  shopBrandLabel: "Marka",
  shopFuel: "Rodzaj silnika",
  shopPower: "Moc",
  shopShaft: "Długość kolumny",
  shopControl: "Sterowanie",
  shopFiltersClear: "Wyczyść filtry",
  shopServiceTitle: "Zaplanuj serwis",
  shopServiceEyebrow: "Części i akcesoria",
  shopVatNote: "Wszystkie ceny w sklepie są cenami brutto — zawierają VAT 23%.",
  shopVatId: "NIP / VAT UE (opcjonalnie)",
  shopVatIdHint: "Firmy z UE spoza Polski: podaj numer VAT UE, a fakturę bez VAT wystawimy po kontakcie z serwisem.",
  shopVatCheck: "Sprawdź",
  shopVatChecking: "Sprawdzam…",
  shopVatOk: "Numer VAT UE potwierdzony w rejestrze VIES — sprzedaż bez VAT",
  shopVatInvalid: "Tego numeru nie ma w rejestrze VIES. Sprawdź zapis albo kup z VAT-em.",
  shopVatError: "Rejestr VIES nie odpowiada. Spróbuj za chwilę albo złóż zamówienie z VAT-em — poprawimy fakturę.",
  shopVatRemoved: "VAT 23% zdjęty (odwrotne obciążenie)",
  shopNeedHelp: "Potrzebujesz pomocy w doborze?",
  shopNeedHelpLead: "Zadzwoń lub napisz — dobierzemy sprzęt do Twojej łodzi.",

  footerCompany: "Firma",
  footerBrands: "Marki",
  footerContact: "Kontakt",
  footerServices: "Usługi",
  footerPrivacy: "Polityka prywatności",
}

const en: Dictionary = {
  navBrands: "Brands",
  navBoats: "Boats",
  navModels: "Models",
  navShop: "Shop",
  navNews: "News",
  navContact: "Contact",
  navCall: "Call us",

  searchPlaceholder: "Search for a model…",
  searchEmpty: "No models match your search",

  homeHeroTitle: "Boats, engines and ready-to-send quotations.",
  homeHeroLead:
    "Marinero presents boat models, lets you choose the equipment and prepare a quotation for your client.",
  homeSeeModels: "Browse models",
  homeDealerLabel: "Authorised dealer",
  homeBrandsTitle: "Brands we represent",
  homeAllBrands: "All brands",
  homeFeaturedLabel: "Highlights",
  homeFeaturedTitle: "Selected models",
  homeAllModels: "All models",
  homeNewsLabel: "Boat shows, events, premieres",
  homeNewsTitle: "News",
  homeAllNews: "All news",

  cardLength: "Length",
  cardBeam: "Beam",
  cardCabins: "Cabins",
  cardPersons: "Persons",

  modelsTitle: "Boat models",
  modelsLead:
    "An overview of the models available at Marinero. Pick a model, check the details and ask for a quotation.",
  filtersLabel: "Filters",
  findModel: "Find a model",
  archiveLink: "Model archive",
  fieldBrand: "Brand",
  allBrandsOption: "All brands",
  fieldSeries: "Series",
  allSeriesOption: "All series",
  searchButton: "Search",
  resultsLabel: "Results",
  inCatalog: "in the catalogue",
  clearFilter: "Clear filters",

  archiveTitle: "Model archive",
  archiveLead: "Discontinued models that were previously part of the Marinero range.",
  archiveBadge: "Discontinued",

  boatsTitle: "Boats",
  boatsLead: "Models available at Marinero, by brand and series.",
  brandLabel: "Brand",
  brandModelsLead: "Models available at Marinero.",

  galleryTitle: "Gallery",
  photosWord: "photos",
  showMorePhotos: "See more photos",
  showLess: "Show less",
  descriptionTitle: "Description",
  specificationTitle: "Specification",
  requestSpec: "Request full specification",
  askOffer: "Ask for a quotation",
  configuratorTitle: "Configurator",
  otherModels: "Other models in our range",
  modelCtaTitle: "Would you like to know more about this model?",
  modelCtaLead:
    "Write or call us — we will prepare a quotation and advise on equipment and delivery dates.",
  basePriceLabel: "Base price, net",
  seriesLabel: "Series",

  newsTitle: "News",
  newsLead:
    "Where to meet us, what is new in our brands' ranges and which models are coming to market.",
  newsLabel: "Boat shows, events, premieres",
  newsEmpty: "There are no published news items yet.",
  newsReadMore: "Read more",

  cfgBaseIncludes: "What the base price includes",
  cfgStandardEquipment: "Standard equipment",
  cfgExpand: "Expand",
  cfgCollapse: "Collapse",
  cfgExtraOptions: "Optional equipment",
  cfgSelected: "selected",
  cfgContactData: "Contact details",
  cfgName: "Full name",
  cfgEmail: "E-mail address *",
  cfgPhone: "Phone",
  cfgNotes: "Notes, purchase date, area of use",
  cfgPreparedBy: "Quotation prepared by",
  cfgTeam: "Marinero team",
  cfgPreparedByHint:
    "Controls the footer and signature in the PDF quotation and the reply address of the e-mail.",
  cfgCalculator: "Price calculator",
  cfgBasePrice: "Base price",
  cfgOptions: "Options",
  cfgNetTotal: "Total, net",
  cfgRate: "Rate",
  cfgGrossPln: "Total gross PLN (VAT 23%)",
  cfgChosenOptions: "Selected options",
  cfgNoOptions: "No options selected",
  cfgSubmit: "Send enquiry and PDF",
  cfgSending: "Sending...",
  cfgMissingEmail: "Please provide the client's e-mail address.",
  cfgSavedNoSmtp:
    "The enquiry has been saved in the admin panel. Sending e-mail still requires SMTP configuration.",
  cfgSavedSent: "The enquiry has been saved and the PDF quotation has been e-mailed.",
  cfgUnavailable: "Configurator coming soon",
  cfgUnavailableLead: "There is no price list for this model yet.",

    shopTitle: "Shop",
  shopLead: "Engines, electronics and marine accessories — shipping and pickup in Gdynia.",
  shopCategories: "Categories",
  shopAllProducts: "All products",
  shopSearchPlaceholder: "Search the shop…",
  shopNoResults: "No products match your search.",
  shopAddToCart: "Add to cart",
  shopAdded: "Added to cart",
  shopInCart: "In cart",
  shopCart: "Cart",
  shopCartEmpty: "Your cart is empty",
  shopCartEmptyLead: "Pick something from our range — engines, electronics and accessories.",
  shopContinue: "Continue shopping",
  shopQuantity: "Quantity",
  shopRemove: "Remove",
  shopSubtotal: "Subtotal",
  shopShipping: "Shipping",
  shopTotal: "Total",
  shopCheckout: "Proceed to checkout",
  shopOrderTitle: "Checkout",
  shopCustomer: "Customer details",
  shopFirstName: "First name",
  shopLastName: "Last name",
  shopAddress: "Address",
  shopCity: "City",
  shopPostal: "Postal code",
  shopCountry: "Country",
  shopDelivery: "Delivery method",
  shopPayment: "Payment",
  shopPaymentLead: "We confirm the order by e-mail; bank transfer details and delivery are arranged individually — we will contact you right after you place the order.",
    shopAnnouncement: "Authorised Mercury and Suzuki service · Dispatch within 24 h · Pickup in Gdynia",
  shopTrust1: "Authorised dealer",
  shopTrust1Lead: "Genuine parts and electronics straight from the manufacturers.",
  shopTrust2: "Dispatch within 24 h",
  shopTrust2Lead: "Items in stock ship the same or the next working day.",
  shopTrust3: "Service advice",
  shopTrust3Lead: "We will help you pick the right parts and gear for your boat — call or write.",
  shopQuickAdd: "Add",
  shopDescriptionTitle: "Product description",
    shopHeroTitle: "Everything your boat needs",
  shopHeroLead: "Outboard engines, navigation electronics, service parts and accessories. Authorised dealer of Mercury, Suzuki, Garmin, Simrad and Fusion.",
  shopHeroCta: "Browse products",
  shopHeroSecondary: "Contact our service",
  shopPopular: "Best sellers",
  shopNewest: "New in the shop",
  shopBrandsTitle: "Brands we sell and service",
  shopBrandsLead: "Equipment straight from the manufacturers, with warranty and our service support.",
  shopBrowseAll: "See all products",
  shopCategoriesLead: "Pick a category and go straight to the gear you need.",
    shopStatsEyebrow: "Marinero since 2004",
  shopStatsTitle: "Gear we service ourselves",
  shopStatsLead: "We do not resell a wholesaler’s catalogue. Every engine, plotter and part passes through our workshop in Gdynia — that is why we know what we recommend.",
  shopStatsService: "Serviced brands",
  shopContactTitle: "Not sure what to choose? Call our service.",
  shopCollections: "Collections",
  shopFeatured: "Selected products",
  shopViewCategory: "View category",
  shopPlaceOrder: "Place order",
  shopOrderSending: "Placing order…",
  shopOrderDone: "Thank you for your order",
  shopOrderDoneLead: "We have sent a confirmation to your e-mail. We will contact you about payment and delivery.",
  shopBackToShop: "Back to shop",
  shopProducts: "products",
  shopPrice: "Price",
  shopSort: "Sorting",
  shopSortNewest: "Newest",
  shopSortPriceAsc: "Price: low to high",
  shopSortPriceDesc: "Price: high to low",
  shopVariant: "Variant",
  shopStepCart: "Cart",
  shopStepData: "Details & delivery",
  shopStepDone: "Confirmation",
  shopSummary: "Summary",
  shopFree: "Free",
  shopTax: "VAT 23%",
  shopNet: "Net total",
  shopVatIncluded: "Price includes 23% VAT",
  shopVatExcluded: "Net price — 23% VAT is added in the cart",
  shopAvailability: "Availability",
  shopInStock: "Ships immediately",
  shopOnOrder: "To order — we will confirm the date",
  shopShippingFast: "Shipping in 24 h or pickup in Gdynia",
  shopWarranty: "Warranty",
  shopWarrantyValue: "Manufacturer warranty, service in Gdynia",
  shopFamilyEyebrow: "Same series",
  shopFamilyTitle: "Other versions of this model",
  shopSpecsTitle: "Specification",
  shopInStockCount: "in stock: {n} pcs",
  shopFilters: "Filters",
  shopBrandLabel: "Brand",
  shopFuel: "Engine type",
  shopPower: "Power",
  shopShaft: "Shaft length",
  shopControl: "Steering",
  shopFiltersClear: "Clear filters",
  shopServiceTitle: "Plan the service",
  shopServiceEyebrow: "Parts and accessories",
  shopVatNote: "All prices in the shop are gross — they include 23% VAT.",
  shopVatId: "VAT ID (optional)",
  shopVatIdHint: "EU companies outside Poland: give your EU VAT number and we will issue a VAT-free invoice after contacting you.",
  shopVatCheck: "Check",
  shopVatChecking: "Checking…",
  shopVatOk: "VAT number confirmed in the VIES registry — sale without VAT",
  shopVatInvalid: "This number is not in the VIES registry. Check it or buy with VAT.",
  shopVatError: "The VIES registry is not responding. Try again shortly or order with VAT — we will correct the invoice.",
  shopVatRemoved: "23% VAT removed (reverse charge)",
  shopNeedHelp: "Need help choosing?",
  shopNeedHelpLead: "Call or write — we will match the equipment to your boat.",

  footerCompany: "Company",
  footerBrands: "Brands",
  footerContact: "Contact",
  footerServices: "Services",
  footerPrivacy: "Privacy policy",
}

const de: Dictionary = {
  navBrands: "Marken",
  navBoats: "Boote",
  navModels: "Modelle",
  navShop: "Shop",
  navNews: "Aktuelles",
  navContact: "Kontakt",
  navCall: "Anrufen",

  searchPlaceholder: "Modell suchen…",
  searchEmpty: "Keine Modelle gefunden",

  homeHeroTitle: "Boote, Motoren und fertige Angebote.",
  homeHeroLead:
    "Marinero präsentiert Bootsmodelle, ermöglicht die Auswahl der Ausstattung und die Erstellung eines Angebots für Ihren Kunden.",
  homeSeeModels: "Modelle ansehen",
  homeDealerLabel: "Autorisierter Händler",
  homeBrandsTitle: "Marken im Programm",
  homeAllBrands: "Alle Marken",
  homeFeaturedLabel: "Empfehlungen",
  homeFeaturedTitle: "Ausgewählte Modelle",
  homeAllModels: "Alle Modelle",
  homeNewsLabel: "Messen, Veranstaltungen, Premieren",
  homeNewsTitle: "Aktuelles",
  homeAllNews: "Alle Meldungen",

  cardLength: "Länge",
  cardBeam: "Breite",
  cardCabins: "Kabinen",
  cardPersons: "Personen",

  modelsTitle: "Bootsmodelle",
  modelsLead:
    "Überblick über die bei Marinero erhältlichen Modelle. Wählen Sie ein Modell, prüfen Sie die Details und fragen Sie ein Angebot an.",
  filtersLabel: "Filter",
  findModel: "Modell finden",
  archiveLink: "Modellarchiv",
  fieldBrand: "Marke",
  allBrandsOption: "Alle Marken",
  fieldSeries: "Serie",
  allSeriesOption: "Alle Serien",
  searchButton: "Suchen",
  resultsLabel: "Ergebnisse",
  inCatalog: "im Katalog",
  clearFilter: "Filter zurücksetzen",

  archiveTitle: "Modellarchiv",
  archiveLead: "Nicht mehr produzierte Modelle, die früher zum Marinero-Programm gehörten.",
  archiveBadge: "Nicht mehr produziert",

  boatsTitle: "Boote",
  boatsLead: "Bei Marinero erhältliche Modelle nach Marke und Serie.",
  brandLabel: "Marke",
  brandModelsLead: "Bei Marinero erhältliche Modelle.",

  galleryTitle: "Galerie",
  photosWord: "Fotos",
  showMorePhotos: "Mehr Fotos ansehen",
  showLess: "Weniger anzeigen",
  descriptionTitle: "Beschreibung",
  specificationTitle: "Technische Daten",
  requestSpec: "Vollständige Daten anfragen",
  askOffer: "Angebot anfragen",
  configuratorTitle: "Konfigurator",
  otherModels: "Weitere Modelle im Programm",
  modelCtaTitle: "Möchten Sie mehr über dieses Modell erfahren?",
  modelCtaLead:
    "Schreiben oder rufen Sie uns an — wir erstellen ein Angebot und beraten zu Ausstattung und Liefertermin.",
  basePriceLabel: "Grundpreis netto",
  seriesLabel: "Serie",

  newsTitle: "Aktuelles",
  newsLead:
    "Wo Sie uns treffen, was es Neues bei unseren Marken gibt und welche Modelle auf den Markt kommen.",
  newsLabel: "Messen, Veranstaltungen, Premieren",
  newsEmpty: "Es wurden noch keine Meldungen veröffentlicht.",
  newsReadMore: "Weiterlesen",

  cfgBaseIncludes: "Im Grundpreis enthalten",
  cfgStandardEquipment: "Serienausstattung",
  cfgExpand: "Ausklappen",
  cfgCollapse: "Einklappen",
  cfgExtraOptions: "Sonderausstattung",
  cfgSelected: "ausgewählt",
  cfgContactData: "Kontaktdaten",
  cfgName: "Vor- und Nachname",
  cfgEmail: "E-Mail-Adresse *",
  cfgPhone: "Telefon",
  cfgNotes: "Anmerkungen, Kaufzeitpunkt, Einsatzgebiet",
  cfgPreparedBy: "Angebot erstellt von",
  cfgTeam: "Marinero-Team",
  cfgPreparedByHint:
    "Steuert Fußzeile und Unterschrift im PDF-Angebot sowie die Antwortadresse der E-Mail.",
  cfgCalculator: "Preisrechner",
  cfgBasePrice: "Grundpreis",
  cfgOptions: "Optionen",
  cfgNetTotal: "Summe netto",
  cfgRate: "Kurs",
  cfgGrossPln: "Summe brutto PLN (23% MwSt.)",
  cfgChosenOptions: "Gewählte Optionen",
  cfgNoOptions: "Keine Optionen gewählt",
  cfgSubmit: "Anfrage und PDF senden",
  cfgSending: "Wird gesendet...",
  cfgMissingEmail: "Bitte geben Sie die E-Mail-Adresse des Kunden an.",
  cfgSavedNoSmtp:
    "Die Anfrage wurde im Adminbereich gespeichert. Der E-Mail-Versand erfordert noch eine SMTP-Konfiguration.",
  cfgSavedSent: "Die Anfrage wurde gespeichert und das PDF-Angebot per E-Mail verschickt.",
  cfgUnavailable: "Konfigurator in Vorbereitung",
  cfgUnavailableLead: "Für dieses Modell liegt noch keine Preisliste vor.",

    shopTitle: "Shop",
  shopLead: "Motoren, Elektronik und Bootszubehör — Versand und Abholung in Gdynia.",
  shopCategories: "Kategorien",
  shopAllProducts: "Alle Produkte",
  shopSearchPlaceholder: "Im Shop suchen…",
  shopNoResults: "Keine Produkte gefunden.",
  shopAddToCart: "In den Warenkorb",
  shopAdded: "Zum Warenkorb hinzugefügt",
  shopInCart: "Im Warenkorb",
  shopCart: "Warenkorb",
  shopCartEmpty: "Ihr Warenkorb ist leer",
  shopCartEmptyLead: "Wählen Sie etwas aus unserem Angebot — Motoren, Elektronik und Zubehör.",
  shopContinue: "Weiter einkaufen",
  shopQuantity: "Menge",
  shopRemove: "Entfernen",
  shopSubtotal: "Zwischensumme",
  shopShipping: "Versand",
  shopTotal: "Gesamt",
  shopCheckout: "Zur Kasse",
  shopOrderTitle: "Bestellung",
  shopCustomer: "Kundendaten",
  shopFirstName: "Vorname",
  shopLastName: "Nachname",
  shopAddress: "Adresse",
  shopCity: "Stadt",
  shopPostal: "Postleitzahl",
  shopCountry: "Land",
  shopDelivery: "Versandart",
  shopPayment: "Zahlung",
  shopPaymentLead: "Wir bestätigen die Bestellung per E-Mail; Überweisungsdaten und Lieferung stimmen wir individuell ab — wir melden uns direkt nach der Bestellung.",
    shopAnnouncement: "Autorisierter Mercury- und Suzuki-Service · Versand in 24 h · Abholung in Gdynia",
  shopTrust1: "Autorisierter Händler",
  shopTrust1Lead: "Originalteile und Elektronik direkt von den Herstellern.",
  shopTrust2: "Versand in 24 h",
  shopTrust2Lead: "Lagerware versenden wir am selben oder nächsten Werktag.",
  shopTrust3: "Service-Beratung",
  shopTrust3Lead: "Wir helfen bei der Auswahl von Teilen und Ausrüstung für Ihr Boot — rufen Sie an oder schreiben Sie.",
  shopQuickAdd: "In den Korb",
  shopDescriptionTitle: "Produktbeschreibung",
    shopHeroTitle: "Alles, was Ihr Boot braucht",
  shopHeroLead: "Außenbordmotoren, Navigationselektronik, Serviceteile und Zubehör. Autorisierter Händler von Mercury, Suzuki, Garmin, Simrad und Fusion.",
  shopHeroCta: "Produkte ansehen",
  shopHeroSecondary: "Service kontaktieren",
  shopPopular: "Meistgekauft",
  shopNewest: "Neu im Shop",
  shopBrandsTitle: "Marken, die wir verkaufen und warten",
  shopBrandsLead: "Ausrüstung direkt von den Herstellern, mit Garantie und Unterstützung unseres Service.",
  shopBrowseAll: "Alle Produkte ansehen",
  shopCategoriesLead: "Wählen Sie eine Kategorie und gehen Sie direkt zur gesuchten Ausrüstung.",
    shopStatsEyebrow: "Marinero seit 2004",
  shopStatsTitle: "Ausrüstung, die wir selbst warten",
  shopStatsLead: "Wir verkaufen keinen Großhandelskatalog. Jeder Motor, Plotter und jedes Teil geht durch unsere Werkstatt in Gdynia — deshalb wissen wir, was wir empfehlen.",
  shopStatsService: "Marken im Service",
  shopContactTitle: "Unsicher bei der Wahl? Rufen Sie unseren Service an.",
  shopCollections: "Kollektionen",
  shopFeatured: "Ausgewählte Produkte",
  shopViewCategory: "Kategorie ansehen",
  shopPlaceOrder: "Bestellung aufgeben",
  shopOrderSending: "Bestellung wird aufgegeben…",
  shopOrderDone: "Vielen Dank für Ihre Bestellung",
  shopOrderDoneLead: "Die Bestätigung haben wir an Ihre E-Mail geschickt. Wir melden uns wegen Zahlung und Lieferung.",
  shopBackToShop: "Zurück zum Shop",
  shopProducts: "Produkte",
  shopPrice: "Preis",
  shopSort: "Sortierung",
  shopSortNewest: "Neueste",
  shopSortPriceAsc: "Preis aufsteigend",
  shopSortPriceDesc: "Preis absteigend",
  shopVariant: "Variante",
  shopStepCart: "Warenkorb",
  shopStepData: "Daten & Lieferung",
  shopStepDone: "Bestätigung",
  shopSummary: "Zusammenfassung",
  shopFree: "Gratis",
  shopTax: "MwSt. 23%",
  shopNet: "Nettobetrag",
  shopVatIncluded: "Preis inkl. 23% MwSt.",
  shopVatExcluded: "Nettopreis — 23% MwSt. kommt im Warenkorb dazu",
  shopAvailability: "Verfügbarkeit",
  shopInStock: "Sofort versandbereit",
  shopOnOrder: "Auf Bestellung — Termin bestätigen wir",
  shopShippingFast: "Versand in 24 h oder Abholung in Gdynia",
  shopWarranty: "Garantie",
  shopWarrantyValue: "Herstellergarantie, Service in Gdynia",
  shopFamilyEyebrow: "Gleiche Serie",
  shopFamilyTitle: "Weitere Ausführungen dieses Modells",
  shopSpecsTitle: "Technische Daten",
  shopInStockCount: "auf Lager: {n} Stk.",
  shopFilters: "Filter",
  shopBrandLabel: "Marke",
  shopFuel: "Motortyp",
  shopPower: "Leistung",
  shopShaft: "Schaftlänge",
  shopControl: "Steuerung",
  shopFiltersClear: "Filter löschen",
  shopServiceTitle: "Service planen",
  shopServiceEyebrow: "Teile und Zubehör",
  shopVatNote: "Alle Preise im Shop sind Bruttopreise — inklusive 23% MwSt.",
  shopVatId: "USt-IdNr. (optional)",
  shopVatIdHint: "EU-Firmen außerhalb Polens: Geben Sie Ihre USt-IdNr. an — die Rechnung ohne MwSt. stellen wir nach Rücksprache aus.",
  shopVatCheck: "Prüfen",
  shopVatChecking: "Prüfe…",
  shopVatOk: "USt-IdNr. im VIES-Register bestätigt — Verkauf ohne MwSt.",
  shopVatInvalid: "Diese Nummer steht nicht im VIES-Register. Bitte prüfen oder mit MwSt. kaufen.",
  shopVatError: "Das VIES-Register antwortet nicht. Später erneut versuchen oder mit MwSt. bestellen — wir korrigieren die Rechnung.",
  shopVatRemoved: "23% MwSt. entfernt (Reverse Charge)",
  shopNeedHelp: "Brauchen Sie Hilfe bei der Auswahl?",
  shopNeedHelpLead: "Rufen Sie an oder schreiben Sie — wir wählen die Ausrüstung für Ihr Boot aus.",

  footerCompany: "Unternehmen",
  footerBrands: "Marken",
  footerContact: "Kontakt",
  footerServices: "Leistungen",
  footerPrivacy: "Datenschutz",
}

const fr: Dictionary = {
  navBrands: "Marques",
  navBoats: "Bateaux",
  navModels: "Modèles",
  navShop: "Boutique",
  navNews: "Actualités",
  navContact: "Contact",
  navCall: "Appeler",

  searchPlaceholder: "Rechercher un modèle…",
  searchEmpty: "Aucun modèle ne correspond à la recherche",

  homeHeroTitle: "Bateaux, moteurs et offres prêtes à envoyer.",
  homeHeroLead:
    "Marinero présente ses modèles de bateaux, permet de choisir les équipements et de préparer une offre pour le client.",
  homeSeeModels: "Voir les modèles",
  homeDealerLabel: "Concessionnaire agréé",
  homeBrandsTitle: "Marques représentées",
  homeAllBrands: "Toutes les marques",
  homeFeaturedLabel: "À la une",
  homeFeaturedTitle: "Modèles sélectionnés",
  homeAllModels: "Tous les modèles",
  homeNewsLabel: "Salons, événements, nouveautés",
  homeNewsTitle: "Actualités",
  homeAllNews: "Toutes les actualités",

  cardLength: "Longueur",
  cardBeam: "Largeur",
  cardCabins: "Cabines",
  cardPersons: "Personnes",

  modelsTitle: "Modèles de bateaux",
  modelsLead:
    "Aperçu des modèles disponibles chez Marinero. Choisissez un modèle, consultez les détails et demandez une offre.",
  filtersLabel: "Filtres",
  findModel: "Trouver un modèle",
  archiveLink: "Archives des modèles",
  fieldBrand: "Marque",
  allBrandsOption: "Toutes les marques",
  fieldSeries: "Série",
  allSeriesOption: "Toutes les séries",
  searchButton: "Rechercher",
  resultsLabel: "Résultats",
  inCatalog: "au catalogue",
  clearFilter: "Effacer les filtres",

  archiveTitle: "Archives des modèles",
  archiveLead: "Modèles qui ne sont plus produits et qui figuraient auparavant chez Marinero.",
  archiveBadge: "Production arrêtée",

  boatsTitle: "Bateaux",
  boatsLead: "Modèles disponibles chez Marinero, par marque et par série.",
  brandLabel: "Marque",
  brandModelsLead: "Modèles disponibles chez Marinero.",

  galleryTitle: "Galerie",
  photosWord: "photos",
  showMorePhotos: "Voir plus de photos",
  showLess: "Afficher moins",
  descriptionTitle: "Description",
  specificationTitle: "Caractéristiques",
  requestSpec: "Demander la fiche complète",
  askOffer: "Demander une offre",
  configuratorTitle: "Configurateur",
  otherModels: "Autres modèles proposés",
  modelCtaTitle: "Vous souhaitez en savoir plus sur ce modèle ?",
  modelCtaLead:
    "Écrivez-nous ou appelez-nous — nous préparerons une offre et vous conseillerons sur les équipements et les délais.",
  basePriceLabel: "Prix de base HT",
  seriesLabel: "Série",

  newsTitle: "Actualités",
  newsLead:
    "Où nous rencontrer, les nouveautés de nos marques et les modèles qui arrivent.",
  newsLabel: "Salons, événements, nouveautés",
  newsEmpty: "Aucune actualité publiée pour le moment.",
  newsReadMore: "Lire la suite",

  cfgBaseIncludes: "Ce que comprend le prix de base",
  cfgStandardEquipment: "Équipement de série",
  cfgExpand: "Déplier",
  cfgCollapse: "Replier",
  cfgExtraOptions: "Équipements optionnels",
  cfgSelected: "sélectionné(s)",
  cfgContactData: "Coordonnées",
  cfgName: "Nom et prénom",
  cfgEmail: "Adresse e-mail *",
  cfgPhone: "Téléphone",
  cfgNotes: "Remarques, date d'achat, zone de navigation",
  cfgPreparedBy: "Offre préparée par",
  cfgTeam: "Équipe Marinero",
  cfgPreparedByHint:
    "Détermine le pied de page et la signature de l'offre PDF ainsi que l'adresse de réponse de l'e-mail.",
  cfgCalculator: "Calculateur de prix",
  cfgBasePrice: "Prix de base",
  cfgOptions: "Options",
  cfgNetTotal: "Total HT",
  cfgRate: "Taux",
  cfgGrossPln: "Total TTC PLN (TVA 23%)",
  cfgChosenOptions: "Options choisies",
  cfgNoOptions: "Aucune option choisie",
  cfgSubmit: "Envoyer la demande et le PDF",
  cfgSending: "Envoi en cours...",
  cfgMissingEmail: "Veuillez indiquer l'adresse e-mail du client.",
  cfgSavedNoSmtp:
    "La demande a été enregistrée dans le panneau d'administration. L'envoi d'e-mails nécessite encore une configuration SMTP.",
  cfgSavedSent: "La demande a été enregistrée et l'offre PDF a été envoyée par e-mail.",
  cfgUnavailable: "Configurateur en préparation",
  cfgUnavailableLead: "Aucun tarif n'est encore disponible pour ce modèle.",

    shopTitle: "Boutique",
  shopLead: "Moteurs, électronique et accessoires nautiques — livraison et retrait à Gdynia.",
  shopCategories: "Catégories",
  shopAllProducts: "Tous les produits",
  shopSearchPlaceholder: "Rechercher dans la boutique…",
  shopNoResults: "Aucun produit ne correspond à la recherche.",
  shopAddToCart: "Ajouter au panier",
  shopAdded: "Ajouté au panier",
  shopInCart: "Dans le panier",
  shopCart: "Panier",
  shopCartEmpty: "Votre panier est vide",
  shopCartEmptyLead: "Choisissez quelque chose dans notre offre — moteurs, électronique et accessoires.",
  shopContinue: "Continuer mes achats",
  shopQuantity: "Quantité",
  shopRemove: "Supprimer",
  shopSubtotal: "Sous-total",
  shopShipping: "Livraison",
  shopTotal: "Total",
  shopCheckout: "Passer la commande",
  shopOrderTitle: "Commande",
  shopCustomer: "Coordonnées",
  shopFirstName: "Prénom",
  shopLastName: "Nom",
  shopAddress: "Adresse",
  shopCity: "Ville",
  shopPostal: "Code postal",
  shopCountry: "Pays",
  shopDelivery: "Mode de livraison",
  shopPayment: "Paiement",
  shopPaymentLead: "Nous confirmons la commande par e-mail ; les coordonnées bancaires et la livraison sont convenues individuellement — nous vous contactons juste après la commande.",
    shopAnnouncement: "Service agréé Mercury et Suzuki · Expédition sous 24 h · Retrait à Gdynia",
  shopTrust1: "Concessionnaire agréé",
  shopTrust1Lead: "Pièces et électronique d’origine directement des fabricants.",
  shopTrust2: "Expédition sous 24 h",
  shopTrust2Lead: "Les articles en stock partent le jour même ou le jour ouvré suivant.",
  shopTrust3: "Conseil atelier",
  shopTrust3Lead: "Nous vous aidons à choisir les pièces et équipements pour votre bateau — appelez ou écrivez.",
  shopQuickAdd: "Ajouter",
  shopDescriptionTitle: "Description du produit",
    shopHeroTitle: "Tout ce dont votre bateau a besoin",
  shopHeroLead: "Moteurs hors-bord, électronique de navigation, pièces d’entretien et accessoires. Concessionnaire agréé Mercury, Suzuki, Garmin, Simrad et Fusion.",
  shopHeroCta: "Voir les produits",
  shopHeroSecondary: "Contacter l’atelier",
  shopPopular: "Les plus vendus",
  shopNewest: "Nouveautés",
  shopBrandsTitle: "Marques que nous vendons et entretenons",
  shopBrandsLead: "Du matériel directement des fabricants, avec garantie et le soutien de notre atelier.",
  shopBrowseAll: "Voir tous les produits",
  shopCategoriesLead: "Choisissez une catégorie et allez droit au matériel recherché.",
    shopStatsEyebrow: "Marinero depuis 2004",
  shopStatsTitle: "Du matériel que nous entretenons nous-mêmes",
  shopStatsLead: "Nous ne revendons pas un catalogue de grossiste. Chaque moteur, traceur et pièce passe par notre atelier à Gdynia — c’est pourquoi nous savons ce que nous recommandons.",
  shopStatsService: "Marques entretenues",
  shopContactTitle: "Vous hésitez ? Appelez notre atelier.",
  shopCollections: "Collections",
  shopFeatured: "Produits sélectionnés",
  shopViewCategory: "Voir la catégorie",
  shopPlaceOrder: "Valider la commande",
  shopOrderSending: "Envoi de la commande…",
  shopOrderDone: "Merci pour votre commande",
  shopOrderDoneLead: "Nous avons envoyé une confirmation à votre e-mail. Nous vous contacterons au sujet du paiement et de la livraison.",
  shopBackToShop: "Retour à la boutique",
  shopProducts: "produits",
  shopPrice: "Prix",
  shopSort: "Tri",
  shopSortNewest: "Les plus récents",
  shopSortPriceAsc: "Prix croissant",
  shopSortPriceDesc: "Prix décroissant",
  shopVariant: "Variante",
  shopStepCart: "Panier",
  shopStepData: "Coordonnées et livraison",
  shopStepDone: "Confirmation",
  shopSummary: "Récapitulatif",
  shopFree: "Offert",
  shopTax: "TVA 23%",
  shopNet: "Montant HT",
  shopVatIncluded: "Prix TTC (TVA 23%)",
  shopVatExcluded: "Prix HT — la TVA 23% est ajoutée au panier",
  shopAvailability: "Disponibilité",
  shopInStock: "Expédition immédiate",
  shopOnOrder: "Sur commande — nous confirmons le délai",
  shopShippingFast: "Expédition en 24 h ou retrait à Gdynia",
  shopWarranty: "Garantie",
  shopWarrantyValue: "Garantie constructeur, SAV à Gdynia",
  shopFamilyEyebrow: "Même série",
  shopFamilyTitle: "Autres versions de ce modèle",
  shopSpecsTitle: "Caractéristiques",
  shopInStockCount: "en stock : {n} pcs",
  shopFilters: "Filtres",
  shopBrandLabel: "Marque",
  shopFuel: "Type de moteur",
  shopPower: "Puissance",
  shopShaft: "Longueur d'arbre",
  shopControl: "Commande",
  shopFiltersClear: "Effacer les filtres",
  shopServiceTitle: "Planifier l'entretien",
  shopServiceEyebrow: "Pièces et accessoires",
  shopVatNote: "Tous les prix de la boutique sont TTC — TVA 23% incluse.",
  shopVatId: "Numéro de TVA (facultatif)",
  shopVatIdHint: "Entreprises de l'UE hors Pologne : indiquez votre numéro de TVA, la facture hors taxe sera émise après contact.",
  shopVatCheck: "Vérifier",
  shopVatChecking: "Vérification…",
  shopVatOk: "Numéro de TVA confirmé dans VIES — vente hors TVA",
  shopVatInvalid: "Ce numéro n'est pas dans le registre VIES. Vérifiez-le ou achetez avec TVA.",
  shopVatError: "Le registre VIES ne répond pas. Réessayez ou commandez avec TVA — nous corrigerons la facture.",
  shopVatRemoved: "TVA 23% retirée (autoliquidation)",
  shopNeedHelp: "Besoin d'aide pour choisir ?",
  shopNeedHelpLead: "Appelez ou écrivez — nous choisirons l'équipement adapté à votre bateau.",

  footerCompany: "Société",
  footerBrands: "Marques",
  footerContact: "Contact",
  footerServices: "Services",
  footerPrivacy: "Politique de confidentialité",
}

const ru: Dictionary = {
  navBrands: "Бренды",
  navBoats: "Лодки",
  navModels: "Модели",
  navShop: "Магазин",
  navNews: "Новости",
  navContact: "Контакты",
  navCall: "Позвонить",

  searchPlaceholder: "Поиск модели…",
  searchEmpty: "Подходящих моделей не найдено",

  homeHeroTitle: "Лодки, моторы и готовые коммерческие предложения.",
  homeHeroLead:
    "Marinero представляет модели лодок, помогает подобрать оснащение и подготовить предложение для клиента.",
  homeSeeModels: "Смотреть модели",
  homeDealerLabel: "Официальный дилер",
  homeBrandsTitle: "Бренды в ассортименте",
  homeAllBrands: "Все бренды",
  homeFeaturedLabel: "Рекомендуем",
  homeFeaturedTitle: "Избранные модели",
  homeAllModels: "Все модели",
  homeNewsLabel: "Выставки, события, премьеры",
  homeNewsTitle: "Новости",
  homeAllNews: "Все новости",

  cardLength: "Длина",
  cardBeam: "Ширина",
  cardCabins: "Каюты",
  cardPersons: "Человек",

  modelsTitle: "Модели лодок",
  modelsLead:
    "Обзор моделей, доступных в Marinero. Выберите модель, изучите детали и запросите расчёт.",
  filtersLabel: "Фильтры",
  findModel: "Найти модель",
  archiveLink: "Архив моделей",
  fieldBrand: "Бренд",
  allBrandsOption: "Все бренды",
  fieldSeries: "Серия",
  allSeriesOption: "Все серии",
  searchButton: "Искать",
  resultsLabel: "Результаты",
  inCatalog: "в каталоге",
  clearFilter: "Сбросить фильтры",

  archiveTitle: "Архив моделей",
  archiveLead: "Снятые с производства модели, которые раньше были в ассортименте Marinero.",
  archiveBadge: "Снята с производства",

  boatsTitle: "Лодки",
  boatsLead: "Модели, доступные в Marinero, по брендам и сериям.",
  brandLabel: "Бренд",
  brandModelsLead: "Модели, доступные в Marinero.",

  galleryTitle: "Галерея",
  photosWord: "фото",
  showMorePhotos: "Показать больше фото",
  showLess: "Свернуть",
  descriptionTitle: "Описание",
  specificationTitle: "Технические данные",
  requestSpec: "Запросить полную спецификацию",
  askOffer: "Запросить предложение",
  configuratorTitle: "Конфигуратор",
  otherModels: "Другие модели в ассортименте",
  modelCtaTitle: "Хотите узнать больше об этой модели?",
  modelCtaLead:
    "Напишите или позвоните — мы подготовим расчёт и подскажем по оснащению и срокам поставки.",
  basePriceLabel: "Базовая цена без НДС",
  seriesLabel: "Серия",

  newsTitle: "Новости",
  newsLead: "Где нас встретить, что нового у наших брендов и какие модели выходят на рынок.",
  newsLabel: "Выставки, события, премьеры",
  newsEmpty: "Опубликованных новостей пока нет.",
  newsReadMore: "Читать далее",

  cfgBaseIncludes: "Что входит в базовую цену",
  cfgStandardEquipment: "Стандартное оснащение",
  cfgExpand: "Развернуть",
  cfgCollapse: "Свернуть",
  cfgExtraOptions: "Дополнительное оснащение",
  cfgSelected: "выбрано",
  cfgContactData: "Контактные данные",
  cfgName: "Имя и фамилия",
  cfgEmail: "Адрес e-mail *",
  cfgPhone: "Телефон",
  cfgNotes: "Примечания, срок покупки, район эксплуатации",
  cfgPreparedBy: "Предложение готовит",
  cfgTeam: "Команда Marinero",
  cfgPreparedByHint:
    "Определяет нижний колонтитул и подпись в PDF-предложении, а также адрес для ответа в письме.",
  cfgCalculator: "Калькулятор цены",
  cfgBasePrice: "Базовая цена",
  cfgOptions: "Опции",
  cfgNetTotal: "Итого без НДС",
  cfgRate: "Курс",
  cfgGrossPln: "Итого с НДС, PLN (23%)",
  cfgChosenOptions: "Выбранные опции",
  cfgNoOptions: "Опции не выбраны",
  cfgSubmit: "Отправить запрос и PDF",
  cfgSending: "Отправка...",
  cfgMissingEmail: "Укажите адрес e-mail клиента.",
  cfgSavedNoSmtp:
    "Запрос сохранён в панели администратора. Для отправки писем требуется настройка SMTP.",
  cfgSavedSent: "Запрос сохранён, PDF-предложение отправлено по электронной почте.",
  cfgUnavailable: "Конфигуратор в подготовке",
  cfgUnavailableLead: "Для этой модели пока нет прайс-листа.",

    shopTitle: "Магазин",
  shopLead: "Двигатели, электроника и аксессуары для катеров — доставка и самовывоз в Гдыне.",
  shopCategories: "Категории",
  shopAllProducts: "Все товары",
  shopSearchPlaceholder: "Поиск в магазине…",
  shopNoResults: "Товары по запросу не найдены.",
  shopAddToCart: "В корзину",
  shopAdded: "Добавлено в корзину",
  shopInCart: "В корзине",
  shopCart: "Корзина",
  shopCartEmpty: "Ваша корзина пуста",
  shopCartEmptyLead: "Выберите что-нибудь из нашего ассортимента — двигатели, электроника и аксессуары.",
  shopContinue: "Продолжить покупки",
  shopQuantity: "Количество",
  shopRemove: "Удалить",
  shopSubtotal: "Сумма товаров",
  shopShipping: "Доставка",
  shopTotal: "Итого",
  shopCheckout: "Перейти к оформлению",
  shopOrderTitle: "Оформление заказа",
  shopCustomer: "Данные покупателя",
  shopFirstName: "Имя",
  shopLastName: "Фамилия",
  shopAddress: "Адрес",
  shopCity: "Город",
  shopPostal: "Почтовый индекс",
  shopCountry: "Страна",
  shopDelivery: "Способ доставки",
  shopPayment: "Оплата",
  shopPaymentLead: "Заказ подтверждаем по электронной почте, реквизиты для оплаты и доставку согласуем индивидуально — свяжемся с вами сразу после оформления.",
    shopAnnouncement: "Официальный сервис Mercury и Suzuki · Отправка за 24 ч · Самовывоз в Гдыне",
  shopTrust1: "Официальный дилер",
  shopTrust1Lead: "Оригинальные запчасти и электроника напрямую от производителей.",
  shopTrust2: "Отправка за 24 ч",
  shopTrust2Lead: "Товары со склада отправляем в тот же или следующий рабочий день.",
  shopTrust3: "Консультация сервиса",
  shopTrust3Lead: "Поможем подобрать запчасти и оснастку для вашей лодки — позвоните или напишите.",
  shopQuickAdd: "В корзину",
  shopDescriptionTitle: "Описание товара",
    shopHeroTitle: "Всё, что нужно вашей лодке",
  shopHeroLead: "Подвесные моторы, навигационная электроника, сервисные запчасти и аксессуары. Официальный дилер Mercury, Suzuki, Garmin, Simrad и Fusion.",
  shopHeroCta: "Смотреть товары",
  shopHeroSecondary: "Связаться с сервисом",
  shopPopular: "Чаще всего покупают",
  shopNewest: "Новинки магазина",
  shopBrandsTitle: "Бренды, которые мы продаём и обслуживаем",
  shopBrandsLead: "Оборудование напрямую от производителей, с гарантией и поддержкой нашего сервиса.",
  shopBrowseAll: "Смотреть все товары",
  shopCategoriesLead: "Выберите категорию и переходите сразу к нужному оборудованию.",
    shopStatsEyebrow: "Marinero с 2004 года",
  shopStatsTitle: "Техника, которую мы сами обслуживаем",
  shopStatsLead: "Мы не перепродаём каталог оптовика. Каждый мотор, картплоттер и деталь проходит через наш сервис в Гдыне — поэтому мы знаем, что рекомендуем.",
  shopStatsService: "Бренды в сервисе",
  shopContactTitle: "Не знаете, что выбрать? Позвоните в сервис.",
  shopCollections: "Коллекции",
  shopFeatured: "Избранные товары",
  shopViewCategory: "Смотреть категорию",
  shopPlaceOrder: "Оформить заказ",
  shopOrderSending: "Оформляем заказ…",
  shopOrderDone: "Спасибо за заказ",
  shopOrderDoneLead: "Подтверждение отправлено на вашу почту. Мы свяжемся с вами по оплате и доставке.",
  shopBackToShop: "Вернуться в магазин",
  shopProducts: "товаров",
  shopPrice: "Цена",
  shopSort: "Сортировка",
  shopSortNewest: "Новинки",
  shopSortPriceAsc: "Цена по возрастанию",
  shopSortPriceDesc: "Цена по убыванию",
  shopVariant: "Вариант",
  shopStepCart: "Корзина",
  shopStepData: "Данные и доставка",
  shopStepDone: "Подтверждение",
  shopSummary: "Итого",
  shopFree: "Бесплатно",
  shopTax: "НДС 23%",
  shopNet: "Сумма нетто",
  shopVatIncluded: "Цена включает НДС 23%",
  shopVatExcluded: "Цена нетто — НДС 23% добавляется в корзине",
  shopAvailability: "Наличие",
  shopInStock: "Отправляем сразу",
  shopOnOrder: "Под заказ — подтвердим срок",
  shopShippingFast: "Отправка за 24 ч или самовывоз в Гдыне",
  shopWarranty: "Гарантия",
  shopWarrantyValue: "Гарантия производителя, сервис в Гдыне",
  shopFamilyEyebrow: "Та же серия",
  shopFamilyTitle: "Другие версии этой модели",
  shopSpecsTitle: "Технические данные",
  shopInStockCount: "на складе: {n} шт.",
  shopFilters: "Фильтры",
  shopBrandLabel: "Бренд",
  shopFuel: "Тип двигателя",
  shopPower: "Мощность",
  shopShaft: "Длина дейдвуда",
  shopControl: "Управление",
  shopFiltersClear: "Сбросить фильтры",
  shopServiceTitle: "Запланируйте сервис",
  shopServiceEyebrow: "Запчасти и аксессуары",
  shopVatNote: "Все цены в магазине — с НДС 23%.",
  shopVatId: "НДС / VAT ЕС (необязательно)",
  shopVatIdHint: "Компании из ЕС вне Польши: укажите номер VAT, счёт без НДС выставим после связи с вами.",
  shopVatCheck: "Проверить",
  shopVatChecking: "Проверяю…",
  shopVatOk: "Номер VAT подтверждён в реестре VIES — продажа без НДС",
  shopVatInvalid: "Этого номера нет в реестре VIES. Проверьте запись или купите с НДС.",
  shopVatError: "Реестр VIES не отвечает. Попробуйте позже или закажите с НДС — исправим счёт.",
  shopVatRemoved: "НДС 23% снят (обратное начисление)",
  shopNeedHelp: "Нужна помощь с выбором?",
  shopNeedHelpLead: "Позвоните или напишите — подберём оборудование для вашей лодки.",

  footerCompany: "Компания",
  footerBrands: "Бренды",
  footerContact: "Контакты",
  footerServices: "Услуги",
  footerPrivacy: "Политика конфиденциальности",
}

const uk: Dictionary = {
  navBrands: "Бренди",
  navBoats: "Човни",
  navModels: "Моделі",
  navShop: "Магазин",
  navNews: "Новини",
  navContact: "Контакти",
  navCall: "Зателефонувати",

  searchPlaceholder: "Пошук моделі…",
  searchEmpty: "Моделей за запитом не знайдено",

  homeHeroTitle: "Човни, двигуни та готові комерційні пропозиції.",
  homeHeroLead:
    "Marinero представляє моделі човнів, допомагає підібрати обладнання та підготувати пропозицію для клієнта.",
  homeSeeModels: "Переглянути моделі",
  homeDealerLabel: "Офіційний дилер",
  homeBrandsTitle: "Бренди в асортименті",
  homeAllBrands: "Усі бренди",
  homeFeaturedLabel: "Рекомендовані",
  homeFeaturedTitle: "Вибрані моделі",
  homeAllModels: "Усі моделі",
  homeNewsLabel: "Виставки, події, прем'єри",
  homeNewsTitle: "Новини",
  homeAllNews: "Усі новини",

  cardLength: "Довжина",
  cardBeam: "Ширина",
  cardCabins: "Каюти",
  cardPersons: "Осіб",

  modelsTitle: "Моделі човнів",
  modelsLead:
    "Огляд моделей, доступних у Marinero. Оберіть модель, перегляньте деталі та запитайте розрахунок.",
  filtersLabel: "Фільтри",
  findModel: "Знайти модель",
  archiveLink: "Архів моделей",
  fieldBrand: "Бренд",
  allBrandsOption: "Усі бренди",
  fieldSeries: "Серія",
  allSeriesOption: "Усі серії",
  searchButton: "Шукати",
  resultsLabel: "Результати",
  inCatalog: "у каталозі",
  clearFilter: "Скинути фільтри",

  archiveTitle: "Архів моделей",
  archiveLead: "Зняті з виробництва моделі, які раніше були в асортименті Marinero.",
  archiveBadge: "Знято з виробництва",

  boatsTitle: "Човни",
  boatsLead: "Моделі, доступні в Marinero, за брендами та серіями.",
  brandLabel: "Бренд",
  brandModelsLead: "Моделі, доступні в Marinero.",

  galleryTitle: "Галерея",
  photosWord: "фото",
  showMorePhotos: "Показати більше фото",
  showLess: "Згорнути",
  descriptionTitle: "Опис",
  specificationTitle: "Технічні дані",
  requestSpec: "Запитати повну специфікацію",
  askOffer: "Запитати пропозицію",
  configuratorTitle: "Конфігуратор",
  otherModels: "Інші моделі в асортименті",
  modelCtaTitle: "Хочете дізнатися більше про цю модель?",
  modelCtaLead:
    "Напишіть або зателефонуйте — ми підготуємо розрахунок і порадимо щодо обладнання та термінів постачання.",
  basePriceLabel: "Базова ціна без ПДВ",
  seriesLabel: "Серія",

  newsTitle: "Новини",
  newsLead: "Де нас зустріти, що нового у наших брендів і які моделі виходять на ринок.",
  newsLabel: "Виставки, події, прем'єри",
  newsEmpty: "Опублікованих новин поки немає.",
  newsReadMore: "Читати далі",

  cfgBaseIncludes: "Що входить у базову ціну",
  cfgStandardEquipment: "Стандартне обладнання",
  cfgExpand: "Розгорнути",
  cfgCollapse: "Згорнути",
  cfgExtraOptions: "Додаткове обладнання",
  cfgSelected: "обрано",
  cfgContactData: "Контактні дані",
  cfgName: "Ім'я та прізвище",
  cfgEmail: "Адреса e-mail *",
  cfgPhone: "Телефон",
  cfgNotes: "Примітки, термін купівлі, район експлуатації",
  cfgPreparedBy: "Пропозицію готує",
  cfgTeam: "Команда Marinero",
  cfgPreparedByHint:
    "Визначає нижній колонтитул і підпис у PDF-пропозиції та адресу для відповіді в листі.",
  cfgCalculator: "Калькулятор ціни",
  cfgBasePrice: "Базова ціна",
  cfgOptions: "Опції",
  cfgNetTotal: "Разом без ПДВ",
  cfgRate: "Курс",
  cfgGrossPln: "Разом з ПДВ, PLN (23%)",
  cfgChosenOptions: "Обрані опції",
  cfgNoOptions: "Опції не обрано",
  cfgSubmit: "Надіслати запит і PDF",
  cfgSending: "Надсилаю...",
  cfgMissingEmail: "Вкажіть адресу e-mail клієнта.",
  cfgSavedNoSmtp:
    "Запит збережено в панелі адміністратора. Для надсилання листів потрібне налаштування SMTP.",
  cfgSavedSent: "Запит збережено, PDF-пропозицію надіслано електронною поштою.",
  cfgUnavailable: "Конфігуратор у підготовці",
  cfgUnavailableLead: "Для цієї моделі поки немає прайс-листа.",

    shopTitle: "Магазин",
  shopLead: "Двигуни, електроніка та аксесуари для катерів — доставка і самовивіз у Гдині.",
  shopCategories: "Категорії",
  shopAllProducts: "Усі товари",
  shopSearchPlaceholder: "Пошук у магазині…",
  shopNoResults: "Товарів за запитом не знайдено.",
  shopAddToCart: "У кошик",
  shopAdded: "Додано до кошика",
  shopInCart: "У кошику",
  shopCart: "Кошик",
  shopCartEmpty: "Ваш кошик порожній",
  shopCartEmptyLead: "Оберіть щось із нашого асортименту — двигуни, електроніка та аксесуари.",
  shopContinue: "Продовжити покупки",
  shopQuantity: "Кількість",
  shopRemove: "Видалити",
  shopSubtotal: "Сума товарів",
  shopShipping: "Доставка",
  shopTotal: "Разом",
  shopCheckout: "Перейти до оформлення",
  shopOrderTitle: "Оформлення замовлення",
  shopCustomer: "Дані замовника",
  shopFirstName: "Ім’я",
  shopLastName: "Прізвище",
  shopAddress: "Адреса",
  shopCity: "Місто",
  shopPostal: "Поштовий індекс",
  shopCountry: "Країна",
  shopDelivery: "Спосіб доставки",
  shopPayment: "Оплата",
  shopPaymentLead: "Замовлення підтверджуємо електронною поштою, реквізити для оплати й доставку узгоджуємо індивідуально — зв’яжемося з вами одразу після оформлення.",
    shopAnnouncement: "Офіційний сервіс Mercury і Suzuki · Відправлення за 24 год · Самовивіз у Гдині",
  shopTrust1: "Офіційний дилер",
  shopTrust1Lead: "Оригінальні запчастини та електроніка напряму від виробників.",
  shopTrust2: "Відправлення за 24 год",
  shopTrust2Lead: "Товари зі складу відправляємо того самого або наступного робочого дня.",
  shopTrust3: "Консультація сервісу",
  shopTrust3Lead: "Допоможемо підібрати запчастини й оснащення для вашого човна — зателефонуйте або напишіть.",
  shopQuickAdd: "У кошик",
  shopDescriptionTitle: "Опис товару",
    shopHeroTitle: "Усе, що потрібно вашому човну",
  shopHeroLead: "Підвісні мотори, навігаційна електроніка, сервісні запчастини та аксесуари. Офіційний дилер Mercury, Suzuki, Garmin, Simrad і Fusion.",
  shopHeroCta: "Дивитися товари",
  shopHeroSecondary: "Звʼязатися із сервісом",
  shopPopular: "Найчастіше купують",
  shopNewest: "Новинки магазину",
  shopBrandsTitle: "Бренди, які ми продаємо й обслуговуємо",
  shopBrandsLead: "Обладнання напряму від виробників, з гарантією та підтримкою нашого сервісу.",
  shopBrowseAll: "Дивитися всі товари",
  shopCategoriesLead: "Оберіть категорію та переходьте одразу до потрібного обладнання.",
    shopStatsEyebrow: "Marinero з 2004 року",
  shopStatsTitle: "Техніка, яку ми самі обслуговуємо",
  shopStatsLead: "Ми не перепродаємо каталог оптовика. Кожен мотор, картплотер і деталь проходить через наш сервіс у Гдині — тому ми знаємо, що рекомендуємо.",
  shopStatsService: "Бренди в сервісі",
  shopContactTitle: "Не знаєте, що обрати? Зателефонуйте в сервіс.",
  shopCollections: "Колекції",
  shopFeatured: "Вибрані товари",
  shopViewCategory: "Дивитися категорію",
  shopPlaceOrder: "Оформити замовлення",
  shopOrderSending: "Оформлюємо замовлення…",
  shopOrderDone: "Дякуємо за замовлення",
  shopOrderDoneLead: "Підтвердження надіслано на вашу пошту. Ми зв’яжемося щодо оплати та доставки.",
  shopBackToShop: "Повернутися до магазину",
  shopProducts: "товарів",
  shopPrice: "Ціна",
  shopSort: "Сортування",
  shopSortNewest: "Найновіші",
  shopSortPriceAsc: "Ціна за зростанням",
  shopSortPriceDesc: "Ціна за спаданням",
  shopVariant: "Варіант",
  shopStepCart: "Кошик",
  shopStepData: "Дані та доставка",
  shopStepDone: "Підтвердження",
  shopSummary: "Разом",
  shopFree: "Безкоштовно",
  shopTax: "ПДВ 23%",
  shopNet: "Сума нетто",
  shopVatIncluded: "Ціна включає ПДВ 23%",
  shopVatExcluded: "Ціна нетто — ПДВ 23% додається в кошику",
  shopAvailability: "Наявність",
  shopInStock: "Відправляємо одразу",
  shopOnOrder: "На замовлення — підтвердимо термін",
  shopShippingFast: "Відправка за 24 год або самовивіз у Гдині",
  shopWarranty: "Гарантія",
  shopWarrantyValue: "Гарантія виробника, сервіс у Гдині",
  shopFamilyEyebrow: "Та сама серія",
  shopFamilyTitle: "Інші версії цієї моделі",
  shopSpecsTitle: "Технічні дані",
  shopInStockCount: "на складі: {n} шт.",
  shopFilters: "Фільтри",
  shopBrandLabel: "Бренд",
  shopFuel: "Тип двигателя",
  shopPower: "Мощность",
  shopShaft: "Длина дейдвуда",
  shopControl: "Управление",
  shopFiltersClear: "Скинути фільтри",
  shopServiceTitle: "Заплануйте сервіс",
  shopServiceEyebrow: "Запчастини та аксесуари",
  shopVatNote: "Усі ціни в магазині — з ПДВ 23%.",
  shopVatId: "ПДВ / VAT ЄС (необовʼязково)",
  shopVatIdHint: "Компанії з ЄС поза Польщею: вкажіть номер VAT, рахунок без ПДВ виставимо після звʼязку з вами.",
  shopVatCheck: "Перевірити",
  shopVatChecking: "Перевіряю…",
  shopVatOk: "Номер VAT підтверджено в реєстрі VIES — продаж без ПДВ",
  shopVatInvalid: "Цього номера немає в реєстрі VIES. Перевірте запис або купіть із ПДВ.",
  shopVatError: "Реєстр VIES не відповідає. Спробуйте пізніше або замовте з ПДВ — виправимо рахунок.",
  shopVatRemoved: "ПДВ 23% знято (зворотне нарахування)",
  shopNeedHelp: "Потрібна допомога з вибором?",
  shopNeedHelpLead: "Зателефонуйте або напишіть — підберемо обладнання для вашого човна.",

  footerCompany: "Компанія",
  footerBrands: "Бренди",
  footerContact: "Контакти",
  footerServices: "Послуги",
  footerPrivacy: "Політика конфіденційності",
}

const it: Dictionary = {
  navBrands: "Marchi",
  navBoats: "Barche",
  navModels: "Modelli",
  navShop: "Shop",
  navNews: "Novità",
  navContact: "Contatti",
  navCall: "Chiama",

  searchPlaceholder: "Cerca un modello…",
  searchEmpty: "Nessun modello corrisponde alla ricerca",

  homeHeroTitle: "Barche, motori e preventivi pronti da inviare.",
  homeHeroLead:
    "Marinero presenta i modelli di barche, permette di scegliere gli allestimenti e di preparare un'offerta per il cliente.",
  homeSeeModels: "Vedi i modelli",
  homeDealerLabel: "Concessionario autorizzato",
  homeBrandsTitle: "Marchi trattati",
  homeAllBrands: "Tutti i marchi",
  homeFeaturedLabel: "In evidenza",
  homeFeaturedTitle: "Modelli selezionati",
  homeAllModels: "Tutti i modelli",
  homeNewsLabel: "Fiere, eventi, anteprime",
  homeNewsTitle: "Novità",
  homeAllNews: "Tutte le novità",

  cardLength: "Lunghezza",
  cardBeam: "Larghezza",
  cardCabins: "Cabine",
  cardPersons: "Persone",

  modelsTitle: "Modelli di barche",
  modelsLead:
    "Panoramica dei modelli disponibili da Marinero. Scegli un modello, controlla i dettagli e richiedi un preventivo.",
  filtersLabel: "Filtri",
  findModel: "Trova un modello",
  archiveLink: "Archivio modelli",
  fieldBrand: "Marchio",
  allBrandsOption: "Tutti i marchi",
  fieldSeries: "Serie",
  allSeriesOption: "Tutte le serie",
  searchButton: "Cerca",
  resultsLabel: "Risultati",
  inCatalog: "in catalogo",
  clearFilter: "Azzera i filtri",

  archiveTitle: "Archivio modelli",
  archiveLead: "Modelli fuori produzione che facevano parte della gamma Marinero.",
  archiveBadge: "Fuori produzione",

  boatsTitle: "Barche",
  boatsLead: "Modelli disponibili da Marinero, per marchio e serie.",
  brandLabel: "Marchio",
  brandModelsLead: "Modelli disponibili da Marinero.",

  galleryTitle: "Galleria",
  photosWord: "foto",
  showMorePhotos: "Vedi altre foto",
  showLess: "Mostra meno",
  descriptionTitle: "Descrizione",
  specificationTitle: "Scheda tecnica",
  requestSpec: "Richiedi la scheda completa",
  askOffer: "Richiedi un preventivo",
  configuratorTitle: "Configuratore",
  otherModels: "Altri modelli in gamma",
  modelCtaTitle: "Vuoi saperne di più su questo modello?",
  modelCtaLead:
    "Scrivici o chiamaci — prepareremo un preventivo e ti consiglieremo su allestimenti e tempi di consegna.",
  basePriceLabel: "Prezzo base netto",
  seriesLabel: "Serie",

  newsTitle: "Novità",
  newsLead: "Dove incontrarci, le novità dei nostri marchi e i modelli in arrivo.",
  newsLabel: "Fiere, eventi, anteprime",
  newsEmpty: "Non ci sono ancora notizie pubblicate.",
  newsReadMore: "Continua a leggere",

  cfgBaseIncludes: "Cosa comprende il prezzo base",
  cfgStandardEquipment: "Allestimento di serie",
  cfgExpand: "Espandi",
  cfgCollapse: "Comprimi",
  cfgExtraOptions: "Allestimenti opzionali",
  cfgSelected: "selezionati",
  cfgContactData: "Dati di contatto",
  cfgName: "Nome e cognome",
  cfgEmail: "Indirizzo e-mail *",
  cfgPhone: "Telefono",
  cfgNotes: "Note, tempi di acquisto, zona di utilizzo",
  cfgPreparedBy: "Preventivo preparato da",
  cfgTeam: "Team Marinero",
  cfgPreparedByHint:
    "Determina il piè di pagina e la firma nel preventivo PDF e l'indirizzo di risposta dell'e-mail.",
  cfgCalculator: "Calcolatore prezzo",
  cfgBasePrice: "Prezzo base",
  cfgOptions: "Opzioni",
  cfgNetTotal: "Totale netto",
  cfgRate: "Cambio",
  cfgGrossPln: "Totale lordo PLN (IVA 23%)",
  cfgChosenOptions: "Opzioni scelte",
  cfgNoOptions: "Nessuna opzione scelta",
  cfgSubmit: "Invia richiesta e PDF",
  cfgSending: "Invio in corso...",
  cfgMissingEmail: "Inserisci l'indirizzo e-mail del cliente.",
  cfgSavedNoSmtp:
    "La richiesta è stata salvata nel pannello di amministrazione. L'invio delle e-mail richiede ancora la configurazione SMTP.",
  cfgSavedSent: "La richiesta è stata salvata e il preventivo PDF è stato inviato via e-mail.",
  cfgUnavailable: "Configuratore in preparazione",
  cfgUnavailableLead: "Per questo modello non è ancora disponibile un listino.",

    shopTitle: "Shop",
  shopLead: "Motori, elettronica e accessori nautici — spedizione e ritiro a Gdynia.",
  shopCategories: "Categorie",
  shopAllProducts: "Tutti i prodotti",
  shopSearchPlaceholder: "Cerca nello shop…",
  shopNoResults: "Nessun prodotto corrisponde alla ricerca.",
  shopAddToCart: "Aggiungi al carrello",
  shopAdded: "Aggiunto al carrello",
  shopInCart: "Nel carrello",
  shopCart: "Carrello",
  shopCartEmpty: "Il tuo carrello è vuoto",
  shopCartEmptyLead: "Scegli qualcosa dalla nostra offerta — motori, elettronica e accessori.",
  shopContinue: "Continua lo shopping",
  shopQuantity: "Quantità",
  shopRemove: "Rimuovi",
  shopSubtotal: "Subtotale",
  shopShipping: "Spedizione",
  shopTotal: "Totale",
  shopCheckout: "Vai alla cassa",
  shopOrderTitle: "Ordine",
  shopCustomer: "Dati del cliente",
  shopFirstName: "Nome",
  shopLastName: "Cognome",
  shopAddress: "Indirizzo",
  shopCity: "Città",
  shopPostal: "Codice postale",
  shopCountry: "Paese",
  shopDelivery: "Modalità di consegna",
  shopPayment: "Pagamento",
  shopPaymentLead: "Confermiamo l’ordine via e-mail; i dati per il bonifico e la consegna vengono concordati individualmente — ti contattiamo subito dopo l’ordine.",
    shopAnnouncement: "Assistenza autorizzata Mercury e Suzuki · Spedizione in 24 h · Ritiro a Gdynia",
  shopTrust1: "Concessionario autorizzato",
  shopTrust1Lead: "Ricambi ed elettronica originali direttamente dai produttori.",
  shopTrust2: "Spedizione in 24 h",
  shopTrust2Lead: "Gli articoli disponibili partono lo stesso giorno o il giorno lavorativo successivo.",
  shopTrust3: "Consulenza service",
  shopTrust3Lead: "Ti aiutiamo a scegliere ricambi e accessori per la tua barca — chiama o scrivi.",
  shopQuickAdd: "Aggiungi",
  shopDescriptionTitle: "Descrizione prodotto",
    shopHeroTitle: "Tutto ciò di cui la tua barca ha bisogno",
  shopHeroLead: "Motori fuoribordo, elettronica di navigazione, ricambi e accessori. Concessionario autorizzato Mercury, Suzuki, Garmin, Simrad e Fusion.",
  shopHeroCta: "Vedi i prodotti",
  shopHeroSecondary: "Contatta il service",
  shopPopular: "I più venduti",
  shopNewest: "Novità nello shop",
  shopBrandsTitle: "Marchi che vendiamo e assistiamo",
  shopBrandsLead: "Attrezzatura direttamente dai produttori, con garanzia e il supporto del nostro service.",
  shopBrowseAll: "Vedi tutti i prodotti",
  shopCategoriesLead: "Scegli una categoria e vai dritto all’attrezzatura che cerchi.",
    shopStatsEyebrow: "Marinero dal 2004",
  shopStatsTitle: "Attrezzatura che assistiamo noi stessi",
  shopStatsLead: "Non rivendiamo il catalogo di un grossista. Ogni motore, chartplotter e ricambio passa dalla nostra officina di Gdynia — per questo sappiamo cosa consigliamo.",
  shopStatsService: "Marchi assistiti",
  shopContactTitle: "Non sai cosa scegliere? Chiama il nostro service.",
  shopCollections: "Collezioni",
  shopFeatured: "Prodotti selezionati",
  shopViewCategory: "Vedi la categoria",
  shopPlaceOrder: "Invia ordine",
  shopOrderSending: "Invio ordine…",
  shopOrderDone: "Grazie per il tuo ordine",
  shopOrderDoneLead: "Abbiamo inviato la conferma alla tua e-mail. Ti contatteremo per pagamento e consegna.",
  shopBackToShop: "Torna allo shop",
  shopProducts: "prodotti",
  shopPrice: "Prezzo",
  shopSort: "Ordinamento",
  shopSortNewest: "Più recenti",
  shopSortPriceAsc: "Prezzo crescente",
  shopSortPriceDesc: "Prezzo decrescente",
  shopVariant: "Variante",
  shopStepCart: "Carrello",
  shopStepData: "Dati e consegna",
  shopStepDone: "Conferma",
  shopSummary: "Riepilogo",
  shopFree: "Gratis",
  shopTax: "IVA 23%",
  shopNet: "Importo netto",
  shopVatIncluded: "Prezzo IVA 23% inclusa",
  shopVatExcluded: "Prezzo netto — l'IVA 23% viene aggiunta nel carrello",
  shopAvailability: "Disponibilità",
  shopInStock: "Spedizione immediata",
  shopOnOrder: "Su ordinazione — confermiamo i tempi",
  shopShippingFast: "Spedizione in 24 h o ritiro a Gdynia",
  shopWarranty: "Garanzia",
  shopWarrantyValue: "Garanzia del produttore, assistenza a Gdynia",
  shopFamilyEyebrow: "Stessa serie",
  shopFamilyTitle: "Altre versioni di questo modello",
  shopSpecsTitle: "Dati tecnici",
  shopInStockCount: "in magazzino: {n} pz",
  shopFilters: "Filtri",
  shopBrandLabel: "Marca",
  shopFuel: "Tipo di motore",
  shopPower: "Potenza",
  shopShaft: "Lunghezza gambo",
  shopControl: "Comando",
  shopFiltersClear: "Azzera i filtri",
  shopServiceTitle: "Pianifica il tagliando",
  shopServiceEyebrow: "Ricambi e accessori",
  shopVatNote: "Tutti i prezzi del negozio sono lordi — IVA 23% inclusa.",
  shopVatId: "Partita IVA (facoltativo)",
  shopVatIdHint: "Aziende UE fuori dalla Polonia: indica la partita IVA, la fattura senza IVA sarà emessa dopo il contatto.",
  shopVatCheck: "Verifica",
  shopVatChecking: "Verifico…",
  shopVatOk: "Partita IVA confermata nel registro VIES — vendita senza IVA",
  shopVatInvalid: "Questo numero non è nel registro VIES. Controllalo o acquista con IVA.",
  shopVatError: "Il registro VIES non risponde. Riprova o ordina con IVA — correggeremo la fattura.",
  shopVatRemoved: "IVA 23% rimossa (inversione contabile)",
  shopNeedHelp: "Hai bisogno di aiuto nella scelta?",
  shopNeedHelpLead: "Chiama o scrivi — sceglieremo l'attrezzatura adatta alla tua barca.",

  footerCompany: "Azienda",
  footerBrands: "Marchi",
  footerContact: "Contatti",
  footerServices: "Servizi",
  footerPrivacy: "Informativa sulla privacy",
}

const es: Dictionary = {
  navBrands: "Marcas",
  navBoats: "Embarcaciones",
  navModels: "Modelos",
  navShop: "Tienda",
  navNews: "Novedades",
  navContact: "Contacto",
  navCall: "Llamar",

  searchPlaceholder: "Buscar un modelo…",
  searchEmpty: "Ningún modelo coincide con la búsqueda",

  homeHeroTitle: "Embarcaciones, motores y ofertas listas para enviar.",
  homeHeroLead:
    "Marinero presenta sus modelos de embarcaciones, permite elegir el equipamiento y preparar una oferta para el cliente.",
  homeSeeModels: "Ver modelos",
  homeDealerLabel: "Concesionario oficial",
  homeBrandsTitle: "Marcas que representamos",
  homeAllBrands: "Todas las marcas",
  homeFeaturedLabel: "Destacados",
  homeFeaturedTitle: "Modelos seleccionados",
  homeAllModels: "Todos los modelos",
  homeNewsLabel: "Ferias, eventos, estrenos",
  homeNewsTitle: "Novedades",
  homeAllNews: "Todas las novedades",

  cardLength: "Eslora",
  cardBeam: "Manga",
  cardCabins: "Camarotes",
  cardPersons: "Personas",

  modelsTitle: "Modelos de embarcaciones",
  modelsLead:
    "Resumen de los modelos disponibles en Marinero. Elige un modelo, consulta los detalles y pide presupuesto.",
  filtersLabel: "Filtros",
  findModel: "Encuentra un modelo",
  archiveLink: "Archivo de modelos",
  fieldBrand: "Marca",
  allBrandsOption: "Todas las marcas",
  fieldSeries: "Serie",
  allSeriesOption: "Todas las series",
  searchButton: "Buscar",
  resultsLabel: "Resultados",
  inCatalog: "en el catálogo",
  clearFilter: "Borrar filtros",

  archiveTitle: "Archivo de modelos",
  archiveLead: "Modelos descatalogados que formaron parte de la gama de Marinero.",
  archiveBadge: "Descatalogado",

  boatsTitle: "Embarcaciones",
  boatsLead: "Modelos disponibles en Marinero, por marca y serie.",
  brandLabel: "Marca",
  brandModelsLead: "Modelos disponibles en Marinero.",

  galleryTitle: "Galería",
  photosWord: "fotos",
  showMorePhotos: "Ver más fotos",
  showLess: "Mostrar menos",
  descriptionTitle: "Descripción",
  specificationTitle: "Ficha técnica",
  requestSpec: "Solicitar la ficha completa",
  askOffer: "Solicitar presupuesto",
  configuratorTitle: "Configurador",
  otherModels: "Otros modelos de la gama",
  modelCtaTitle: "¿Quieres conocer más detalles de este modelo?",
  modelCtaLead:
    "Escríbenos o llámanos — prepararemos un presupuesto y te asesoraremos sobre equipamiento y plazos de entrega.",
  basePriceLabel: "Precio base sin IVA",
  seriesLabel: "Serie",

  newsTitle: "Novedades",
  newsLead: "Dónde encontrarnos, qué hay de nuevo en nuestras marcas y qué modelos llegan al mercado.",
  newsLabel: "Ferias, eventos, estrenos",
  newsEmpty: "Todavía no hay novedades publicadas.",
  newsReadMore: "Leer más",

  cfgBaseIncludes: "Qué incluye el precio base",
  cfgStandardEquipment: "Equipamiento de serie",
  cfgExpand: "Desplegar",
  cfgCollapse: "Plegar",
  cfgExtraOptions: "Equipamiento opcional",
  cfgSelected: "seleccionadas",
  cfgContactData: "Datos de contacto",
  cfgName: "Nombre y apellidos",
  cfgEmail: "Dirección de correo *",
  cfgPhone: "Teléfono",
  cfgNotes: "Observaciones, fecha de compra, zona de uso",
  cfgPreparedBy: "Oferta preparada por",
  cfgTeam: "Equipo Marinero",
  cfgPreparedByHint:
    "Determina el pie de página y la firma del presupuesto PDF y la dirección de respuesta del correo.",
  cfgCalculator: "Calculadora de precio",
  cfgBasePrice: "Precio base",
  cfgOptions: "Opciones",
  cfgNetTotal: "Total sin IVA",
  cfgRate: "Cambio",
  cfgGrossPln: "Total con IVA en PLN (23%)",
  cfgChosenOptions: "Opciones elegidas",
  cfgNoOptions: "No se ha elegido ninguna opción",
  cfgSubmit: "Enviar consulta y PDF",
  cfgSending: "Enviando...",
  cfgMissingEmail: "Indica la dirección de correo del cliente.",
  cfgSavedNoSmtp:
    "La consulta se ha guardado en el panel de administración. El envío de correos requiere aún la configuración SMTP.",
  cfgSavedSent: "La consulta se ha guardado y el presupuesto PDF se ha enviado por correo.",
  cfgUnavailable: "Configurador en preparación",
  cfgUnavailableLead: "Todavía no hay lista de precios para este modelo.",

    shopTitle: "Tienda",
  shopLead: "Motores, electrónica y accesorios náuticos — envío y recogida en Gdynia.",
  shopCategories: "Categorías",
  shopAllProducts: "Todos los productos",
  shopSearchPlaceholder: "Buscar en la tienda…",
  shopNoResults: "Ningún producto coincide con la búsqueda.",
  shopAddToCart: "Añadir al carrito",
  shopAdded: "Añadido al carrito",
  shopInCart: "En el carrito",
  shopCart: "Carrito",
  shopCartEmpty: "Tu carrito está vacío",
  shopCartEmptyLead: "Elige algo de nuestra oferta — motores, electrónica y accesorios.",
  shopContinue: "Seguir comprando",
  shopQuantity: "Cantidad",
  shopRemove: "Eliminar",
  shopSubtotal: "Subtotal",
  shopShipping: "Envío",
  shopTotal: "Total",
  shopCheckout: "Ir a la compra",
  shopOrderTitle: "Pedido",
  shopCustomer: "Datos del cliente",
  shopFirstName: "Nombre",
  shopLastName: "Apellidos",
  shopAddress: "Dirección",
  shopCity: "Ciudad",
  shopPostal: "Código postal",
  shopCountry: "País",
  shopDelivery: "Método de envío",
  shopPayment: "Pago",
  shopPaymentLead: "Confirmamos el pedido por correo; los datos para la transferencia y la entrega se acuerdan individualmente — te contactaremos justo después del pedido.",
    shopAnnouncement: "Servicio oficial Mercury y Suzuki · Envío en 24 h · Recogida en Gdynia",
  shopTrust1: "Concesionario oficial",
  shopTrust1Lead: "Repuestos y electrónica originales directamente de los fabricantes.",
  shopTrust2: "Envío en 24 h",
  shopTrust2Lead: "Los artículos en stock salen el mismo día o el siguiente día laborable.",
  shopTrust3: "Asesoramiento del taller",
  shopTrust3Lead: "Te ayudamos a elegir repuestos y equipamiento para tu barco — llama o escribe.",
  shopQuickAdd: "Añadir",
  shopDescriptionTitle: "Descripción del producto",
    shopHeroTitle: "Todo lo que tu barco necesita",
  shopHeroLead: "Motores fueraborda, electrónica de navegación, repuestos y accesorios. Concesionario oficial de Mercury, Suzuki, Garmin, Simrad y Fusion.",
  shopHeroCta: "Ver productos",
  shopHeroSecondary: "Contactar con el taller",
  shopPopular: "Los más vendidos",
  shopNewest: "Novedades en la tienda",
  shopBrandsTitle: "Marcas que vendemos y reparamos",
  shopBrandsLead: "Equipos directamente de los fabricantes, con garantía y el apoyo de nuestro taller.",
  shopBrowseAll: "Ver todos los productos",
  shopCategoriesLead: "Elige una categoría y ve directo al equipo que buscas.",
    shopStatsEyebrow: "Marinero desde 2004",
  shopStatsTitle: "Equipos que reparamos nosotros mismos",
  shopStatsLead: "No revendemos el catálogo de un mayorista. Cada motor, plotter y repuesto pasa por nuestro taller en Gdynia — por eso sabemos lo que recomendamos.",
  shopStatsService: "Marcas en el taller",
  shopContactTitle: "¿No sabes qué elegir? Llama a nuestro taller.",
  shopCollections: "Colecciones",
  shopFeatured: "Productos seleccionados",
  shopViewCategory: "Ver categoría",
  shopPlaceOrder: "Realizar pedido",
  shopOrderSending: "Realizando pedido…",
  shopOrderDone: "Gracias por tu pedido",
  shopOrderDoneLead: "Hemos enviado la confirmación a tu correo. Te contactaremos sobre el pago y la entrega.",
  shopBackToShop: "Volver a la tienda",
  shopProducts: "productos",
  shopPrice: "Precio",
  shopSort: "Orden",
  shopSortNewest: "Más recientes",
  shopSortPriceAsc: "Precio ascendente",
  shopSortPriceDesc: "Precio descendente",
  shopVariant: "Variante",
  shopStepCart: "Carrito",
  shopStepData: "Datos y envío",
  shopStepDone: "Confirmación",
  shopSummary: "Resumen",
  shopFree: "Gratis",
  shopTax: "IVA 23%",
  shopNet: "Importe neto",
  shopVatIncluded: "Precio con IVA 23% incluido",
  shopVatExcluded: "Precio neto — el IVA 23% se añade en el carrito",
  shopAvailability: "Disponibilidad",
  shopInStock: "Envío inmediato",
  shopOnOrder: "Bajo pedido — confirmaremos el plazo",
  shopShippingFast: "Envío en 24 h o recogida en Gdynia",
  shopWarranty: "Garantía",
  shopWarrantyValue: "Garantía del fabricante, servicio en Gdynia",
  shopFamilyEyebrow: "Misma serie",
  shopFamilyTitle: "Otras versiones de este modelo",
  shopSpecsTitle: "Datos técnicos",
  shopInStockCount: "en stock: {n} uds.",
  shopFilters: "Filtros",
  shopBrandLabel: "Marca",
  shopFuel: "Tipo di motore",
  shopPower: "Potenza",
  shopShaft: "Lunghezza gambo",
  shopControl: "Comando",
  shopFiltersClear: "Borrar filtros",
  shopServiceTitle: "Planifica el servicio",
  shopServiceEyebrow: "Repuestos y accesorios",
  shopVatNote: "Todos los precios de la tienda son brutos — incluyen el 23% de IVA.",
  shopVatId: "NIF-IVA (opcional)",
  shopVatIdHint: "Empresas de la UE fuera de Polonia: indica tu NIF-IVA y emitiremos la factura sin IVA tras contactar contigo.",
  shopVatCheck: "Comprobar",
  shopVatChecking: "Comprobando…",
  shopVatOk: "NIF-IVA confirmado en el registro VIES — venta sin IVA",
  shopVatInvalid: "Este número no está en el registro VIES. Revísalo o compra con IVA.",
  shopVatError: "El registro VIES no responde. Inténtalo más tarde o pide con IVA — corregiremos la factura.",
  shopVatRemoved: "IVA 23% retirado (inversión del sujeto pasivo)",
  shopNeedHelp: "¿Necesitas ayuda para elegir?",
  shopNeedHelpLead: "Llama o escribe — elegiremos el equipo adecuado para tu barco.",

  footerCompany: "Empresa",
  footerBrands: "Marcas",
  footerContact: "Contacto",
  footerServices: "Servicios",
  footerPrivacy: "Política de privacidad",
}

const DICTIONARIES: Record<Locale, Dictionary> = { pl, en, de, fr, ru, uk, it, es }

export type Dict = Dictionary

export function getDictionary(locale: any): Dictionary {
  return DICTIONARIES[normalizeLocale(locale)]
}

// Polska odmiana „model / modele / modeli", w pozostałych językach prosta liczba mnoga.
export function pluralModels(locale: any, count: number): string {
  const value = Number(count) || 0
  const resolved = normalizeLocale(locale)

  if (resolved === "pl") {
    const last = value % 10
    const lastTwo = value % 100
    if (value === 1) return "model"
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "modele"
    return "modeli"
  }

  if (resolved === "ru" || resolved === "uk") {
    const last = value % 10
    const lastTwo = value % 100
    const one = resolved === "ru" ? "модель" : "модель"
    const few = resolved === "ru" ? "модели" : "моделі"
    const many = resolved === "ru" ? "моделей" : "моделей"
    if (last === 1 && lastTwo !== 11) return one
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
    return many
  }

  const single: Record<string, [string, string]> = {
    en: ["model", "models"],
    de: ["Modell", "Modelle"],
    fr: ["modèle", "modèles"],
    it: ["modello", "modelli"],
    es: ["modelo", "modelos"],
  }

  const pair = single[resolved] || single.en
  return value === 1 ? pair[0] : pair[1]
}

// Etykiety specyfikacji zapisane po polsku tłumaczymy przez słownik;
// nieznane etykiety zostają bez zmian.
const SPEC_LABELS: Record<string, Partial<Record<Locale, string>>> = {
  długość: { en: "Length", de: "Länge", fr: "Longueur", ru: "Длина", uk: "Довжина", it: "Lunghezza", es: "Eslora" },
  "długość całkowita": { en: "Length overall", de: "Länge über alles", fr: "Longueur hors-tout", ru: "Длина габаритная", uk: "Довжина габаритна", it: "Lunghezza fuori tutto", es: "Eslora total" },
  szerokość: { en: "Beam", de: "Breite", fr: "Largeur", ru: "Ширина", uk: "Ширина", it: "Larghezza", es: "Manga" },
  zanurzenie: { en: "Draft", de: "Tiefgang", fr: "Tirant d'eau", ru: "Осадка", uk: "Осадка", it: "Pescaggio", es: "Calado" },
  masa: { en: "Weight", de: "Gewicht", fr: "Poids", ru: "Масса", uk: "Маса", it: "Peso", es: "Peso" },
  waga: { en: "Weight", de: "Gewicht", fr: "Poids", ru: "Масса", uk: "Маса", it: "Peso", es: "Peso" },
  kabiny: { en: "Cabins", de: "Kabinen", fr: "Cabines", ru: "Каюты", uk: "Каюти", it: "Cabine", es: "Camarotes" },
  łazienki: { en: "Heads", de: "Nasszellen", fr: "Salles d'eau", ru: "Санузлы", uk: "Санвузли", it: "Bagni", es: "Aseos" },
  "liczba osób": { en: "Persons", de: "Personen", fr: "Personnes", ru: "Количество человек", uk: "Кількість осіб", it: "Persone", es: "Personas" },
  silnik: { en: "Engine", de: "Motor", fr: "Moteur", ru: "Двигатель", uk: "Двигун", it: "Motore", es: "Motor" },
  silniki: { en: "Engines", de: "Motoren", fr: "Moteurs", ru: "Двигатели", uk: "Двигуни", it: "Motori", es: "Motores" },
  "napęd i osiągi": { en: "Propulsion and performance", de: "Antrieb und Leistung", fr: "Motorisation et performances", ru: "Двигатель и характеристики", uk: "Двигун і характеристики", it: "Propulsione e prestazioni", es: "Propulsión y prestaciones" },
  "zbiornik paliwa": { en: "Fuel tank", de: "Kraftstofftank", fr: "Réservoir de carburant", ru: "Топливный бак", uk: "Паливний бак", it: "Serbatoio carburante", es: "Depósito de combustible" },
  "zbiornik wody": { en: "Water tank", de: "Wassertank", fr: "Réservoir d'eau", ru: "Бак для воды", uk: "Бак для води", it: "Serbatoio acqua", es: "Depósito de agua" },
  "kategoria ce": { en: "CE category", de: "CE-Kategorie", fr: "Catégorie CE", ru: "Категория CE", uk: "Категорія CE", it: "Categoria CE", es: "Categoría CE" },
  marka: { en: "Brand", de: "Marke", fr: "Marque", ru: "Бренд", uk: "Бренд", it: "Marchio", es: "Marca" },
  seria: { en: "Series", de: "Serie", fr: "Série", ru: "Серия", uk: "Серія", it: "Serie", es: "Serie" },
  rok: { en: "Year", de: "Baujahr", fr: "Année", ru: "Год", uk: "Рік", it: "Anno", es: "Año" },
}

export function translateSpecLabel(locale: any, label: string): string {
  const resolved = normalizeLocale(locale)
  if (resolved === "pl") return label

  const entry = SPEC_LABELS[String(label || "").trim().toLowerCase()]
  return entry?.[resolved] || label
}
