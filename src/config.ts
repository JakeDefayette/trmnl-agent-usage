export interface Config {
  trmnlWebhookUuid: string;
  trmnlApiKey: string;
  geminiOAuthClientId?: string;
  geminiOAuthClientSecret?: string;
}

export function loadConfig(): Config {
  const trmnlWebhookUuid = process.env.TRMNL_WEBHOOK_UUID;
  const trmnlApiKey = process.env.TRMNL_API_KEY;

  if (!trmnlWebhookUuid) {
    throw new Error("TRMNL_WEBHOOK_UUID is required in .env");
  }
  if (!trmnlApiKey) {
    throw new Error("TRMNL_API_KEY is required in .env");
  }

  return {
    trmnlWebhookUuid,
    trmnlApiKey,
    geminiOAuthClientId: process.env.GEMINI_OAUTH_CLIENT_ID || undefined,
    geminiOAuthClientSecret: process.env.GEMINI_OAUTH_CLIENT_SECRET || undefined,
  };
}
