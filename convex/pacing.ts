import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";

export const getCached = query({
  args: { bookId: v.id("books"), contentHash: v.string() },
  handler: async (ctx, { bookId, contentHash }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("pacingAnalyses")
      .withIndex("by_book_hash", (q) =>
        q.eq("bookId", bookId).eq("contentHash", contentHash)
      )
      .unique();
  },
});

export const latestForBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    const all = await ctx.db
      .query("pacingAnalyses")
      .withIndex("by_book_hash", (q) => q.eq("bookId", bookId))
      .collect();
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
});

export const saveResult = mutation({
  args: {
    bookId: v.id("books"),
    contentHash: v.string(),
    result: v.any(),
  },
  handler: async (ctx, { bookId, contentHash, result }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const existing = await ctx.db
      .query("pacingAnalyses")
      .withIndex("by_book_hash", (q) =>
        q.eq("bookId", bookId).eq("contentHash", contentHash)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { result, createdAt: Date.now() });
      return existing._id;
    }
    const id = await ctx.db.insert("pacingAnalyses", {
      bookId,
      userId: book.userId,
      contentHash,
      result,
      createdAt: Date.now(),
    });
    await recordEvent(ctx, book.userId, "beats_analyzed", { bookId });
    return id;
  },
});
