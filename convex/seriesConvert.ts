import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { ConvexError } from "convex/values";
import { recordEvent } from "./lib/analytics";

/**
 * Promote a standalone book into a new series. The book becomes book #1.
 * Pro-only.
 */
export const convertStandalone = mutation({
  args: {
    bookId: v.id("books"),
    seriesName: v.string(),
    plannedBookCount: v.optional(v.number()),
  },
  handler: async (ctx, { bookId, seriesName, plannedBookCount }) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile?.subscriptionTier !== "pro") {
      throw new ConvexError({ code: "pro_required", message: "Pro tier required" });
    }
    const book = await requireOwned(ctx, "books", bookId);
    if (book.seriesId) {
      throw new ConvexError("Book is already in a series");
    }
    const now = Date.now();
    const seriesId = await ctx.db.insert("series", {
      userId,
      name: seriesName.trim() || `${book.title} series`,
      genre: book.genre,
      plannedBookCount,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(book._id, {
      seriesId,
      seriesOrder: 1,
      updatedAt: now,
    });
    await recordEvent(ctx, userId, "series_converted_from_standalone", {
      seriesId,
      bookId,
    });
    return seriesId;
  },
});
