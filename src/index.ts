import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { mcpHandler } from "./routes/mcp.js";
import { env } from "./utils/env.js";

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
});

// Plugins
await app.register(cors);
await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
});

// MCP endpoint
app.post("/mcp", mcpHandler);

// Health check
app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));

// Start
try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Legal-TH MCP Server running on ${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
