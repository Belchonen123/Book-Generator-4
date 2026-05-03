import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("outlineSections")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("asc")
      .collect();
  },
});

// Internal-ish helper for the expand-outline AI route. Still ownership-checked.
export const _getSection = query({
  args: { id: v.id("outlineSections") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "outlineSections", id);
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    title: v.string(),
    summary: v.string(),
    notes: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { bookId, title, summary, notes, order }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const now = Date.now();
    const max = await ctx.db
      .query("outlineSections")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .first();
    return await ctx.db.insert("outlineSections", {
      bookId,
      userId: book.userId,
      order: order ?? (max ? max.order + 1 : 1),
      title,
      summary,
      notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("outlineSections"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const section = await requireOwned(ctx, "outlineSections", id);
    await ctx.db.patch(section._id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("outlineSections") },
  handler: async (ctx, { id }) => {
    const section = await requireOwned(ctx, "outlineSections", id);
    await ctx.db.delete(section._id);
  },
});

export const reorder = mutation({
  args: {
    bookId: v.id("books"),
    orderedIds: v.array(v.id("outlineSections")),
  },
  handler: async (ctx, { bookId, orderedIds }) => {
    await requireOwned(ctx, "books", bookId);
    for (let i = 0; i < orderedIds.length; i++) {
      const section = await ctx.db.get(orderedIds[i]);
      if (!section || section.bookId !== bookId) continue;
      await ctx.db.patch(orderedIds[i], {
        order: i + 1,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Replaces the entire outline. Used by the AI generator after producing a
 * fresh outline from the refined idea.
 */
export const replaceAll = mutation({
  args: {
    bookId: v.id("books"),
    sections: v.array(
      v.object({
        title: v.string(),
        summary: v.string(),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { bookId, sections }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const existing = await ctx.db
      .query("outlineSections")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    const now = Date.now();
    const ids: Id<"outlineSections">[] = [];
    for (let i = 0; i < sections.length; i++) {
      const id = await ctx.db.insert("outlineSections", {
        bookId,
        userId: book.userId,
        order: i + 1,
        title: sections[i].title,
        summary: sections[i].summary,
        notes: sections[i].notes,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }
    if (book.status === "idea" || book.status === "refining") {
      await ctx.db.patch(book._id, { status: "outlining", updatedAt: now });
    }
    return ids;
  },
});

/**
 * Approves the outline. Transitions to "writing", marks every section as
 * approved, and seeds chapter rows. The character bible is generated and
 * saved separately by the AI route that also calls this.
 */
export const approve = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const sections = await ctx.db
      .query("outlineSections")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("asc")
      .collect();
    if (sections.length === 0) throw new Error("Outline is empty");

    const now = Date.now();
    for (const s of sections) {
      await ctx.db.patch(s._id, { approvedAt: now, updatedAt: now });
    }

    const existingChapters = await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    const existingByOrder = new Map(existingChapters.map((c) => [c.order, c]));
    for (let i = 0; i < sections.length; i++) {
      const order = i + 1;
      if (existingByOrder.has(order)) continue;
      await ctx.db.insert("chapters", {
        bookId,
        userId: book.userId,
        order,
        title: sections[i].title,
        content: "",
        plainText: "",
        status: "pending",
        wordCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(book._id, {
      status: "writing",
      chapterCount: sections.length,
      updatedAt: now,
    });
    await recordEvent(ctx, book.userId, "outline_approved", { bookId });
    return { sectionCount: sections.length };
  },
});

export const upsertCharacterBible = mutation({
  args: { bookId: v.id("books"), content: v.string() },
  handler: async (ctx, { bookId, content }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const existing = await ctx.db
      .query("characterBibles")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { content, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("characterBibles", {
      bookId,
      userId: book.userId,
      content,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getCharacterBible = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("characterBibles")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .unique();
  },
});
