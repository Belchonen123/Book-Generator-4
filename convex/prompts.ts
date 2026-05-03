import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

/**
 * Resolves a prompt for the given (task, optional book) context. The Next.js
 * AI routes call this before generating, then merge with built-in defaults
 * from `lib/ai/prompts.ts` when nothing custom exists.
 */
export const resolve = query({
  args: {
    promptKey: v.string(),
    bookId: v.optional(v.id("books")),
  },
  handler: async (ctx, { promptKey, bookId }) => {
    const userId = await requireUserId(ctx);

    if (bookId) {
      const book = await ctx.db.get(bookId);
      if (!book || book.userId !== userId) throw new Error("Not found");
      const bookOverride = await ctx.db
        .query("customPrompts")
        .withIndex("by_book_key", (q) => q.eq("bookId", bookId).eq("promptKey", promptKey))
        .unique();
      if (bookOverride) {
        return { template: bookOverride.template, source: "book" as const };
      }
    }

    const userOverride = await ctx.db
      .query("customPrompts")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("promptKey", promptKey))
      .filter((q) => q.eq(q.field("bookId"), undefined))
      .unique();
    if (userOverride) {
      return { template: userOverride.template, source: "user" as const };
    }

    const platform = await ctx.db
      .query("platformPrompts")
      .withIndex("by_key", (q) => q.eq("promptKey", promptKey))
      .unique();
    if (platform) {
      return { template: platform.template, source: "platform" as const };
    }

    return null;
  },
});

export const list = query({
  args: { bookId: v.optional(v.id("books")) },
  handler: async (ctx, { bookId }) => {
    const userId = await requireUserId(ctx);
    const userPrompts = await ctx.db
      .query("customPrompts")
      .withIndex("by_user_key", (q) => q.eq("userId", userId))
      .collect();
    return userPrompts.filter((p) => (bookId ? p.bookId === bookId : !p.bookId));
  },
});

export const save = mutation({
  args: {
    promptKey: v.string(),
    template: v.string(),
    bookId: v.optional(v.id("books")),
  },
  handler: async (ctx, { promptKey, template, bookId }) => {
    const userId = await requireUserId(ctx);
    if (bookId) {
      const book = await ctx.db.get(bookId);
      if (!book || book.userId !== userId) throw new Error("Not found");
    }
    const now = Date.now();
    const existing = await findExisting(ctx, userId, promptKey, bookId);
    if (existing) {
      await ctx.db.patch(existing._id, { template, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("customPrompts", {
      userId,
      bookId,
      promptKey,
      template,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { promptKey: v.string(), bookId: v.optional(v.id("books")) },
  handler: async (ctx, { promptKey, bookId }) => {
    const userId = await requireUserId(ctx);
    const existing = await findExisting(ctx, userId, promptKey, bookId);
    if (existing) await ctx.db.delete(existing._id);
  },
});

async function findExisting(
  ctx: Parameters<typeof save.handler>[0],
  userId: Id<"users">,
  promptKey: string,
  bookId: Id<"books"> | undefined
) {
  if (bookId) {
    return await ctx.db
      .query("customPrompts")
      .withIndex("by_book_key", (q) => q.eq("bookId", bookId).eq("promptKey", promptKey))
      .unique();
  }
  return await ctx.db
    .query("customPrompts")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("promptKey", promptKey))
    .filter((q) => q.eq(q.field("bookId"), undefined))
    .unique();
}
