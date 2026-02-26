import { loadConfig } from "./config.js";
import { claude } from "./providers/claude.js";
import { codex } from "./providers/codex.js";
import { createGeminiProvider } from "./providers/gemini.js";
import { flatten } from "./normalizer.js";
import { postToTrmnl } from "./poster.js";
import type { TrmnlPayload } from "./types.js";
import * as logger from "./logger.js";

async function main() {
  const config = loadConfig();
  const gemini = createGeminiProvider(config.geminiOAuthClientId, config.geminiOAuthClientSecret);

  logger.info("Fetching usage from all providers...");

  const [claudeData, codexData, geminiData] = await Promise.all([
    claude.fetch(),
    codex.fetch(),
    gemini.fetch(),
  ]);

  logger.info(`Claude: ${claudeData.status}, Codex: ${codexData.status}, Gemini: ${geminiData.status}`);

  const payload: TrmnlPayload = {
    claude: flatten(claudeData),
    codex: flatten(codexData),
    gemini: flatten(geminiData),
    updated_at: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };

  await postToTrmnl(config.trmnlWebhookUuid, payload);
  logger.info("Done.");
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
