import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { searchLaws } from "../services/search-laws.js";
import { glossaryLookup } from "../services/glossary.js";
import { getTemplate } from "../services/templates.js";

// JSON-RPC 2.0 request schema
const jsonRpcRequest = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

// Method router
const methods: Record<
  string,
  (params: Record<string, unknown>) => Promise<unknown>
> = {
  "legal_th/search_laws": searchLaws,
  "legal_th/glossary_lookup": glossaryLookup,
  "legal_th/get_template": getTemplate,
  // Phase 2:
  // "legal_th/check_compliance": checkCompliance,
  // "legal_th/generate_contract": generateContract,
  // "legal_th/generate_checklist": generateChecklist,
  // Phase 3:
  // "legal_th/regulatory_updates": regulatoryUpdates,
};

export async function mcpHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<JsonRpcResponse> {
  // Authenticate
  const authError = await authenticate(request);
  if (authError) {
    return reply.status(401).send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Authorization failed", data: authError },
    });
  }

  // Parse request
  const parsed = jsonRpcRequest.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "Invalid request",
        data: parsed.error.issues,
      },
    });
  }

  const { id, method, params } = parsed.data;

  // Find method handler
  const handler = methods[method];
  if (!handler) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  }

  // Execute
  try {
    const result = await handler(params ?? {});
    return { jsonrpc: "2.0", id, result };
  } catch (err) {
    request.log.error(err, `Error in ${method}`);
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data:
          err instanceof Error ? err.message : "Unknown error",
      },
    };
  }
}
