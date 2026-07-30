import { loadConfig } from "./config.js";
import { claude } from "./providers/claude.js";
import { codex } from "./providers/codex.js";
import { flatten } from "./normalizer.js";
import { postToTrmnl } from "./poster.js";
import type { TrmnlPayload } from "./types.js";
import * as logger from "./logger.js";

async function main() {
  const config = loadConfig();

  logger.info("Fetching usage from Claude and Codex...");

  const [claudeData, codexData] = await Promise.all([
    claude.fetch(),
    codex.fetch(),
  ]);

  logger.info(`Claude: ${claudeData.status}, Codex: ${codexData.status}`);

  const payload: TrmnlPayload = {
    claude: flatten(claudeData),
    codex: flatten(codexData),
    updated_at: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };

  await postToTrmnl(config.trmnlWebhookUuid, payload);
  logger.info("Done.");
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
