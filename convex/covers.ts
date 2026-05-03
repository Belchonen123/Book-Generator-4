import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const listVariants = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await requireOwned(ctx, "books", bookId);
    const variants = await ctx.db
      .query("coverVariants")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("desc")
      .collect();
    return await Promise.all(
      variants.map(async (v) => ({
        ...v,
        url: await ctx.storage.getUrl(v.storageId),
      }))
    );
  },
});

export const getActive = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const book = await requireOwned(ctx, "books", bookId);
    if (!book.coverStorageId) return null;
    return {
      storageId: book.coverStorageId,
      url: await ctx.storage.getUrl(book.coverStorageId),
    };
  },
});

export const recordVariant = mutation({
  args: {
    bookId: v.id("books"),
    storageId: v.id("_storage"),
    source: v.union(v.literal("ai"), v.literal("upload")),
    prompt: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    setActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const book = await requireOwned(ctx, "books", args.bookId);
    const now = Date.now();
    const id = await ctx.db.insert("coverVariants", {
      bookId: book._id,
      userId: book.userId,
      storageId: args.storageId,
      source: args.source,
      prompt: args.prompt,
      width: args.width,
      height: args.height,
      createdAt: now,
    });
    if (args.setActive ?? true) {
      await ctx.db.patch(book._id, {
        coverStorageId: args.storageId,
        coverUrl: undefined,
        updatedAt: now,
      });
      if (args.source === "ai") {
        await recordEvent(ctx, book.userId, "cover_generated", {
          bookId: book._id,
        });
      }
    }
    return id;
  },
});

export const setActive = mutation({
  args: { variantId: v.id("coverVariants") },
  handler: async (ctx, { variantId }) => {
    const variant = await requireOwned(ctx, "coverVariants", variantId);
    const book = await ctx.db.get(variant.bookId);
    if (!book) throw new Error("Book missing");
    await ctx.db.patch(book._id, {
      coverStorageId: variant.storageId,
      coverUrl: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const removeVariant = mutation({
  args: { variantId: v.id("coverVariants") },
  handler: async (ctx, { variantId }) => {
    const variant = await requireOwned(ctx, "coverVariants", variantId);
    const book = await ctx.db.get(variant.bookId);
    try {
      await ctx.storage.delete(variant.storageId);
    } catch {
      /* already gone */
    }
    if (book?.coverStorageId === variant.storageId) {
      await ctx.db.patch(book._id, {
        coverStorageId: undefined,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.delete(variant._id);
  },
});
