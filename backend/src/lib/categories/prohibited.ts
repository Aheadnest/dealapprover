export const PROHIBITED_CATEGORIES = new Set([
  "firearms",
  "ammunition",
  "drugs",
  "prescription_drugs",
  "live_animals",
  "currency",
  "financial_instruments",
  "adult_content",
]);

export function isProhibited(category: string): boolean {
  return PROHIBITED_CATEGORIES.has(category.toLowerCase());
}
