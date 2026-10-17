import { z } from "zod/v4";
import { Trace } from "../trace/index.js";

export const MARKETS = ["US", "GB", "CA", "AU", "NZ", "EU"] as const;
export type Market = (typeof MARKETS)[number];

const LOOKS_LIKE_URL = /^(https?:\/\/|www\.)|\.[a-z]{2,}\//i;

/** What a user types to start an analysis: a product by url or by name, and optional context the agent would otherwise have to guess. */
export const AnalysisInputSchema = z
  .object({
    product_url: z.url().nullable().default(null),
    product_name: z
      .string()
      .trim()
      .min(2)
      .refine((name) => !LOOKS_LIKE_URL.test(name), "a url goes in product_url, never product_name")
      .nullable()
      .default(null),
    markets: z.array(z.enum(MARKETS)).min(1).default(["US"]),
    known_competitors: z.array(z.string().trim().min(2)).max(15).default([]),
    brand_constraints: z.string().default(""),
    price_offer: z.string().default(""),
  })
  .refine((input) => input.product_url !== null || input.product_name !== null, "give a product_url or a product_name");

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

const EU_MEMBER_STATES = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"] as const;

/** The ISO country codes a market covers, for services that filter by country. */
export class Markets {
  static countries(markets: readonly Market[]): string[] {
    Trace.line(import.meta.url, "Markets.countries", { markets });
    return [...new Set(markets.flatMap((market) => (market === "EU" ? [...EU_MEMBER_STATES] : [market])))];
  }
}
