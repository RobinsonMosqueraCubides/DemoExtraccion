import { Agent, fetch as undiciFetch } from 'undici';
import { CONFIG, PRICING_PER_MTOK } from '../config.js';
import { SYSTEM_PROMPT } from '../prompt.js';
import type { TokenUsage } from '../../shared/types.js';

// Pool HTTP/1.1 Keep-Alive persistente para minimizar handshakes TLS en ráfagas paralelas
const httpAgent = new Agent({
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 120_000,
  connections: 64,
  pipelining: 1,
});

export interface RateLimitSnapshot {
  requestsRemaining: number | null;
  inputTokensRemaining: number | null;
  retryAfterSec: number | null;
}

export interface AnthropicCallResult {
  rawText: string;
  stopReason: string | null;
  usage: TokenUsage;
  estimatedCostUsd: number;
  rateLimit: RateLimitSnapshot;
}

export class AnthropicApiError extends Error {
  statusCode: number;
  retryable: boolean;
  retryAfterSec: number | null;

  constructor(
    message: string,
    statusCode: number,
    retryable: boolean,
    retryAfterSec: number | null = null
  ) {
    super(message);
    this.name = 'AnthropicApiError';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfterSec = retryAfterSec;
  }
}

export function estimateCostUsd(usage: TokenUsage): number {
  const cost =
    (usage.inputTokens / 1_000_000) * PRICING_PER_MTOK.input +
    (usage.outputTokens / 1_000_000) * PRICING_PER_MTOK.output +
    (usage.cacheCreationInputTokens / 1_000_000) * PRICING_PER_MTOK.cacheWrite +
    (usage.cacheReadInputTokens / 1_000_000) * PRICING_PER_MTOK.cacheRead;
  return Number(cost.toFixed(6));
}

function parseIntHeader(headers: Headers, name: string): number | null {
  const val = headers.get(name);
  if (!val) return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function callAnthropicForInvoice(
  pdfBase64: string,
  signal: AbortSignal
): Promise<AnthropicCallResult> {
  if (!CONFIG.anthropicApiKey) {
    throw new AnthropicApiError(
      'Falta ANTHROPIC_API_KEY en el archivo .env del servidor.',
      401,
      false
    );
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), CONFIG.requestTimeoutMs);
  const combinedSignal = AbortSignal.any([signal, timeoutController.signal]);

  try {
    const body = {
      model: CONFIG.anthropicModel,
      max_tokens: CONFIG.anthropicMaxTokens,
      thinking: {
        type: 'adaptive',
      },
      output_config: {
        effort: 'medium',
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: {
            type: 'ephemeral',
          },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Extrae los datos de esta factura siguiendo estrictamente el contrato de salida JSON.',
            },
          ],
        },
      ],
    };

    const response = await undiciFetch(CONFIG.anthropicEndpoint, {
      method: 'POST',
      dispatcher: httpAgent,
      signal: combinedSignal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.anthropicApiKey,
        'anthropic-version': CONFIG.anthropicVersion,
      },
      body: JSON.stringify(body),
    });

    const rateLimit: RateLimitSnapshot = {
      requestsRemaining: parseIntHeader(response.headers, 'anthropic-ratelimit-requests-remaining'),
      inputTokensRemaining: parseIntHeader(
        response.headers,
        'anthropic-ratelimit-input-tokens-remaining'
      ),
      retryAfterSec: parseIntHeader(response.headers, 'retry-after'),
    };

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const retryable =
        response.status === 429 ||
        response.status === 529 ||
        response.status >= 500;
      throw new AnthropicApiError(
        `Anthropic HTTP ${response.status}: ${errorBody.slice(0, 300)}`,
        response.status,
        retryable,
        rateLimit.retryAfterSec
      );
    }

    const payload = (await response.json()) as {
      stop_reason?: string | null;
      content?: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };

    const textBlock = payload.content?.find((b) => b.type === 'text' && typeof b.text === 'string');
    if (!textBlock?.text) {
      throw new AnthropicApiError(
        'La respuesta de Anthropic no incluyó un bloque de texto JSON.',
        502,
        true
      );
    }

    const usage: TokenUsage = {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      cacheCreationInputTokens: payload.usage?.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: payload.usage?.cache_read_input_tokens ?? 0,
    };

    return {
      rawText: textBlock.text,
      stopReason: payload.stop_reason ?? null,
      usage,
      estimatedCostUsd: estimateCostUsd(usage),
      rateLimit,
    };
  } catch (err) {
    if (err instanceof AnthropicApiError) throw err;
    if (signal.aborted) {
      throw new AnthropicApiError('Operación cancelada por el usuario.', 499, false);
    }
    if (timeoutController.signal.aborted) {
      throw new AnthropicApiError(
        `Timeout tras ${CONFIG.requestTimeoutMs / 1000}s esperando respuesta de Anthropic.`,
        504,
        true
      );
    }
    throw new AnthropicApiError(
      `Error de red llamando a Anthropic: ${(err as Error).message}`,
      503,
      true
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
