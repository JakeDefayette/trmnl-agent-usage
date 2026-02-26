import type { TrmnlPayload } from "./types.js";
import * as logger from "./logger.js";

export async function postToTrmnl(uuid: string, payload: TrmnlPayload): Promise<void> {
  const url = `https://usetrmnl.com/api/custom_plugins/${uuid}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merge_variables: payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TRMNL POST failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  logger.info(`Posted to TRMNL (${res.status})`);
}
