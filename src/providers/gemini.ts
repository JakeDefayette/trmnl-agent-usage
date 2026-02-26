import type { ProviderFetcher } from "./base.js";
import type { ProviderData } from "../types.js";
import { fetchJson } from "../lib/http.js";
import { decodeJwtPayload } from "../lib/jwt.js";
import * as logger from "../logger.js";

const OAUTH_CREDS_FILE = `${process.env.HOME}/.gemini/oauth_creds.json`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const LOAD_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const QUOTA_URL = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota";

interface GeminiOAuthCreds {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expiry_date?: number;
}

interface QuotaBucket {
  modelId?: string;
  remainingFraction?: number;
  resetTime?: string;
  tokenType?: string;
}

interface QuotaResponse {
  buckets?: QuotaBucket[];
}

interface LoadResponse {
  currentTier?: { id?: string };
  cloudaicompanionProject?: string | { id?: string; projectId?: string };
}

// --- OAuth client extraction from Gemini CLI binary ---

const OAUTH2_PATHS = [
  "/opt/homebrew/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js",
  "/usr/local/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js",
  "/usr/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js",
];

async function extractOAuthClientFromBinary(): Promise<{ clientId: string; clientSecret: string } | null> {
  for (const path of OAUTH2_PATHS) {
    try {
      const file = Bun.file(path);
      if (!(await file.exists())) continue;

      const content = await file.text();
      const idMatch = content.match(/OAUTH_CLIENT_ID\s*=\s*['"]([\w\-.]+)['"]\s*;/);
      const secretMatch = content.match(/OAUTH_CLIENT_SECRET\s*=\s*['"]([\w\-]+)['"]\s*;/);

      if (idMatch && secretMatch) {
        return { clientId: idMatch[1], clientSecret: secretMatch[1] };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function getOAuthClient(envClientId?: string, envClientSecret?: string): Promise<{ clientId: string; clientSecret: string } | null> {
  if (envClientId && envClientSecret) {
    return Promise.resolve({ clientId: envClientId, clientSecret: envClientSecret });
  }
  return extractOAuthClientFromBinary();
}

// --- Token refresh ---

async function refreshToken(
  creds: GeminiOAuthCreds,
  client: { clientId: string; clientSecret: string },
): Promise<GeminiOAuthCreds> {
  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: HTTP ${res.status}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number; id_token?: string };
  const updated: GeminiOAuthCreds = {
    ...creds,
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
    id_token: data.id_token ?? creds.id_token,
  };

  // Write updated creds back
  await Bun.write(OAUTH_CREDS_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

// --- Project discovery ---

function extractProjectId(load: LoadResponse): string | undefined {
  const proj = load.cloudaicompanionProject;
  if (!proj) return undefined;
  if (typeof proj === "string") return proj;
  return proj.projectId ?? proj.id;
}

// --- Main provider ---

export function createGeminiProvider(envClientId?: string, envClientSecret?: string): ProviderFetcher {
  return {
    name: "gemini",

    async fetch(): Promise<ProviderData> {
      // Read creds
      let creds: GeminiOAuthCreds;
      try {
        const file = Bun.file(OAUTH_CREDS_FILE);
        if (!(await file.exists())) {
          return { name: "gemini", status: "unavailable", error: "No oauth_creds.json found" };
        }
        creds = await file.json();
      } catch (err) {
        return { name: "gemini", status: "unavailable", error: `Failed to read creds: ${err}` };
      }

      if (!creds.access_token || !creds.refresh_token) {
        return { name: "gemini", status: "unavailable", error: "Missing tokens in oauth_creds.json" };
      }

      // Check if token is expired, refresh if needed
      const isExpired = creds.expiry_date != null && creds.expiry_date < Date.now();
      if (isExpired) {
        const client = await getOAuthClient(envClientId, envClientSecret);
        if (!client) {
          return { name: "gemini", status: "error", error: "Token expired and no OAuth client credentials available for refresh" };
        }
        try {
          creds = await refreshToken(creds, client);
          logger.info("Gemini token refreshed");
        } catch (err) {
          return { name: "gemini", status: "error", error: `Token refresh failed: ${err}` };
        }
      }

      const authHeaders = {
        Authorization: `Bearer ${creds.access_token}`,
        "Content-Type": "application/json",
      };

      try {
        // Load code assist to get project ID
        const load = await fetchJson<LoadResponse>(LOAD_URL, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ metadata: { ideType: "GEMINI_CLI", pluginType: "GEMINI" } }),
          timeoutMs: 10_000,
        });

        const projectId = extractProjectId(load);

        // Retrieve quota
        const quotaBody = projectId ? { project: projectId } : {};
        const quota = await fetchJson<QuotaResponse>(QUOTA_URL, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(quotaBody),
          timeoutMs: 10_000,
        });

        if (!quota.buckets?.length) {
          return { name: "gemini", status: "ok", primaryLabel: "Pro", secondaryLabel: "Flash" };
        }

        // Group by Pro vs Flash, take lowest remainingFraction per group
        let proMin = Infinity;
        let flashMin = Infinity;
        let proReset: string | undefined;
        let flashReset: string | undefined;

        for (const bucket of quota.buckets) {
          const model = (bucket.modelId ?? "").toLowerCase();
          const remaining = bucket.remainingFraction ?? 1;

          if (model.includes("pro")) {
            if (remaining < proMin) {
              proMin = remaining;
              proReset = bucket.resetTime;
            }
          } else if (model.includes("flash")) {
            if (remaining < flashMin) {
              flashMin = remaining;
              flashReset = bucket.resetTime;
            }
          }
        }

        const data: ProviderData = {
          name: "gemini",
          status: "ok",
          primaryLabel: "Pro",
          secondaryLabel: "Flash",
        };

        // remainingFraction is what's LEFT, we want usage percent
        if (proMin !== Infinity) {
          data.primaryPercent = Math.round((1 - proMin) * 100);
          if (proReset) data.primaryResetsAt = new Date(proReset);
        }
        if (flashMin !== Infinity) {
          data.secondaryPercent = Math.round((1 - flashMin) * 100);
          if (flashReset) data.secondaryResetsAt = new Date(flashReset);
        }

        return data;
      } catch (err) {
        return { name: "gemini", status: "error", error: String(err) };
      }
    },
  };
}
