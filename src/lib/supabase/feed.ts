"use server";

import { createSupabaseServerClient } from "./server";
import { getCurrentUser } from "./auth";
import type { SubmissionCategory } from "@/lib/constants";

/**
 * Public feed data. Deliberately contains NO sender information —
 * `public.submissions` has no sender column at all (DECISIONS D1).
 * Only rows real users created are ever returned here.
 */
export interface FeedSubmission {
  id: string;
  recipient: { id: string; displayName: string; className: string };
  content: string;
  category: SubmissionCategory;
  /** Human label, e.g. "2h ago". */
  timeLabel: string;
  reactions: Record<string, number>;
  myReaction: string | null;
}

export interface FeedCollection {
  id: string;
  collectionDate: string;
  status: string;
  publishedAt: string | null;
  itemCount: number;
  submissions: FeedSubmission[];
}

interface SubmissionRow {
  id: string;
  content: string;
  category: SubmissionCategory;
  published_at: string | null;
  created_at: string;
  recipient: { id: string; display_name: string; class_name: string };
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(1, Math.floor((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function attachReactions(rows: SubmissionRow[]): Promise<FeedSubmission[]> {
  const user = await getCurrentUser();
  const ids = rows.map((r) => r.id);
  const counts: Record<string, Record<string, number>> = {};
  const mine: Record<string, string> = {};

  if (ids.length > 0) {
    const supabase = await createSupabaseServerClient();
    const { data: reactions } = await supabase
      .from("reactions")
      .select("submission_id, user_id, reaction_type")
      .in("submission_id", ids);

    for (const r of reactions ?? []) {
      counts[r.submission_id] ??= {};
      counts[r.submission_id][r.reaction_type] =
        (counts[r.submission_id][r.reaction_type] ?? 0) + 1;
      if (user && r.user_id === user.id) {
        mine[r.submission_id] = r.reaction_type;
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    recipient: {
      id: r.recipient.id,
      displayName: r.recipient.display_name,
      className: r.recipient.class_name,
    },
    content: r.content,
    category: r.category,
    timeLabel: timeAgo(r.published_at ?? r.created_at),
    reactions: counts[r.id] ?? {},
    myReaction: mine[r.id] ?? null,
  }));
}

async function fetchSubmissionRows(ids?: string[]): Promise<SubmissionRow[]> {
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("submissions")
    .select(
      "id, content, category, published_at, created_at, recipient:profiles(id, display_name, class_name)",
    )
    .eq("status", "published");

  if (ids) {
    if (ids.length === 0) return [];
    request = request.in("id", ids);
  } else {
    request = request.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data } = await request;
  return (data ?? []) as unknown as SubmissionRow[];
}

/** Today's published feed — newest first. Only real user submissions. */
export async function getPublishedFeed(limit = 50): Promise<FeedSubmission[]> {
  const rows = (await fetchSubmissionRows()).slice(0, limit);
  return attachReactions(rows);
}

/** Published/archived daily collections with their items (real data). */
export async function getCollections(): Promise<FeedCollection[]> {
  const supabase = await createSupabaseServerClient();
  const { data: collections } = await supabase
    .from("daily_collections")
    .select("id, collection_date, status, published_at")
    .in("status", ["published", "archived"])
    .order("collection_date", { ascending: false });

  const result: FeedCollection[] = [];
  for (const col of collections ?? []) {
    const { data: items } = await supabase
      .from("daily_collection_items")
      .select("submission_id, position")
      .eq("collection_id", col.id)
      .order("position", { ascending: true });

    const orderedIds = (items ?? []).map((i) => i.submission_id);
    const rows = await fetchSubmissionRows(orderedIds);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const orderedRows = orderedIds
      .map((id) => byId.get(id))
      .filter((r): r is SubmissionRow => Boolean(r));
    const submissions = await attachReactions(orderedRows);

    result.push({
      id: col.id,
      collectionDate: col.collection_date,
      status: col.status,
      publishedAt: col.published_at,
      itemCount: submissions.length,
      submissions,
    });
  }
  return result;
}

/** Top published submissions by total reaction count (for highlights). */
export async function getTopSubmissions(count = 3): Promise<FeedSubmission[]> {
  const feed = await getPublishedFeed(50);
  return [...feed]
    .sort(
      (a, b) =>
        Object.values(b.reactions).reduce((x, y) => x + y, 0) -
        Object.values(a.reactions).reduce((x, y) => x + y, 0),
    )
    .slice(0, count);
}
