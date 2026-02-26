import type { ProviderFetcher } from "./base.js";
import type { ProviderData } from "../types.js";
import { fetchJson } from "../lib/http.js";
import * as logger from "../logger.js";

const AUTH_FILE = `${process.env.HOME}/.codex/auth.json`;
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

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
    secondary_window?: RateWindow;
  };
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: number | string;
  };
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
      const usage = await fetchJson<CodexUsageResponse>(USAGE_URL, {
        headers,
        timeoutMs: 30_000,
      });

      const data: ProviderData = {
        name: "codex",
        status: "ok",
        primaryLabel: "5h window",
        secondaryLabel: "7d window",
      };

      const primary = usage.rate_limit?.primary_window;
      if (primary) {
        data.primaryPercent = primary.used_percent ?? 0;
        if (primary.reset_at) {
          data.primaryResetsAt = new Date(primary.reset_at * 1000);
        }
      }

      const secondary = usage.rate_limit?.secondary_window;
      if (secondary) {
        data.secondaryPercent = secondary.used_percent ?? 0;
        if (secondary.reset_at) {
          data.secondaryResetsAt = new Date(secondary.reset_at * 1000);
        }
      }

      if (usage.credits?.balance != null) {
        data.extraSpend = Number(usage.credits.balance);
      }

      return data;
    } catch (err) {
      return { name: "codex", status: "error", error: String(err) };
    }
  },
};
