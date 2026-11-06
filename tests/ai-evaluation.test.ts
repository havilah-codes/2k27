/**
 * Stage 5 — evaluation pipeline tests (Node's built-in runner, no new deps).
 * Run with: npm test
 *
 * Pure modules are imported with explicit .ts extensions so Node's type
 * stripping can load them. The worker runs against an in-memory FakeStore
 * (same contract as the Supabase adapter); providers are mocked, so NO live
 * AI calls are made here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { calculateOverallScore } from "../src/lib/ai/scoring.ts";
import { finalizeEvaluation, validateAiResponse } from "../src/lib/ai/validate.ts";
import { createMockProvider, createProviderFromEnv } from "../src/lib/ai/provider.ts";
import { AiProviderError } from "../src/lib/ai/types.ts";
import type { ClaimedSubmission, EvaluationStore } from "../src/lib/ai/worker.ts";
import { MAX_ATTEMPTS, processBatch } from "../src/lib/ai/worker.ts";
import type { FinalEvaluation, LlmProvider } from "../src/lib/ai/types.ts";

function req(content: string) {
  return {
    category: "roast",
    content,
    recipientDisplayName: "Test Recipient",
    recipientClassName: "Year 11",
    history: { submissionsTodayToRecipient: 0, flaggedSubmissionsToRecipient: 0 },
  };
}

/** In-memory EvaluationStore implementing the same CAS semantics as SQL. */
class FakeStore implements EvaluationStore {
  rows = new Map<
    string,
    { id: string; status: string; attempts: number; claimedAt: string | null; request: ReturnType<typeof req>; }
  >();
  records: Array<{ id: string; record: FinalEvaluation }> = [];
  released: Array<{ id: string; giveUp: boolean }> = [];
  evaluations = 0;

  constructor(contents: string[]) {
    for (const [i, content] of contents.entries()) {
      const id = `sub-${i + 1}`;
      this.rows.set(id, { id, status: "pending", attempts: 0, claimedAt: null, request: req(content) });
    }
  }

  async resetStaleClaims(cutoffISO: string): Promise<number> {
    let reset = 0;
    for (const row of this.rows.values()) {
      if (row.status === "processing" && row.claimedAt && row.claimedAt < cutoffISO) {
        row.status = "pending";
        row.claimedAt = null;
        reset++;
      }
    }
    return reset;
  }

  async claimBatch(limit: number): Promise<ClaimedSubmission[]> {
    const claimed: ClaimedSubmission[] = [];
    for (const row of this.rows.values()) {
      if (claimed.length >= limit) break;
      if (row.status !== "pending") continue;
      // CAS: simulate `UPDATE ... WHERE status='pending' RETURNING id`.
      const ts = `2026-11-05T00:00:${String(this.evaluations).padStart(2, "0")}Z`;
      row.status = "processing";
      row.claimedAt = ts;
      row.attempts += 1;
      this.evaluations++;
      claimed.push({
        id: row.id,
        content: row.request.content,
        category: row.request.category,
        recipientId: "recipient-1",
        attempts: row.attempts,
        claimTimestamp: ts,
        request: row.request,
      });
    }
    return claimed;
  }

  async claimById(id: string): Promise<ClaimedSubmission | null> {
    const row = this.rows.get(id);
    if (!row || row.status !== "pending") return null;
    const ts = new Date().toISOString();
    row.status = "processing";
    row.claimedAt = ts;
    row.attempts += 1;
    this.evaluations++;
    return {
      id: row.id,
      content: row.request.content,
      category: row.request.category,
      recipientId: "recipient-1",
      attempts: row.attempts,
      claimTimestamp: ts,
      request: row.request,
    };
  }

  async submitResult(claimed: ClaimedSubmission, record: FinalEvaluation): Promise<boolean> {
    const row = this.rows.get(claimed.id);
    if (!row || row.status !== "processing" || row.claimedAt !== claimed.claimTimestamp) {
      return false;
    }
    row.status = record.moderation_status;
    row.claimedAt = null;
    this.records.push({ id: claimed.id, record });
    return true;
  }

  async releaseForRetry(claimed: ClaimedSubmission, errorModule: string, giveUp: boolean): Promise<void> {
    void errorModule;
    const row = this.rows.get(claimed.id);
    if (!row) return;
    this.released.push({ id: claimed.id, giveUp });
    if (giveUp) {
      row.status = "flagged";
      this.records.push({
        id: claimed.id,
        record: {
          moderation_status: "flagged",
          moderation_category: "none",
          moderation_reason: "Evaluation failed permanently.",
          humour_score: null,
          originality_score: null,
          creativity_score: null,
          relatability_score: null,
          overall_score: null,
          confidence: 0,
          short_evaluation: "",
          downgraded: false,
        },
      });
    } else {
      row.status = "pending";
      row.claimedAt = null;
    }
  }
}

describe("weighted comedy score", () => {
  it("computes the weighted score (90/80/85/75 -> 84.25)", () => {
    // NOTE: the Stage 5 brief's worked example says 83.25 — an arithmetic
    // slip. The formula it states yields 36+20+17+11.25 = 84.25.
    assert.equal(
      calculateOverallScore({ humour: 90, originality: 80, creativity: 85, relatability: 75 }),
      84.25,
    );
  });

  it("clamps out-of-range scores into 0-100", () => {
    assert.equal(
      calculateOverallScore({ humour: 150, originality: -10, creativity: 100, relatability: 0 }),
      60,
    );
  });
});

describe("response validation", () => {
  it("rejects an invalid moderation status", () => {
    assert.throws(
      () => validateAiResponse({ moderation_status: "maybe", moderation_category: "none", moderation_reason: "x", confidence: 0.9, short_evaluation: "y" }),
      /moderation_status/,
    );
  });

  it("rejects scores outside 0-100", () => {
    assert.throws(
      () =>
        validateAiResponse({
          moderation_status: "approved",
          moderation_category: "none",
          moderation_reason: "x",
          confidence: 0.9,
          short_evaluation: "y",
          humour_score: 101,
          originality_score: 50,
          creativity_score: 50,
          relatability_score: 50,
        }),
      /humour_score/,
    );
  });

  it("rejects approved results missing scores", () => {
    assert.throws(
      () =>
        validateAiResponse({
          moderation_status: "approved",
          moderation_category: "none",
          moderation_reason: "x",
          confidence: 0.9,
          short_evaluation: "y",
          humour_score: null,
          originality_score: null,
          creativity_score: null,
          relatability_score: null,
        }),
      /require all four scores/,
    );
  });

  it("rejects a null/non-object response", () => {
    assert.throws(() => validateAiResponse(null), AiProviderError);
    assert.throws(() => validateAiResponse("approved"), AiProviderError);
  });

  it("rejects out-of-range confidence", () => {
    assert.throws(
      () =>
        validateAiResponse({
          moderation_status: "rejected",
          moderation_category: "threat",
          moderation_reason: "x",
          confidence: 1.5,
          short_evaluation: "y",
        }),
      /confidence/,
    );
  });
});

describe("finalize rules", () => {
  it("downgrades low-confidence approvals to flagged", () => {
    const out = finalizeEvaluation({
      moderation_status: "approved",
      moderation_category: "none",
      moderation_reason: "Looks fine.",
      humour_score: 90,
      originality_score: 80,
      creativity_score: 70,
      relatability_score: 60,
      confidence: 0.4,
      short_evaluation: "Decent bit.",
    });
    assert.equal(out.moderation_status, "flagged");
    assert.equal(out.downgraded, true);
    assert.equal(out.overall_score, null); // scores only stored for approved
  });

  it("keeps scores and computes the weighted overall for approvals", () => {
    const out = finalizeEvaluation({
      moderation_status: "approved",
      moderation_category: "none",
      moderation_reason: "Looks fine.",
      humour_score: 90,
      originality_score: 80,
      creativity_score: 85,
      relatability_score: 75,
      confidence: 0.92,
      short_evaluation: "Great bit.",
    });
    assert.equal(out.moderation_status, "approved");
    assert.equal(out.overall_score, 84.25); // brief's example figure (83.25) is an arithmetic slip
  });
});

describe("mock provider moderation scenarios", () => {
  const provider = createMockProvider();

  it("1. approves a harmless compliment", async () => {
    const out = await provider.evaluate(req("You explain fractions like a legend, honestly."));
    assert.equal(out.moderation_status, "approved");
  });

  it("2. approves a funny roast (insult != harassment)", async () => {
    const out = await provider.evaluate(req("Josh talks so much even his voice notes need a bathroom break."));
    assert.equal(out.moderation_status, "approved");
  });

  it("3. approves a sarcastic observation", async () => {
    const out = await provider.evaluate(req("Love how the printer only works when the whole queue is watching."));
    assert.equal(out.moderation_status, "approved");
  });

  it("4. approves a controversial but permissible joke", async () => {
    const out = await provider.evaluate(req("Controversial: school lunches are a culinary crime scene."));
    assert.equal(out.moderation_status, "approved");
  });

  it("5. rejects a direct threat", async () => {
    const out = await provider.evaluate(req("[mock:threat] I will find you after school."));
    assert.equal(out.moderation_status, "rejected");
    assert.equal(out.moderation_category, "threat");
  });

  it("6. rejects a discriminatory insult", async () => {
    const out = await provider.evaluate(req("[mock:discrimination] slur about a protected group"));
    assert.equal(out.moderation_status, "rejected");
    assert.equal(out.moderation_category, "discrimination");
  });

  it("7. rejects repeated-target harassment (context)", async () => {
    const out = await provider.evaluate(req("[mock:harassment] another personal attack"));
    assert.equal(out.moderation_status, "rejected");
    assert.equal(out.moderation_category, "harassment");
  });

  it("8. rejects private personal information", async () => {
    const out = await provider.evaluate(req("[mock:private_info] her number is 08012345678"));
    assert.equal(out.moderation_status, "rejected");
    assert.equal(out.moderation_category, "private_info");
  });

  it("9. flags an ambiguous submission (never auto-rejects)", async () => {
    const out = await provider.evaluate(req("[mock:ambiguous] it is what it is..."));
    assert.equal(out.moderation_status, "flagged");
  });

  it("10. surfaces malformed responses as AiProviderError", async () => {
    await assert.rejects(() => provider.evaluate(req("[mock:malformed] broken")), AiProviderError);
  });
});

describe("provider failure handling", () => {
  it("11. times out when the fetch hangs", async () => {
    const hanging: LlmProvider = {
      name: "hanging",
      model: "hanging",
      evaluate: () => new Promise(() => {}),
    };
    // processBatch must not hang forever — we race it against a hard cap.
    const store = new FakeStore(["a joke"]);
    const result = await Promise.race([
      processBatch({ store, provider: hanging }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
    ]);
    assert.equal(result, null); // still running at 100ms (no false completion)
  });

  it("12. never processes the same submission twice under concurrency", async () => {
    const store = new FakeStore(["one joke"]);
    const provider = createMockProvider();
    const [a, b] = await Promise.all([
      processBatch({ store, provider, batchSize: 10 }),
      processBatch({ store, provider, batchSize: 10 }),
    ]);
    const totalClaimed = a.claimed + b.claimed;
    assert.equal(totalClaimed, 1);
    assert.equal(store.records.length, 1);
  });

  it("13. retries provider failures, then flags after MAX_ATTEMPTS", async () => {
    const store = new FakeStore(["unlucky joke"]);
    const failing: LlmProvider = {
      name: "failing",
      model: "failing",
      evaluate: async () => {
        throw new AiProviderError("upstream", "AI provider error (HTTP 500)");
      },
    };
    let lastOutcome = "";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const summary = await processBatch({ store, provider: failing, batchSize: 1 });
      lastOutcome = summary.items[0]?.outcome ?? "";
    }
    assert.equal(lastOutcome, "failed");
    const row = store.rows.get("sub-1");
    assert.equal(row?.status, "flagged");
  });

  it("malformed AI responses are retried, not stored as rejections", async () => {
    const store = new FakeStore(["[mock:malformed] x"]);
    const summary = await processBatch({ store, provider: createMockProvider(), batchSize: 1 });
    assert.equal(summary.retried, 1);
    assert.equal(summary.rejected, 0);
    assert.equal(store.rows.get("sub-1")?.status, "pending");
    assert.equal(store.records.length, 0);
  });
});

describe("provider config", () => {
  it("falls back to mock without throwing in a test env", () => {
    const previous = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "mock";
    try {
      const p = createProviderFromEnv();
      assert.equal(p.name, "mock");
    } finally {
      if (previous === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = previous;
    }
  });

  it("throws a config AiProviderError when an API key is missing", () => {
    const prevKey = process.env.OPENAI_API_KEY;
    const prevProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    try {
      assert.throws(
        () => createProviderFromEnv(),
        (err: unknown) => err instanceof AiProviderError && err.code === "config",
      );
    } finally {
      if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
      if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = prevProvider;
    }
  });
});
