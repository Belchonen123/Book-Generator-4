import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId, requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";

const FREE_BOOK_LIMIT = 3;

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("books")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const get = query({
  args: { id: v.id("books") },
  handler: async (ctx, { id }) => {
    const book = await requireOwned(ctx, "books", id);
    return book;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    bookType: v.optional(
      v.union(v.literal("fiction"), v.literal("non-fiction"))
    ),
  },
  handler: async (ctx, { title, bookType }) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new ConvexError("Profile missing");

    if (profile.subscriptionTier === "free") {
      const existing = await ctx.db
        .query("books")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const active = existing.filter((b) => !b.archivedAt);
      if (active.length >= FREE_BOOK_LIMIT) {
        throw new ConvexError({
          code: "tier_limit",
          message: `Free tier is limited to ${FREE_BOOK_LIMIT} books. Upgrade to Pro for unlimited.`,
        });
      }
    }

    const trimmed = title.trim() || "Untitled";
    const now = Date.now();
    const bookId = await ctx.db.insert("books", {
      userId,
      title: trimmed,
      bookType,
      status: "idea",
      wordCount: 0,
      chapterCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await recordEvent(ctx, userId, "book_created", { bookId });
    return bookId;
  },
});

export const rename = mutation({
  args: { id: v.id("books"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const book = await requireOwned(ctx, "books", id);
    const trimmed = title.trim();
    if (!trimmed) throw new ConvexError("Title required");
    await ctx.db.patch(book._id, { title: trimmed, updatedAt: Date.now() });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("books"),
    status: v.union(
      v.literal("idea"),
      v.literal("refining"),
      v.literal("outlining"),
      v.literal("writing"),
      v.literal("editing"),
      v.literal("cover"),
      v.literal("complete")
    ),
  },
  handler: async (ctx, { id, status }) => {
    const book = await requireOwned(ctx, "books", id);
    await ctx.db.patch(book._id, { status, updatedAt: Date.now() });
  },
});

export const archive = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, { id }) => {
    const book = await requireOwned(ctx, "books", id);
    await ctx.db.patch(book._id, { archivedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const unarchive = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, { id }) => {
    const book = await requireOwned(ctx, "books", id);
    await ctx.db.patch(book._id, { archivedAt: undefined, updatedAt: Date.now() });
  },
});

/**
 * Hard delete — removes the book and every dependent row + storage object.
 * Each later phase that adds a book-owned table extends the list below.
 */
export const remove = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, { id }) => {
    const book = await requireOwned(ctx, "books", id);
    await deleteBookCascade(ctx, book._id);
  },
});

async function deleteBookCascade(
  ctx: Parameters<typeof remove.handler>[0],
  bookId: import("./_generated/dataModel").Id<"books">
) {
  const tables = [
    "outlineSections",
    "chapters",
    "chapterRevisions",
    "styleExamples",
    "characterBibles",
    "codexEntries",
    "codexRelations",
    "continuityWarnings",
    "chatThreads",
    "chatMessages",
    "brainstormSessions",
    "brainstormItems",
    "pacingAnalyses",
    "slopScans",
    "audioJobs",
    "audioExports",
    "bookExports",
    "coverVariants",
  ] as const;

  for (const table of tables) {
    const rows = await ctx.db
      .query(table)
      // @ts-expect-error: every dependent table declares this index
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    for (const row of rows) {
      const storageId = (row as { storageId?: import("./_generated/dataModel").Id<"_storage"> })
        .storageId;
      if (storageId) {
        try {
          await ctx.storage.delete(storageId);
        } catch {
          /* already gone */
        }
      }
      await ctx.db.delete(row._id);
    }
  }

  const book = await ctx.db.get(bookId);
  if (book?.coverStorageId) {
    try {
      await ctx.storage.delete(book.coverStorageId);
    } catch {
      /* already gone */
    }
  }
  await ctx.db.delete(bookId);
}
