import { AiProviderError } from "./types.ts";
import type { EvaluationRequest, LlmProvider, RawEvaluation } from "./types.ts";
import { EVALUATION_SYSTEM_PROMPT, buildUserPayload } from "./prompt.ts";
import { validateAiResponse } from "./validate.ts";

/**
 * Configurable LLM provider layer (Stage 5).
 *
 * - `openai`    — any OpenAI-compatible chat-completions endpoint
 * - `anthropic` — Anthropic Messages API
 * - `mock`      — deterministic offline adapter for tests + local dev
 *
 * Env (all server-only):
 *   LLM_PROVIDER       openai | anthropic | mock   (default: openai)
 *   OPENAI_API_KEY / ANTHROPIC_API_KEY
 *   OPENAI_BASE_URL    optional override (default https://api.openai.com/v1)
 *   LLM_MODEL          default gpt-4o-mini / claude-haiku-4-5-20251001
 *   LLM_TIMEOUT_MS     default 25000
 *   LLM_MAX_RETRIES    default 2 (so ≤ 3 attempts per evaluation)
 *
 * Domain errors are surfaced as AiProviderError with a stable code so the
 * worker can decide retry vs. give up vs. flag.
 */

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_RETRIES = 2;

export interface ProviderConfig {
  timeoutMs: number;
  maxRetries: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getProviderConfig(): ProviderConfig {
  return {
    timeoutMs: envInt("LLM_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    maxRetries: envInt("LLM_MAX_RETRIES", DEFAULT_MAX_RETRIES),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiProviderError("timeout", `AI request timed out after ${timeoutMs}ms`);
    }
    throw new AiProviderError("upstream", `AI request failed: ${err instanceof Error ? err.message : "network error"}`);
  } finally {
    clearTimeout(timer);
  }
}

function throwIfHttpError(status: number, bodyText: string): void {
  if (status === 401 || status === 403) {
    throw new AiProviderError("auth", `AI provider rejected credentials (HTTP ${status})`);
  }
  if (status === 429 || status >= 500) {
    throw new AiProviderError("upstream", `AI provider error (HTTP ${status})`);
  }
  if (status >= 400) {
    throw new AiProviderError("config", `AI provider client error (HTTP ${status}): ${bodyText.slice(0, 200)}`);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiProviderError("malformed", "AI provider returned non-JSON content");
  }
}

/** Retry wrapper: retries ONLY retryable errors (timeout / upstream / malformed). */
async function withRetries<T>(config: ProviderConfig, attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= config.maxRetries; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (!(err instanceof AiProviderError)) throw err;
      if (err.code === "auth" || err.code === "config") throw err;
      lastError = err;
      if (i < config.maxRetries) await sleep(500 * 2 ** i);
    }
  }
  throw lastError instanceof Error ? lastError : new AiProviderError("upstream", "AI evaluation failed");
}

class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly config: ProviderConfig;

  constructor(apiKey: string, model: string, baseUrl: string, config: ProviderConfig) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.config = config;
  }

  async evaluate(request: EvaluationRequest): Promise<RawEvaluation> {
    return withRetries(this.config, async () => {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: EVALUATION_SYSTEM_PROMPT },
              { role: "user", content: buildUserPayload(request) },
            ],
          }),
        },
        this.config.timeoutMs,
      );
      const text = await response.text();
      throwIfHttpError(response.status, text);
      const parsed = parseJson(text);
      const content = (parsed as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
        ?.content;
      if (typeof content !== "string") {
        throw new AiProviderError("malformed", "AI response missing message content");
      }
      return validateAiResponse(parseJson(content));
    });
  }
}

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly apiKey: string;
  private readonly config: ProviderConfig;

  constructor(apiKey: string, model: string, config: ProviderConfig) {
    this.apiKey = apiKey;
    this.model = model;
    this.config = config;
  }

  async evaluate(request: EvaluationRequest): Promise<RawEvaluation> {
    return withRetries(this.config, async () => {
      const response = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 1024,
            temperature: 0.2,
            system: EVALUATION_SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildUserPayload(request) }],
          }),
        },
        this.config.timeoutMs,
      );
      const text = await response.text();
      throwIfHttpError(response.status, text);
      const parsed = parseJson(text);
      const blocks = (parsed as { content?: Array<{ type?: string; text?: string }> })?.content;
      const outText = blocks?.find((b) => b.type === "text")?.text;
      if (typeof outText !== "string") {
        throw new AiProviderError("malformed", "AI response missing text content");
      }
      return validateAiResponse(parseJson(outText));
    });
  }
}

/**
 * Deterministic mock provider — used for tests and local development when no
 * real API key is configured (`LLM_PROVIDER=mock`). Content markers (run
 * through the SAME validation path as real providers):
 *   [mock:threat] [mock:discrimination] [mock:harassment] [mock:private_info]
 *   [mock:ambiguous] [mock:low_confidence] [mock:malformed]
 * Anything else → approved with mid-high comedy scores.
 */
class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly model = "mock";

  async evaluate(request: EvaluationRequest): Promise<RawEvaluation> {
    const text = request.content.toLowerCase();
    const base: RawEvaluation = {
      moderation_status: "approved",
      moderation_category: "none",
      moderation_reason: "Mock evaluation approved this submission.",
      humour_score: 80,
      originality_score: 75,
      creativity_score: 70,
      relatability_score: 85,
      confidence: 0.9,
      short_evaluation: "Mock: eligible content with solid comedic value.",
    };
    if (text.includes("[mock:threat]")) {
      return { ...base, moderation_status: "rejected", moderation_category: "threat", moderation_reason: "Mock: contains a direct threat.", humour_score: null, originality_score: null, creativity_score: null, relatability_score: null, confidence: 0.95, short_evaluation: "Mock: clear threat." };
    }
    if (text.includes("[mock:discrimination]")) {
      return { ...base, moderation_status: "rejected", moderation_category: "discrimination", moderation_reason: "Mock: discriminatory insult targeting a protected group.", humour_score: null, originality_score: null, creativity_score: null, relatability_score: null, confidence: 0.93, short_evaluation: "Mock: protected-group attack." };
    }
    if (text.includes("[mock:harassment]")) {
      return { ...base, moderation_status: "rejected", moderation_category: "harassment", moderation_reason: "Mock: repeated targeted harassment (history shows a pattern).", humour_score: null, originality_score: null, creativity_score: null, relatability_score: null, confidence: 0.88, short_evaluation: "Mock: harassment pattern." };
    }
    if (text.includes("[mock:private_info]")) {
      return { ...base, moderation_status: "rejected", moderation_category: "private_info", moderation_reason: "Mock: publishes private personal information.", humour_score: null, originality_score: null, creativity_score: null, relatability_score: null, confidence: 0.97, short_evaluation: "Mock: private information disclosed." };
    }
    if (text.includes("[mock:ambiguous]")) {
      return { ...base, moderation_status: "flagged", moderation_category: "none", moderation_reason: "Mock: borderline content, human review required.", humour_score: null, originality_score: null, creativity_score: null, relatability_score: null, confidence: 0.55, short_evaluation: "Mock: ambiguous." };
    }
    if (text.includes("[mock:low_confidence]")) {
      return { ...base, confidence: 0.4 };
    }
    if (text.includes("[mock:malformed]")) {
      throw new AiProviderError("malformed", "Mock: malformed AI response");
    }
    return base;
  }
}

export function createMockProvider(): LlmProvider {
  return new MockProvider();
}

/** Build the configured provider from server env. Never call from the browser. */
export function createProviderFromEnv(): LlmProvider {
  const providerName = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  const config = getProviderConfig();

  if (providerName === "mock") return new MockProvider();

  if (providerName === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AiProviderError("config", "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    }
    return new AnthropicProvider(apiKey, process.env.LLM_MODEL ?? "claude-haiku-4-5-20251001", config);
  }

  if (providerName === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AiProviderError("config", "OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    }
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    return new OpenAiCompatibleProvider(apiKey, process.env.LLM_MODEL ?? "gpt-4o-mini", baseUrl.replace(/\/$/, ""), config);
  }

  throw new AiProviderError("config", `Unknown LLM_PROVIDER: ${providerName} (expected openai | anthropic | mock)`);
}
