import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { recordEvent } from "./lib/analytics";
import { seriesStatus } from "./schema";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("series")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("series") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "series", id);
  },
});

export const booksInSeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    await requireOwned(ctx, "series", seriesId);
    const books = await ctx.db
      .query("books")
      .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
      .collect();
    return books
      .filter((b) => !b.archivedAt)
      .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
  },
});

async function assertPro(ctx: Parameters<typeof create.handler>[0]) {
  const userId = await requireUserId(ctx);
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (profile?.subscriptionTier !== "pro") {
    throw new ConvexError({ code: "pro_required", message: "Pro tier required" });
  }
  return userId;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    tagline: v.optional(v.string()),
    genre: v.optional(v.string()),
    plannedBookCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await assertPro(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("series", {
      userId,
      name: args.name.trim() || "Untitled series",
      description: args.description,
      tagline: args.tagline,
      genre: args.genre,
      plannedBookCount: args.plannedBookCount,
      status: "planning",
      createdAt: now,
      updatedAt: now,
    });
    await recordEvent(ctx, userId, "series_created", { seriesId: id });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("series"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tagline: v.optional(v.string()),
    genre: v.optional(v.string()),
    plannedBookCount: v.optional(v.number()),
    status: v.optional(seriesStatus),
    worldNotes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const series = await requireOwned(ctx, "series", id);
    await ctx.db.patch(series._id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, { id }) => {
    const series = await requireOwned(ctx, "series", id);

    // Cascade: arcs+beats, codex, member books (just unlink books, don't
    // delete the books themselves)
    const arcs = await ctx.db
      .query("seriesArcs")
      .withIndex("by_series", (q) => q.eq("seriesId", series._id))
      .collect();
    for (const arc of arcs) {
      const beats = await ctx.db
        .query("seriesArcBeats")
        .withIndex("by_arc", (q) => q.eq("arcId", arc._id))
        .collect();
      for (const beat of beats) await ctx.db.delete(beat._id);
      await ctx.db.delete(arc._id);
    }
    const codex = await ctx.db
      .query("seriesCodexEntries")
      .withIndex("by_series", (q) => q.eq("seriesId", series._id))
      .collect();
    for (const entry of codex) await ctx.db.delete(entry._id);

    const books = await ctx.db
      .query("books")
      .withIndex("by_series", (q) => q.eq("seriesId", series._id))
      .collect();
    for (const book of books) {
      await ctx.db.patch(book._id, {
        seriesId: undefined,
        seriesOrder: undefined,
        updatedAt: Date.now(),
      });
    }

    if (series.coverStorageId) {
      try {
        await ctx.storage.delete(series.coverStorageId);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.delete(series._id);
    await recordEvent(ctx, series.userId, "series_deleted", { seriesId: id });
  },
});

export const addBook = mutation({
  args: { seriesId: v.id("series"), bookId: v.id("books"), order: v.optional(v.number()) },
  handler: async (ctx, { seriesId, bookId, order }) => {
    const series = await requireOwned(ctx, "series", seriesId);
    const book = await requireOwned(ctx, "books", bookId);
    const existing = await ctx.db
      .query("books")
      .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
      .collect();
    const nextOrder =
      order ??
      (existing.length === 0
        ? 1
        : Math.max(...existing.map((b) => b.seriesOrder ?? 0)) + 1);
    await ctx.db.patch(book._id, {
      seriesId: series._id,
      seriesOrder: nextOrder,
      updatedAt: Date.now(),
    });
  },
});

export const removeBook = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const book = await requireOwned(ctx, "books", bookId);
    await ctx.db.patch(book._id, {
      seriesId: undefined,
      seriesOrder: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const reorderBooks = mutation({
  args: {
    seriesId: v.id("series"),
    orderedBookIds: v.array(v.id("books")),
  },
  handler: async (ctx, { seriesId, orderedBookIds }) => {
    await requireOwned(ctx, "series", seriesId);
    const now = Date.now();
    for (let i = 0; i < orderedBookIds.length; i++) {
      const book = await ctx.db.get(orderedBookIds[i]);
      if (!book || book.seriesId !== seriesId) continue;
      await ctx.db.patch(orderedBookIds[i], {
        seriesOrder: i + 1,
        updatedAt: now,
      });
    }
  },
});
