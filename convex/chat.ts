import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";

const mentionShape = v.object({
  kind: v.union(v.literal("codex"), v.literal("chapter")),
  id: v.string(),
  label: v.string(),
});

export const _getThread = query({
  args: { id: v.id("chatThreads") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "chatThreads", id);
  },
});

export const listThreads = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, { chapterId }) => {
    await requireOwned(ctx, "chapters", chapterId);
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapterId))
      .order("desc")
      .collect();
  },
});

export const getMessages = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, { threadId }) => {
    await requireOwned(ctx, "chatThreads", threadId);
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
  },
});

export const createThread = mutation({
  args: { chapterId: v.id("chapters"), title: v.optional(v.string()) },
  handler: async (ctx, { chapterId, title }) => {
    const chapter = await requireOwned(ctx, "chapters", chapterId);
    const now = Date.now();
    return await ctx.db.insert("chatThreads", {
      chapterId,
      bookId: chapter.bookId,
      userId: chapter.userId,
      title: title?.trim() || "New chat",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const renameThread = mutation({
  args: { id: v.id("chatThreads"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const thread = await requireOwned(ctx, "chatThreads", id);
    await ctx.db.patch(thread._id, { title, updatedAt: Date.now() });
  },
});

export const deleteThread = mutation({
  args: { id: v.id("chatThreads") },
  handler: async (ctx, { id }) => {
    const thread = await requireOwned(ctx, "chatThreads", id);
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .collect();
    for (const m of messages) await ctx.db.delete(m._id);
    await ctx.db.delete(thread._id);
  },
});

export const appendMessage = mutation({
  args: {
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    mentions: v.optional(v.array(mentionShape)),
  },
  handler: async (ctx, { threadId, role, content, mentions }) => {
    const thread = await requireOwned(ctx, "chatThreads", threadId);
    const now = Date.now();
    const id = await ctx.db.insert("chatMessages", {
      threadId,
      userId: thread.userId,
      role,
      content,
      mentions,
      createdAt: now,
    });
    await ctx.db.patch(thread._id, { updatedAt: now });
    return id;
  },
});
