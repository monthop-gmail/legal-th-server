import type { FastifyRequest } from "fastify";
import { env } from "../utils/env.js";

/**
 * Authenticate request via Bearer token.
 * Returns null if authenticated, error details if not.
 *
 * TODO: Phase 2 — validate against api_keys table in database
 */
export async function authenticate(
  request: FastifyRequest
): Promise<{ details: string } | null> {
  // Skip auth in development
  if (env.NODE_ENV === "development") {
    return null;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { details: "Missing or invalid Authorization header" };
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return { details: "Empty API key" };
  }

  // TODO: validate API key against database
  // const keyRecord = await db.query.apiKeys.findFirst({
  //   where: eq(apiKeys.keyHash, hashApiKey(apiKey))
  // });
  // if (!keyRecord) return { details: "Invalid API key" };

  return null;
}
