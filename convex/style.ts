import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";

export const list = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("styleExamples")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .collect();
  },
});

export const addExample = mutation({
  args: {
    bookId: v.id("books"),
    label: v.optional(v.string()),
    content: v.string(),
  },
  handler: async (ctx, { bookId, label, content }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Content required");
    return await ctx.db.insert("styleExamples", {
      bookId,
      userId: book.userId,
      label,
      content: trimmed,
      createdAt: Date.now(),
    });
  },
});

export const removeExample = mutation({
  args: { id: v.id("styleExamples") },
  handler: async (ctx, { id }) => {
    const example = await requireOwned(ctx, "styleExamples", id);
    await ctx.db.delete(example._id);
  },
});

export const updateGuidance = mutation({
  args: { bookId: v.id("books"), styleGuidance: v.string() },
  handler: async (ctx, { bookId, styleGuidance }) => {
    const book = await requireOwned(ctx, "books", bookId);
    await ctx.db.patch(book._id, { styleGuidance, updatedAt: Date.now() });
  },
});
