import type { ProviderFetcher } from "./base.js";
import type { ProviderData } from "../types.js";
import { fetchJson } from "../lib/http.js";
import * as logger from "../logger.js";

const AUTH_FILE = `${process.env.HOME}/.codex/auth.json`;
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const RESET_CREDITS_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";

interface CodexAuth {
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    account_id?: string;
  };
}

interface RateWindow {
  used_percent?: number;
  reset_at?: number;
  limit_window_seconds?: number;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit?: {
    primary_window?: RateWindow;
  };
  additional_rate_limits?: Array<{
    limit_name?: string;
    rate_limit?: {
      primary_window?: RateWindow;
    };
  }>;
  rate_limit_reset_credits?: {
    available_count?: number;
    applicable_available_count?: number;
    expires_at?: number | string;
  };
}

interface ResetCreditsResponse {
  available_count?: number;
  credits?: Array<{
    status?: string;
    expires_at?: string;
  }>;
}

async function getAuth(): Promise<CodexAuth | null> {
  try {
    const file = Bun.file(AUTH_FILE);
    if (await file.exists()) {
      return await file.json();
    }
  } catch (err) {
    logger.warn(`Failed to read ${AUTH_FILE}: ${err}`);
  }
  return null;
}

function windowLabel(seconds?: number): string {
  if (seconds === 7 * 24 * 60 * 60) return "Weekly";
  if (seconds === 5 * 60 * 60) return "Session";
  return "Usage";
}

function formatPlanLabel(plan?: string): string | undefined {
  if (!plan) return undefined;
  if (plan.toLowerCase() === "prolite") return "Pro Lite";

  return plan
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseExpiry(value?: number | string): Date | undefined {
  if (value == null || value === "") return undefined;

  const date = typeof value === "number"
    ? new Date(value > 10_000_000_000 ? value : value * 1000)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseCodexUsage(
  usage: CodexUsageResponse,
  resetCredits?: ResetCreditsResponse | null,
): ProviderData {
  const earliestAvailableExpiry = resetCredits?.credits?.reduce<Date | undefined>(
    (earliest, credit) => {
      if (credit.status !== "available" || !credit.expires_at) return earliest;
      const expiry = parseExpiry(credit.expires_at);
      if (!expiry) return earliest;
      if (!earliest || expiry.getTime() < earliest.getTime()) return expiry;
      return earliest;
    },
    undefined,
  );

  const data: ProviderData = {
    name: "codex",
    status: "ok",
    planLabel: formatPlanLabel(usage.plan_type),
    resetCreditsAvailable: usage.rate_limit_reset_credits?.available_count
      ?? resetCredits?.available_count
      ?? 0,
    resetCreditsApplicable: usage.rate_limit_reset_credits?.applicable_available_count ?? 0,
    resetCreditsExpiresAt: earliestAvailableExpiry
      ?? parseExpiry(usage.rate_limit_reset_credits?.expires_at),
  };

  const primary = usage.rate_limit?.primary_window;
  if (primary) {
    data.primaryLabel = windowLabel(primary.limit_window_seconds);
    data.primaryPercent = primary.used_percent ?? 0;
    if (primary.reset_at) {
      data.primaryResetsAt = new Date(primary.reset_at * 1000);
    }
  }

  const spark = usage.additional_rate_limits?.find((limit) =>
    limit.limit_name?.toLowerCase().includes("spark")
  )?.rate_limit?.primary_window;

  if (spark) {
    data.secondaryLabel = "Spark";
    data.secondaryPercent = spark.used_percent ?? 0;
    if (spark.reset_at) {
      data.secondaryResetsAt = new Date(spark.reset_at * 1000);
    }
  }

  return data;
}

export const codex: ProviderFetcher = {
  name: "codex",

  async fetch(): Promise<ProviderData> {
    const auth = await getAuth();
    if (!auth?.tokens?.access_token) {
      return { name: "codex", status: "unavailable", error: "No auth.json found" };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.tokens.access_token}`,
      Accept: "application/json",
    };

    if (auth.tokens.account_id) {
      headers["ChatGPT-Account-Id"] = auth.tokens.account_id;
    }

    try {
      const [usage, resetCredits] = await Promise.all([
        fetchJson<CodexUsageResponse>(USAGE_URL, {
          headers,
          timeoutMs: 30_000,
        }),
        fetchJson<ResetCreditsResponse>(RESET_CREDITS_URL, {
          headers,
          timeoutMs: 30_000,
        }).catch((err) => {
          logger.warn(`Failed to fetch Codex reset-credit details: ${err}`);
          return null;
        }),
      ]);

      return parseCodexUsage(usage, resetCredits);
    } catch (err) {
      return { name: "codex", status: "error", error: String(err) };
    }
  },
};
