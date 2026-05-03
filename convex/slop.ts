import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";

export const getCached = query({
  args: { chapterId: v.id("chapters"), contentHash: v.string() },
  handler: async (ctx, { chapterId, contentHash }) => {
    await requireOwned(ctx, "chapters", chapterId);
    return await ctx.db
      .query("slopScans")
      .withIndex("by_chapter_hash", (q) =>
        q.eq("chapterId", chapterId).eq("contentHash", contentHash)
      )
      .unique();
  },
});

export const latestForChapter = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, { chapterId }) => {
    await requireOwned(ctx, "chapters", chapterId);
    const all = await ctx.db
      .query("slopScans")
      .withIndex("by_chapter_hash", (q) => q.eq("chapterId", chapterId))
      .collect();
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
});

export const saveResult = mutation({
  args: {
    chapterId: v.id("chapters"),
    contentHash: v.string(),
    regexHits: v.any(),
    deepdive: v.optional(v.any()),
  },
  handler: async (ctx, { chapterId, contentHash, regexHits, deepdive }) => {
    const chapter = await requireOwned(ctx, "chapters", chapterId);
    const existing = await ctx.db
      .query("slopScans")
      .withIndex("by_chapter_hash", (q) =>
        q.eq("chapterId", chapterId).eq("contentHash", contentHash)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        regexHits,
        deepdive: deepdive ?? existing.deepdive,
        createdAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("slopScans", {
      chapterId,
      bookId: chapter.bookId,
      userId: chapter.userId,
      contentHash,
      regexHits,
      deepdive,
      createdAt: Date.now(),
    });
  },
});
