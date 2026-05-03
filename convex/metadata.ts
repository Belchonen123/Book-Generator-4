import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOwned } from "./lib/auth";

const metadataShape = v.object({
  keywords: v.optional(v.array(v.string())),
  category: v.optional(v.string()),
  backCover: v.optional(v.string()),
  aboutAuthor: v.optional(v.string()),
});

export const updateMetadata = mutation({
  args: {
    bookId: v.id("books"),
    patch: metadataShape,
  },
  handler: async (ctx, { bookId, patch }) => {
    const book = await requireOwned(ctx, "books", bookId);
    await ctx.db.patch(book._id, {
      metadata: { ...(book.metadata ?? {}), ...patch },
      updatedAt: Date.now(),
    });
  },
});
