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
