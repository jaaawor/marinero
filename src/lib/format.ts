export function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(String(value).replace(",", "."));

  if (Number.isNaN(number)) return null;

  return number;
}

export function formatPrice(value: any, currency?: string | null): string {
  const number = toNumber(value);

  if (number === null) return "Cena na zapytanie";

  const formatted = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(Math.round(number));

  return currency ? `${formatted} ${currency}` : formatted;
}

export type NbpRatesData = {
  rates: Record<string, number>;
  effectiveDate?: string;
};

function isNbpRatesData(
  data: NbpRatesData | Record<string, number>
): data is NbpRatesData {
  return (
    "rates" in data &&
    typeof data.rates === "object" &&
    data.rates !== null
  );
}

export async function getNbpRatesToPln(): Promise<NbpRatesData> {
  return {
    rates: {
      PLN: 1,
      EUR: 4.3,
      USD: 4,
    },
  };
}

export function formatPlnEstimateShort(
  value: any,
  currency: string | null | undefined,
  nbpData: NbpRatesData | Record<string, number>
): string | null {
  const number = toNumber(value);
  const code = currency?.toUpperCase();

  if (number === null || !code || code === "PLN") return null;

  const rates: Record<string, number> = isNbpRatesData(nbpData)
    ? nbpData.rates
    : nbpData;

  const rate = rates[code];

  if (!rate) return null;

  const pln = number * rate;

  const formatted = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(Math.round(pln));

  return `ok. ${formatted} PLN`;
}
