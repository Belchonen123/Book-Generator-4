import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";

export const _getSession = query({
  args: { id: v.id("brainstormSessions") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "brainstormSessions", id);
  },
});

export const listSessions = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("brainstormSessions")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .collect();
  },
});

export const getItems = query({
  args: { sessionId: v.id("brainstormSessions"), includeHidden: v.optional(v.boolean()) },
  handler: async (ctx, { sessionId, includeHidden }) => {
    await requireOwned(ctx, "brainstormSessions", sessionId);
    const items = await ctx.db
      .query("brainstormItems")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();
    return includeHidden ? items : items.filter((i) => !i.isHidden);
  },
});

export const createSession = mutation({
  args: {
    bookId: v.id("books"),
    title: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, { bookId, title, prompt }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const now = Date.now();
    return await ctx.db.insert("brainstormSessions", {
      bookId,
      userId: book.userId,
      title: title.trim() || "Brainstorm",
      prompt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteSession = mutation({
  args: { id: v.id("brainstormSessions") },
  handler: async (ctx, { id }) => {
    const session = await requireOwned(ctx, "brainstormSessions", id);
    const items = await ctx.db
      .query("brainstormItems")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(session._id);
  },
});

export const appendItems = mutation({
  args: {
    sessionId: v.id("brainstormSessions"),
    contents: v.array(v.string()),
  },
  handler: async (ctx, { sessionId, contents }) => {
    const session = await requireOwned(ctx, "brainstormSessions", sessionId);
    const now = Date.now();
    for (const content of contents) {
      const trimmed = content.trim();
      if (!trimmed) continue;
      await ctx.db.insert("brainstormItems", {
        sessionId,
        userId: session.userId,
        content: trimmed,
        isKeeper: false,
        isHidden: false,
        createdAt: now,
      });
    }
    await ctx.db.patch(session._id, { updatedAt: now });
  },
});

export const toggleKeeper = mutation({
  args: { id: v.id("brainstormItems") },
  handler: async (ctx, { id }) => {
    const item = await requireOwned(ctx, "brainstormItems", id);
    await ctx.db.patch(item._id, { isKeeper: !item.isKeeper });
  },
});

export const toggleHidden = mutation({
  args: { id: v.id("brainstormItems") },
  handler: async (ctx, { id }) => {
    const item = await requireOwned(ctx, "brainstormItems", id);
    await ctx.db.patch(item._id, { isHidden: !item.isHidden });
  },
});
