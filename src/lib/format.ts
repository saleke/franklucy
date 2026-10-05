import Decimal from "decimal.js";

/**
 * Format a number, string, or Decimal into Nigerian Naira (₦) currency string.
 * Example: formatNaira(38000) => "₦38,000"
 * Example: formatNaira(38000.5) => "₦38,000.50"
 */
export function formatNaira(
  value: number | string | Decimal | null | undefined,
  showDecimals = false
): string {
  if (value === null || value === undefined) return "₦0";
  const num = typeof value === "number" ? value : Number(value.toString());
  if (isNaN(num)) return "₦0";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(num)
    .replace("NGN", "₦");
}

/**
 * Format date/time with a clear, readable representation.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatTimeOnly(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
