export interface Config {
  trmnlWebhookUuid: string;
}

export function loadConfig(): Config {
  const trmnlWebhookUuid = process.env.TRMNL_WEBHOOK_UUID;

  if (!trmnlWebhookUuid) {
    throw new Error("TRMNL_WEBHOOK_UUID is required in .env");
  }

  return {
    trmnlWebhookUuid,
  };
}
