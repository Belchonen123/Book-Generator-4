import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";
import { revisionSource as revisionSourceValidator, chapterStatus } from "./schema";
import type { Id } from "./_generated/dataModel";

export const listForBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    return await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("asc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("chapters") },
  handler: async (ctx, { id }) => {
    return await requireOwned(ctx, "chapters", id);
  },
});

export const create = mutation({
  args: { bookId: v.id("books"), title: v.string() },
  handler: async (ctx, { bookId, title }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const last = await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .first();
    const now = Date.now();
    const id = await ctx.db.insert("chapters", {
      bookId,
      userId: book.userId,
      order: last ? last.order + 1 : 1,
      title,
      content: "",
      plainText: "",
      status: "pending",
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(book._id, {
      chapterCount: book.chapterCount + 1,
      updatedAt: now,
    });
    return id;
  },
});

export const updateTitle = mutation({
  args: { id: v.id("chapters"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const chapter = await requireOwned(ctx, "chapters", id);
    await ctx.db.patch(chapter._id, { title, updatedAt: Date.now() });
  },
});

export const saveContent = mutation({
  args: {
    id: v.id("chapters"),
    content: v.string(),
    plainText: v.string(),
    wordCount: v.number(),
    snapshotRevision: v.optional(v.boolean()),
    revisionSource: v.optional(revisionSourceValidator),
    revisionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const chapter = await requireOwned(ctx, "chapters", args.id);
    const now = Date.now();
    const previousWords = chapter.wordCount;

    if (args.snapshotRevision && chapter.content) {
      await ctx.db.insert("chapterRevisions", {
        chapterId: chapter._id,
        bookId: chapter.bookId,
        userId: chapter.userId,
        source: args.revisionSource ?? "manual_save",
        content: chapter.content,
        plainText: chapter.plainText,
        wordCount: chapter.wordCount,
        note: args.revisionNote,
        createdAt: now,
      });
    }

    await ctx.db.patch(chapter._id, {
      content: args.content,
      plainText: args.plainText,
      wordCount: args.wordCount,
      status: chapter.status === "pending" ? "draft" : chapter.status,
      updatedAt: now,
    });

    const book = await ctx.db.get(chapter.bookId);
    if (book) {
      await ctx.db.patch(book._id, {
        wordCount: Math.max(0, book.wordCount - previousWords + args.wordCount),
        updatedAt: now,
      });
    }
  },
});

export const setStatus = mutation({
  args: { id: v.id("chapters"), status: chapterStatus },
  handler: async (ctx, { id, status }) => {
    const chapter = await requireOwned(ctx, "chapters", id);
    const patch: Record<string, unknown> = { status, updatedAt: Date.now() };
    if (status === "approved") {
      // Recorded via analytics event below.
    }
    await ctx.db.patch(chapter._id, patch);
    if (status === "approved") {
      await recordEvent(ctx, chapter.userId, "chapter_approved", {
        bookId: chapter.bookId,
        chapterId: chapter._id,
      });
    }
  },
});

export const beginGeneration = mutation({
  args: { id: v.id("chapters") },
  handler: async (ctx, { id }) => {
    const chapter = await requireOwned(ctx, "chapters", id);
    await ctx.db.patch(chapter._id, {
      status: "generating",
      generationStartedAt: Date.now(),
      lastGenerationError: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const completeGeneration = mutation({
  args: {
    id: v.id("chapters"),
    content: v.string(),
    plainText: v.string(),
    wordCount: v.number(),
  },
  handler: async (ctx, args) => {
    const chapter = await requireOwned(ctx, "chapters", args.id);
    const now = Date.now();

    if (chapter.content) {
      await ctx.db.insert("chapterRevisions", {
        chapterId: chapter._id,
        bookId: chapter.bookId,
        userId: chapter.userId,
        source: "generation",
        content: chapter.content,
        plainText: chapter.plainText,
        wordCount: chapter.wordCount,
        createdAt: now,
      });
    }

    const previousWords = chapter.wordCount;
    await ctx.db.patch(chapter._id, {
      content: args.content,
      plainText: args.plainText,
      wordCount: args.wordCount,
      status: "draft",
      generationCompletedAt: now,
      updatedAt: now,
    });

    const book = await ctx.db.get(chapter.bookId);
    if (book) {
      await ctx.db.patch(book._id, {
        wordCount: Math.max(0, book.wordCount - previousWords + args.wordCount),
        updatedAt: now,
      });
    }

    await recordEvent(ctx, chapter.userId, "chapter_generated", {
      bookId: chapter.bookId,
      chapterId: chapter._id,
      wordCount: args.wordCount,
    });
  },
});

export const failGeneration = mutation({
  args: { id: v.id("chapters"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    const chapter = await requireOwned(ctx, "chapters", id);
    await ctx.db.patch(chapter._id, {
      status: chapter.content ? "draft" : "pending",
      lastGenerationError: error,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("chapters") },
  handler: async (ctx, { id }) => {
    const chapter = await requireOwned(ctx, "chapters", id);
    const dependents: Array<keyof typeof DEPENDENT_INDEXES> = [
      "chapterRevisions",
      "chatThreads",
      "chatMessages",
      "continuityWarnings",
      "slopScans",
      "audioJobs",
    ];
    for (const table of dependents) {
      const rows = await ctx.db
        // @ts-expect-error: index name varies per table; we map below
        .query(table)
        // @ts-expect-error: idx
        .withIndex(DEPENDENT_INDEXES[table], (q) => q.eq("chapterId", chapter._id))
        .collect();
      for (const row of rows as Array<{ _id: Id<"chapterRevisions"> }>) {
        await ctx.db.delete(row._id);
      }
    }

    const book = await ctx.db.get(chapter.bookId);
    if (book) {
      await ctx.db.patch(book._id, {
        chapterCount: Math.max(0, book.chapterCount - 1),
        wordCount: Math.max(0, book.wordCount - chapter.wordCount),
        updatedAt: Date.now(),
      });
    }
    await ctx.db.delete(chapter._id);
  },
});

const DEPENDENT_INDEXES = {
  chapterRevisions: "by_chapter",
  chatThreads: "by_chapter",
  chatMessages: "by_thread", // not used; chatMessages cleared via thread cascade
  continuityWarnings: "by_chapter",
  slopScans: "by_chapter_hash",
  audioJobs: "by_chapter",
} as const;

// ---------- Revisions ----------

export const listRevisions = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, { chapterId }) => {
    await requireOwned(ctx, "chapters", chapterId);
    return await ctx.db
      .query("chapterRevisions")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapterId))
      .order("desc")
      .collect();
  },
});

export const restoreRevision = mutation({
  args: { revisionId: v.id("chapterRevisions") },
  handler: async (ctx, { revisionId }) => {
    const revision = await requireOwned(ctx, "chapterRevisions", revisionId);
    const chapter = await ctx.db.get(revision.chapterId);
    if (!chapter) throw new ConvexError("Chapter missing");
    const now = Date.now();
    await ctx.db.insert("chapterRevisions", {
      chapterId: chapter._id,
      bookId: chapter.bookId,
      userId: chapter.userId,
      source: "restore",
      content: chapter.content,
      plainText: chapter.plainText,
      wordCount: chapter.wordCount,
      createdAt: now,
    });
    const previousWords = chapter.wordCount;
    await ctx.db.patch(chapter._id, {
      content: revision.content,
      plainText: revision.plainText,
      wordCount: revision.wordCount,
      updatedAt: now,
    });
    const book = await ctx.db.get(chapter.bookId);
    if (book) {
      await ctx.db.patch(book._id, {
        wordCount: Math.max(
          0,
          book.wordCount - previousWords + revision.wordCount
        ),
        updatedAt: now,
      });
    }
  },
});

export const deleteRevision = mutation({
  args: { revisionId: v.id("chapterRevisions") },
  handler: async (ctx, { revisionId }) => {
    const revision = await requireOwned(ctx, "chapterRevisions", revisionId);
    await ctx.db.delete(revision._id);
  },
});

// ---------- Heal stuck chapters (cron) ----------

const STUCK_AFTER_MS = 5 * 60 * 1000; // 5 minutes

export const healStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stuck = await ctx.db
      .query("chapters")
      .withIndex("by_status", (q) => q.eq("status", "generating"))
      .collect();
    let healed = 0;
    for (const chapter of stuck) {
      if (
        chapter.generationStartedAt &&
        now - chapter.generationStartedAt > STUCK_AFTER_MS
      ) {
        await ctx.db.patch(chapter._id, {
          status: chapter.content ? "draft" : "pending",
          lastGenerationError: "Generation timed out — recoverable",
          updatedAt: now,
        });
        healed++;
      }
    }
    return { healed };
  },
});
