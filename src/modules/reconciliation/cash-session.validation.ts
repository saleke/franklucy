import { z } from "zod";
import Decimal from "decimal.js";

export const openCashSessionSchema = z.object({
  openingCash: z
    .string()
    .min(1, "Opening cash amount is required")
    .refine(
      (val) => {
        try {
          const dec = new Decimal(val.trim());
          return !dec.isNaN() && dec.isFinite() && dec.greaterThanOrEqualTo(0);
        } catch {
          return false;
        }
      },
      {
        message: "Opening cash must be a valid non-negative monetary amount (e.g. 0, 5000, 20000.00).",
      }
    ),
  branchId: z.string().optional(),
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  declaredCash: z
    .string()
    .min(1, "Declared cash is required")
    .refine(
      (val) => {
        try {
          const dec = new Decimal(val.trim());
          return !dec.isNaN() && dec.isFinite() && dec.greaterThanOrEqualTo(0);
        } catch {
          return false;
        }
      },
      {
        message: "Declared cash must be a valid non-negative monetary amount.",
      }
    ),
  declaredTransfer: z
    .string()
    .min(1, "Declared transfer is required")
    .refine(
      (val) => {
        try {
          const dec = new Decimal(val.trim());
          return !dec.isNaN() && dec.isFinite() && dec.greaterThanOrEqualTo(0);
        } catch {
          return false;
        }
      },
      {
        message: "Declared transfer must be a valid non-negative monetary amount.",
      }
    ),
  notes: z.string().max(500).optional(),
});

export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

export const recordCashPayoutSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  amount: z
    .string()
    .min(1, "Payout amount is required")
    .refine(
      (val) => {
        try {
          const dec = new Decimal(val.trim());
          return !dec.isNaN() && dec.isFinite() && dec.greaterThan(0);
        } catch {
          return false;
        }
      },
      {
        message: "Payout amount must be greater than zero.",
      }
    ),
  category: z.enum([
    "FUEL",
    "LOGISTICS",
    "SUPPLIES",
    "CASH_DROP",
    "OWNER_WITHDRAWAL",
    "OTHER",
  ]),
  recipient: z.string().max(120).optional(),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(300),
  reference: z.string().max(100).optional(),
});

export type RecordCashPayoutInput = z.infer<typeof recordCashPayoutSchema>;
