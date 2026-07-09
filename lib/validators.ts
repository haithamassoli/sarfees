import { z } from "zod";
import { normalizeJordanPhone } from "@/convex/lib/shared";
import { isValidName, isValidPrice } from "@/convex/lib/text";
import { t } from "@/lib/i18n";

// Zod field schemas for the app's TanStack Forms. TanStack consumes each as a
// Standard Schema validator; the issue message is the Arabic string it shows.
// Cross-field rules (from ≠ to, future departure, all-or-nothing vehicle) stay
// in each form's onSubmit — they're relational/temporal, not field shapes.

export const nameSchema = z
  .string()
  .refine(isValidName, t("error_invalid_name"));

export const phoneSchema = z
  .string()
  .refine((v) => normalizeJordanPhone(v) !== null, t("error_invalid_phone"));

// Login only needs the field present; signup enforces the 8-char floor.
export const passwordRequiredSchema = z
  .string()
  .min(1, t("error_password_required"));
export const passwordSchema = z.string().min(8, t("error_weak_password"));

export const dateSchema = z.string().min(1, t("error_date_required"));
export const timeSchema = z.string().min(1, t("error_time_required"));

export const priceSchema = z
  .string()
  .refine(
    (v) => v.trim() !== "" && isValidPrice(Number(v)),
    t("error_invalid_price"),
  );
