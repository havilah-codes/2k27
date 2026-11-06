import { NextRequest, NextResponse } from "next/server";
import { createProviderFromEnv } from "@/lib/ai/provider";
import { processBatch, processOne } from "@/lib/ai/worker";
import { AiProviderError } from "@/lib/ai/types";
import { supabaseEvaluationStore } from "@/lib/supabase/evaluation-store";

/**
 * Evaluation worker endpoint (Stage 5).
 *
 * Triggered by an authenticated cron/webhook — never by the browser:
 *   - POST { "submissionId" } → claim + evaluate one submission
 *   - GET  ?limit=N           → sweep up to N pending submissions
 *
 * Requires `Authorization: Bearer <CRON_SECRET>`. The same route is used by
 * Supabase database webhooks, Vercel Cron, or pg_cron + pg_net — pick one
 * mechanism (see docs/HANDOFF.md §17). Users never wait on this: submissions
 * confirm instantly as `pending` and evaluation happens in the background.
 */

export const maxDuration = 60;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Evaluation secret not configured (set CRON_SECRET)." },
      { status: 503 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !timingSafeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = checkAuth(request);
  if (denied) return denied;

  const rawLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;

  try {
    const provider = createProviderFromEnv();
    const summary = await processBatch({ store: supabaseEvaluationStore, provider, batchSize: limit });
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof AiProviderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = checkAuth(request);
  if (denied) return denied;

  let submissionId: unknown;
  try {
    submissionId = (await request.json())?.submissionId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof submissionId !== "string") {
    return NextResponse.json({ error: "submissionId (string) is required" }, { status: 400 });
  }

  try {
    const provider = createProviderFromEnv();
    const claimed = await supabaseEvaluationStore.claimById(submissionId);
    if (!claimed) {
      return NextResponse.json({ error: "Submission not found or not pending" }, { status: 404 });
    }
    const outcome = await processOne(supabaseEvaluationStore, provider, claimed);
    return NextResponse.json({ submissionId, outcome });
  } catch (err) {
    if (err instanceof AiProviderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
