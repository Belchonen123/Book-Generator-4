import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { arcType, arcStatus, beatKind, beatStatus } from "./schema";

// ---------- Arcs ----------

export const listArcs = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    await requireOwned(ctx, "series", seriesId);
    return await ctx.db
      .query("seriesArcs")
      .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
      .order("asc")
      .collect();
  },
});

export const _getArc = query({
  args: { id: v.id("seriesArcs") },
  handler: async (ctx, { id }) => await requireOwned(ctx, "seriesArcs", id),
});

export const createArc = mutation({
  args: {
    seriesId: v.id("series"),
    name: v.string(),
    type: arcType,
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const series = await requireOwned(ctx, "series", args.seriesId);
    const last = await ctx.db
      .query("seriesArcs")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .order("desc")
      .first();
    const now = Date.now();
    return await ctx.db.insert("seriesArcs", {
      seriesId: series._id,
      userId: series.userId,
      name: args.name.trim() || "Untitled arc",
      type: args.type,
      description: args.description,
      status: "setup",
      order: last ? last.order + 1 : 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateArc = mutation({
  args: {
    id: v.id("seriesArcs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(arcStatus),
    type: v.optional(arcType),
  },
  handler: async (ctx, { id, ...patch }) => {
    const arc = await requireOwned(ctx, "seriesArcs", id);
    await ctx.db.patch(arc._id, { ...patch, updatedAt: Date.now() });
  },
});

export const removeArc = mutation({
  args: { id: v.id("seriesArcs") },
  handler: async (ctx, { id }) => {
    const arc = await requireOwned(ctx, "seriesArcs", id);
    const beats = await ctx.db
      .query("seriesArcBeats")
      .withIndex("by_arc", (q) => q.eq("arcId", arc._id))
      .collect();
    for (const beat of beats) await ctx.db.delete(beat._id);
    await ctx.db.delete(arc._id);
  },
});

// ---------- Beats ----------

export const listBeats = query({
  args: { arcId: v.id("seriesArcs") },
  handler: async (ctx, { arcId }) => {
    await requireOwned(ctx, "seriesArcs", arcId);
    return await ctx.db
      .query("seriesArcBeats")
      .withIndex("by_arc", (q) => q.eq("arcId", arcId))
      .order("asc")
      .collect();
  },
});

export const beatsForSeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    await requireOwned(ctx, "series", seriesId);
    return await ctx.db
      .query("seriesArcBeats")
      .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
      .collect();
  },
});

export const _getBeat = query({
  args: { id: v.id("seriesArcBeats") },
  handler: async (ctx, { id }) => await requireOwned(ctx, "seriesArcBeats", id),
});

export const createBeat = mutation({
  args: {
    arcId: v.id("seriesArcs"),
    kind: beatKind,
    title: v.string(),
    description: v.optional(v.string()),
    bookId: v.optional(v.id("books")),
    chapterId: v.optional(v.id("chapters")),
  },
  handler: async (ctx, args) => {
    const arc = await requireOwned(ctx, "seriesArcs", args.arcId);
    const last = await ctx.db
      .query("seriesArcBeats")
      .withIndex("by_arc", (q) => q.eq("arcId", arc._id))
      .order("desc")
      .first();
    const now = Date.now();
    return await ctx.db.insert("seriesArcBeats", {
      arcId: arc._id,
      seriesId: arc.seriesId,
      userId: arc.userId,
      bookId: args.bookId,
      chapterId: args.chapterId,
      kind: args.kind,
      title: args.title.trim() || "Untitled beat",
      description: args.description,
      status: "planned",
      order: last ? last.order + 1 : 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBeat = mutation({
  args: {
    id: v.id("seriesArcBeats"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(beatStatus),
    kind: v.optional(beatKind),
    bookId: v.optional(v.id("books")),
    chapterId: v.optional(v.id("chapters")),
  },
  handler: async (ctx, { id, ...patch }) => {
    const beat = await requireOwned(ctx, "seriesArcBeats", id);
    await ctx.db.patch(beat._id, { ...patch, updatedAt: Date.now() });
  },
});

export const removeBeat = mutation({
  args: { id: v.id("seriesArcBeats") },
  handler: async (ctx, { id }) => {
    const beat = await requireOwned(ctx, "seriesArcBeats", id);
    await ctx.db.delete(beat._id);
  },
});
