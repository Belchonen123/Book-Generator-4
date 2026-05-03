import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const list = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    const exports = await ctx.db
      .query("bookExports")
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

export const record = mutation({
  args: {
    bookId: v.id("books"),
    format: v.union(
      v.literal("epub"),
      v.literal("pdf"),
      v.literal("kdp"),
      v.literal("boxed_set")
    ),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const book = await requireOwned(ctx, "books", args.bookId);
    const id = await ctx.db.insert("bookExports", {
      bookId: book._id,
      userId: book.userId,
      format: args.format,
      storageId: args.storageId,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    });
    if (args.format === "kdp") {
      await recordEvent(ctx, book.userId, "kdp_pack_downloaded", {
        bookId: book._id,
      });
    } else {
      await recordEvent(ctx, book.userId, "book_compiled", {
        bookId: book._id,
        format: args.format,
      });
    }
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("bookExports") },
  handler: async (ctx, { id }) => {
    const exp = await requireOwned(ctx, "bookExports", id);
    try {
      await ctx.storage.delete(exp.storageId);
    } catch {
      /* already gone */
    }
    await ctx.db.delete(exp._id);
  },
});
