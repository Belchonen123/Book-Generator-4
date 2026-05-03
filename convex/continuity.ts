import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";

export const listForChapter = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, { chapterId }) => {
    await requireOwned(ctx, "chapters", chapterId);
    const all = await ctx.db
      .query("continuityWarnings")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapterId))
      .order("desc")
      .collect();
    return all.filter((w) => !w.dismissedAt && !w.resolvedAt);
  },
});

export const listForBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    const all = await ctx.db
      .query("continuityWarnings")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .collect();
    return all.filter((w) => !w.dismissedAt && !w.resolvedAt);
  },
});

export const dismiss = mutation({
  args: { id: v.id("continuityWarnings") },
  handler: async (ctx, { id }) => {
    const w = await requireOwned(ctx, "continuityWarnings", id);
    await ctx.db.patch(w._id, { dismissedAt: Date.now() });
  },
});

export const resolve = mutation({
  args: { id: v.id("continuityWarnings") },
  handler: async (ctx, { id }) => {
    const w = await requireOwned(ctx, "continuityWarnings", id);
    await ctx.db.patch(w._id, { resolvedAt: Date.now() });
  },
});

/**
 * Bulk insert from the AI consistency check. Drops any prior un-actioned
 * warnings for this chapter so the panel reflects the latest run.
 */
export const replaceForChapter = mutation({
  args: {
    chapterId: v.id("chapters"),
    warnings: v.array(
      v.object({
        severity: v.union(
          v.literal("info"),
          v.literal("warn"),
          v.literal("error")
        ),
        title: v.string(),
        detail: v.string(),
        relatedCodexIds: v.optional(v.array(v.id("codexEntries"))),
      })
    ),
  },
  handler: async (ctx, { chapterId, warnings }) => {
    const chapter = await requireOwned(ctx, "chapters", chapterId);
    const existing = await ctx.db
      .query("continuityWarnings")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapterId))
      .collect();
    for (const w of existing) {
      if (!w.dismissedAt && !w.resolvedAt) {
        await ctx.db.delete(w._id);
      }
    }
    const now = Date.now();
    for (const w of warnings) {
      await ctx.db.insert("continuityWarnings", {
        bookId: chapter.bookId,
        chapterId: chapter._id,
        userId: chapter.userId,
        severity: w.severity,
        title: w.title,
        detail: w.detail,
        relatedCodexIds: w.relatedCodexIds,
        createdAt: now,
      });
    }
    await recordEvent(ctx, chapter.userId, "consistency_checked", {
      bookId: chapter.bookId,
      chapterId: chapter._id,
      warningCount: warnings.length,
    });
    return { count: warnings.length };
  },
});
