import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type AnalyticsEventType =
  | "book_created"
  | "idea_refined"
  | "outline_approved"
  | "chapter_generated"
  | "chapter_approved"
  | "cover_generated"
  | "book_compiled"
  | "book_downloaded"
  | "kdp_pack_downloaded"
  | "upgrade_clicked"
  | "subscription_started"
  | "consistency_checked"
  | "voice_memo_used"
  | "beats_analyzed"
  | "series_created"
  | "series_deleted"
  | "series_book_summarized"
  | "series_boxed_set_compiled"
  | "series_converted_from_standalone";

export async function recordEvent(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: AnalyticsEventType,
  metadata?: Record<string, unknown> & {
    bookId?: Id<"books">;
    seriesId?: Id<"series">;
  }
) {
  const { bookId, seriesId, ...rest } = metadata ?? {};
  await ctx.db.insert("analyticsEvents", {
    userId,
    bookId,
    seriesId,
    type,
    metadata: Object.keys(rest).length ? rest : undefined,
    createdAt: Date.now(),
  });
}
