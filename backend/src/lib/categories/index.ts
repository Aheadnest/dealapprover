import { z } from "zod";

export const CATEGORY_KEYS = [
  "phone",
  "laptop",
  "tablet",
  "watch_luxury",
  "handbag_luxury",
  "sneaker",
  "electronics_other",
  "other",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Per-category extra fields schema (validated at issuance)
const phoneExtra = z.object({
  color: z.string().optional(),
  storage_gb: z.number().int().positive().optional(),
  battery_health_pct: z.number().int().min(0).max(100).optional(),
});

const laptopExtra = z.object({
  year: z.number().int().optional(),
  cpu: z.string().optional(),
  ram_gb: z.number().int().positive().optional(),
  storage_gb: z.number().int().positive().optional(),
});

const watchExtra = z.object({
  ref_no: z.string().optional(),
  year: z.number().int().optional(),
  has_papers: z.boolean().optional(),
  has_box: z.boolean().optional(),
});

const handbagExtra = z.object({
  color: z.string().optional(),
  date_code: z.string().optional(),
  hardware_color: z.string().optional(),
});

const sneakerExtra = z.object({
  size_eu: z.number().optional(),
  size_us: z.number().optional(),
  colorway: z.string().optional(),
  sku: z.string().optional(),
});

const genericExtra = z.object({}).passthrough();

export const categoryExtraSchemas: Record<CategoryKey, z.ZodTypeAny> = {
  phone: phoneExtra,
  laptop: laptopExtra,
  tablet: laptopExtra,
  watch_luxury: watchExtra,
  handbag_luxury: handbagExtra,
  sneaker: sneakerExtra,
  electronics_other: genericExtra,
  other: genericExtra,
};

export function validateCategoryExtra(
  category: CategoryKey,
  extra: unknown,
): { success: true; data: object } | { success: false; error: string } {
  const schema = categoryExtraSchemas[category];
  const result = schema.safeParse(extra);
  if (!result.success) {
    return { success: false, error: result.error.issues.map((i) => i.message).join(", ") };
  }
  return { success: true, data: result.data as object };
}

// Minimum required photos per category
export const categoryMinPhotos: Record<CategoryKey, number> = {
  phone: 3,
  laptop: 3,
  tablet: 3,
  watch_luxury: 3,
  handbag_luxury: 4,
  sneaker: 4,
  electronics_other: 3,
  other: 3,
};

export function validateImei(imei: string): boolean {
  const digits = imei.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  // Luhn check
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
