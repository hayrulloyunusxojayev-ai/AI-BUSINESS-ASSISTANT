import app from "./app";
import { logger } from "./lib/logger";
import { ensureSchema } from "./lib/migrate";
import { createTelegramBot, launchBot } from "./lib/telegram";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  await ensureSchema();

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });

  const bot = createTelegramBot();
  if (bot) {
    await launchBot(bot);
  }
}

main().catch((err) => {
  logger.error({ err: String(err) }, "Fatal startup error");
  process.exit(1);
});
