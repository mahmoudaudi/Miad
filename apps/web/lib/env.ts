/** Central access to public env vars. Never put secrets here. */
export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
}

/**
 * Display currency for plan prices. Amounts always come from the database;
 * only the ISO code used to render them is configured here.
 */
export function getBillingCurrency(): string {
  return process.env.NEXT_PUBLIC_BILLING_CURRENCY ?? 'USD';
}
