import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { codexEntryType, codexAiScope } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

export const list = query({
  args: {
    bookId: v.id("books"),
    type: v.optional(codexEntryType),
  },
  handler: async (ctx, { bookId, type }) => {
    await requireOwned(ctx, "books", bookId);
    const all = type
      ? await ctx.db
          .query("codexEntries")
          .withIndex("by_book_type", (q) =>
            q.eq("bookId", bookId).eq("type", type)
          )
          .collect()
      : await ctx.db
          .query("codexEntries")
          .withIndex("by_book", (q) => q.eq("bookId", bookId))
          .collect();
    return all.filter((e) => !e.archivedAt);
  },
});

export const get = query({
  args: { id: v.id("codexEntries") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "codexEntries", id);
  },
});

export const search = query({
  args: { bookId: v.id("books"), q: v.string(), type: v.optional(codexEntryType) },
  handler: async (ctx, { bookId, q, type }) => {
    await requireOwned(ctx, "books", bookId);
    const trimmed = q.trim();
    if (!trimmed) return [];
    let qb = ctx.db
      .query("codexEntries")
      .withSearchIndex("search_name", (s) => {
        let chain = s.search("name", trimmed).eq("bookId", bookId);
        if (type) chain = chain.eq("type", type);
        return chain;
      });
    return await qb.take(20);
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    type: codexEntryType,
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    fields: v.any(),
    aiScope: v.optional(codexAiScope),
    matchPatterns: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const book = await requireOwned(ctx, "books", args.bookId);
    const now = Date.now();
    return await ctx.db.insert("codexEntries", {
      bookId: book._id,
      userId: book.userId,
      type: args.type,
      name: args.name.trim() || "Untitled",
      aliases: args.aliases,
      summary: args.summary,
      fields: args.fields ?? {},
      aiScope: args.aiScope ?? "match",
      matchPatterns: args.matchPatterns,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("codexEntries"),
    name: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    fields: v.optional(v.any()),
    aiScope: v.optional(codexAiScope),
    matchPatterns: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...patch }) => {
    const entry = await requireOwned(ctx, "codexEntries", id);
    await ctx.db.patch(entry._id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("codexEntries") },
  handler: async (ctx, { id }) => {
    const entry = await requireOwned(ctx, "codexEntries", id);
    const relations = await ctx.db
      .query("codexRelations")
      .withIndex("by_book", (q) => q.eq("bookId", entry.bookId))
      .collect();
    for (const r of relations) {
      if (r.fromEntryId === entry._id || r.toEntryId === entry._id) {
        await ctx.db.delete(r._id);
      }
    }
    await ctx.db.delete(entry._id);
  },
});

// ---------- Relations ----------

export const listRelations = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("codexRelations")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
  },
});

export const link = mutation({
  args: {
    fromEntryId: v.id("codexEntries"),
    toEntryId: v.id("codexEntries"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { fromEntryId, toEntryId, label }) => {
    const from = await requireOwned(ctx, "codexEntries", fromEntryId);
    const to = await requireOwned(ctx, "codexEntries", toEntryId);
    if (from.bookId !== to.bookId) throw new ConvexError("Cross-book link");
    return await ctx.db.insert("codexRelations", {
      bookId: from.bookId,
      userId: from.userId,
      fromEntryId,
      toEntryId,
      label,
      createdAt: Date.now(),
    });
  },
});

export const unlink = mutation({
  args: { id: v.id("codexRelations") },
  handler: async (ctx, { id }) => {
    const relation = await requireOwned(ctx, "codexRelations", id);
    await ctx.db.delete(relation._id);
  },
});

// ---------- Bulk insert from AI seed extraction ----------

export const bulkUpsertSeeds = mutation({
  args: {
    bookId: v.id("books"),
    seeds: v.array(
      v.object({
        type: codexEntryType,
        name: v.string(),
        summary: v.optional(v.string()),
        fields: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { bookId, seeds }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const existing = await ctx.db
      .query("codexEntries")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    const byKey = new Map(existing.map((e) => [`${e.type}:${e.name.toLowerCase()}`, e]));
    const now = Date.now();
    const inserted: Id<"codexEntries">[] = [];
    for (const seed of seeds) {
      const key = `${seed.type}:${seed.name.toLowerCase()}`;
      if (byKey.has(key)) continue;
      const id = await ctx.db.insert("codexEntries", {
        bookId,
        userId: book.userId,
        type: seed.type,
        name: seed.name,
        summary: seed.summary,
        fields: seed.fields ?? {},
        aiScope: "match",
        createdAt: now,
        updatedAt: now,
      });
      inserted.push(id);
    }
    return { inserted: inserted.length };
  },
});

/**
 * Selects codex entries to inject into chapter generation context. Returns
 * 'always' entries unconditionally; 'match' entries are returned only when
 * their name (or any matchPattern / alias) appears in haystack. 'never'
 * entries are excluded.
 */
export function selectForContext(
  entries: Doc<"codexEntries">[],
  haystack: string
): Doc<"codexEntries">[] {
  const lower = haystack.toLowerCase();
  return entries.filter((e) => {
    if (e.aiScope === "never") return false;
    if (e.aiScope === "always") return true;
    const needles = [e.name, ...(e.aliases ?? []), ...(e.matchPatterns ?? [])]
      .map((n) => n.toLowerCase())
      .filter(Boolean);
    return needles.some((n) => lower.includes(n));
  });
}

export const contextForGeneration = query({
  args: { bookId: v.id("books"), haystack: v.string() },
  handler: async (ctx, { bookId, haystack }) => {
    await requireOwned(ctx, "books", bookId);
    const entries = await ctx.db
      .query("codexEntries")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    return selectForContext(
      entries.filter((e) => !e.archivedAt),
      haystack
    );
  },
});
