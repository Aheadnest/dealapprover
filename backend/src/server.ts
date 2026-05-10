import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { mysqlPool } from "./integrations/mysql/pool.js";

const app = createApp();

(async () => {
  const conn = await mysqlPool.getConnection();
  conn.release();

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
})().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});

const shutdown = () => {
  console.log("[server] shutting down...");
  mysqlPool.end().catch(console.error).finally(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
