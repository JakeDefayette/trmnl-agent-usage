import type { ProviderFetcher } from "./base.js";
import type { ProviderData } from "../types.js";
import { readKeychainPassword } from "../lib/keychain.js";
import { fetchJson } from "../lib/http.js";
import * as logger from "../logger.js";

const KEYCHAIN_SERVICE = "Claude Code-credentials";
const CREDENTIALS_FILE = `${process.env.HOME}/.claude/.credentials.json`;
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scopes?: string[];
  };
}

interface UsageWindow {
  utilization?: number;
  resets_at?: string;
}

interface ExtraUsage {
  is_enabled?: boolean;
  monthly_limit?: number;
  used_credits?: number;
  utilization?: number;
  currency?: string;
}

interface ClaudeUsageResponse {
  five_hour?: UsageWindow;
  seven_day?: UsageWindow;
  extra_usage?: ExtraUsage;
  [key: string]: unknown;
}

async function getAccessToken(): Promise<string | null> {
  // Try credentials file first (keychain `security -w` truncates large data items)
  try {
    const file = Bun.file(CREDENTIALS_FILE);
    if (await file.exists()) {
      const creds: ClaudeCredentials = await file.json();
      if (creds.claudeAiOauth?.accessToken) {
        logger.info("Claude token sourced from credentials file");
        return creds.claudeAiOauth.accessToken;
      }
    }
  } catch (err) {
    logger.warn(`Failed to read ${CREDENTIALS_FILE}: ${err}`);
  }

  // Fallback to keychain
  const keychainValue = await readKeychainPassword(KEYCHAIN_SERVICE);
  if (keychainValue) {
    try {
      const parsed = JSON.parse(keychainValue);
      if (parsed.claudeAiOauth?.accessToken) {
        logger.info("Claude token sourced from keychain");
        return parsed.claudeAiOauth.accessToken;
      }
    } catch {
      if (keychainValue.startsWith("sk-ant-")) {
        logger.info("Claude token sourced from keychain (raw)");
        return keychainValue;
      }
    }
  }

  return null;
}

export const claude: ProviderFetcher = {
  name: "claude",

  async fetch(): Promise<ProviderData> {
    const token = await getAccessToken();
    if (!token) {
      return { name: "claude", status: "unavailable", error: "No OAuth token found" };
    }

    try {
      const usage = await fetchJson<ClaudeUsageResponse>(USAGE_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "anthropic-beta": "oauth-2025-04-20",
        },
        timeoutMs: 30_000,
      });

      const data: ProviderData = {
        name: "claude",
        status: "ok",
        primaryLabel: "5h window",
        secondaryLabel: "7d window",
      };

      if (usage.five_hour) {
        // utilization is 0-100, not 0-1
        data.primaryPercent = Math.min(100, Math.round(usage.five_hour.utilization ?? 0));
        if (usage.five_hour.resets_at) {
          data.primaryResetsAt = new Date(usage.five_hour.resets_at);
        }
      }

      if (usage.seven_day) {
        data.secondaryPercent = Math.min(100, Math.round(usage.seven_day.utilization ?? 0));
        if (usage.seven_day.resets_at) {
          data.secondaryResetsAt = new Date(usage.seven_day.resets_at);
        }
      }

      if (usage.extra_usage?.is_enabled && usage.extra_usage.used_credits != null) {
        // used_credits and monthly_limit are in cents
        data.extraSpend = usage.extra_usage.used_credits / 100;
        data.extraLimit = usage.extra_usage.monthly_limit != null
          ? usage.extra_usage.monthly_limit / 100
          : undefined;
      }

      return data;
    } catch (err) {
      return { name: "claude", status: "error", error: String(err) };
    }
  },
};
