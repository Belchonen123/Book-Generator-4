import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { codexEntryType, codexAiScope } from "./schema";

export const list = query({
  args: { seriesId: v.id("series"), type: v.optional(codexEntryType) },
  handler: async (ctx, { seriesId, type }) => {
    await requireOwned(ctx, "series", seriesId);
    const all = type
      ? await ctx.db
          .query("seriesCodexEntries")
          .withIndex("by_series_type", (q) =>
            q.eq("seriesId", seriesId).eq("type", type)
          )
          .collect()
      : await ctx.db
          .query("seriesCodexEntries")
          .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
          .collect();
    return all;
  },
});

export const create = mutation({
  args: {
    seriesId: v.id("series"),
    type: codexEntryType,
    name: v.string(),
    summary: v.optional(v.string()),
    fields: v.optional(v.any()),
    aiScope: v.optional(codexAiScope),
  },
  handler: async (ctx, args) => {
    const series = await requireOwned(ctx, "series", args.seriesId);
    const now = Date.now();
    return await ctx.db.insert("seriesCodexEntries", {
      seriesId: series._id,
      userId: series.userId,
      type: args.type,
      name: args.name.trim() || "Untitled",
      summary: args.summary,
      fields: args.fields ?? {},
      aiScope: args.aiScope ?? "match",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("seriesCodexEntries"),
    name: v.optional(v.string()),
    summary: v.optional(v.string()),
    fields: v.optional(v.any()),
    aiScope: v.optional(codexAiScope),
  },
  handler: async (ctx, { id, ...patch }) => {
    const entry = await requireOwned(ctx, "seriesCodexEntries", id);
    await ctx.db.patch(entry._id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("seriesCodexEntries") },
  handler: async (ctx, { id }) => {
    const entry = await requireOwned(ctx, "seriesCodexEntries", id);
    await ctx.db.delete(entry._id);
  },
});
