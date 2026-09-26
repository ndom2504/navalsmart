export function formatMoney(cents: number, currency = "CAD", digits = 0): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

export function formatCompactMoney(cents: number, currency = "CAD"): string {
  const amount = cents / 100;
  const absolute = Math.abs(amount);
  if (absolute >= 1_000_000) {
    const value = (amount / 1_000_000).toLocaleString("fr-CA", { maximumFractionDigits: 1 });
    return currency === "CAD" ? `${value} M$` : `${value} M ${currency}`;
  }
  return formatMoney(cents, currency);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: digits }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "Non précisée";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Non précisée";
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("fr-CA", { maximumFractionDigits: 1 })} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-CA", { maximumFractionDigits: 1 })} Mo`;
}
