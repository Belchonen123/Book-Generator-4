import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const _getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    // Caller is authed; storageId is opaque, but we restrict to URL only.
    return await ctx.storage.getUrl(storageId);
  },
});

export const _getJob = query({
  args: { id: v.id("audioJobs") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "audioJobs", id);
  },
});

export const listJobs = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("audioJobs")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .collect();
  },
});

export const listExports = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    const exports = await ctx.db
      .query("audioExports")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .collect();
    return await Promise.all(
      exports.map(async (e) => ({
        ...e,
        url: await ctx.storage.getUrl(e.storageId),
      }))
    );
  },
});

export const enqueue = mutation({
  args: {
    bookId: v.id("books"),
    chapterId: v.id("chapters"),
    voiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const chapter = await requireOwned(ctx, "chapters", args.chapterId);
    if (chapter.bookId !== args.bookId) throw new Error("Chapter mismatch");
    const existing = await ctx.db
      .query("audioJobs")
      .withIndex("by_chapter", (q) => q.eq("chapterId", args.chapterId))
      .collect();
    for (const job of existing) {
      if (job.status === "pending" || job.status === "running") {
        return { jobId: job._id, reused: true };
      }
    }
    const id = await ctx.db.insert("audioJobs", {
      bookId: args.bookId,
      chapterId: args.chapterId,
      userId: chapter.userId,
      voiceId: args.voiceId,
      status: "pending",
      createdAt: Date.now(),
    });
    return { jobId: id, reused: false };
  },
});

export const markRunning = mutation({
  args: { jobId: v.id("audioJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await requireOwned(ctx, "audioJobs", jobId);
    await ctx.db.patch(job._id, { status: "running", startedAt: Date.now() });
  },
});

export const markComplete = mutation({
  args: { jobId: v.id("audioJobs"), storageId: v.id("_storage") },
  handler: async (ctx, { jobId, storageId }) => {
    const job = await requireOwned(ctx, "audioJobs", jobId);
    await ctx.db.patch(job._id, {
      status: "complete",
      storageId,
      completedAt: Date.now(),
      error: undefined,
    });
  },
});

export const markFailed = mutation({
  args: { jobId: v.id("audioJobs"), error: v.string() },
  handler: async (ctx, { jobId, error }) => {
    const job = await requireOwned(ctx, "audioJobs", jobId);
    await ctx.db.patch(job._id, {
      status: "failed",
      error,
      completedAt: Date.now(),
    });
  },
});

export const recordExport = mutation({
  args: {
    bookId: v.id("books"),
    voiceId: v.string(),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const book = await requireOwned(ctx, "books", args.bookId);
    return await ctx.db.insert("audioExports", {
      bookId: book._id,
      userId: book.userId,
      voiceId: args.voiceId,
      storageId: args.storageId,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    });
  },
});
