import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import { recordEvent } from "./lib/analytics";

const refinedIdeaShape = v.object({
  premise: v.optional(v.string()),
  mainCharacter: v.optional(v.string()),
  stakes: v.optional(v.string()),
  centralConflict: v.optional(v.string()),
  readerArc: v.optional(v.string()),
});

export const saveBasics = mutation({
  args: {
    bookId: v.id("books"),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    bookType: v.optional(v.union(v.literal("fiction"), v.literal("non-fiction"))),
    genre: v.optional(v.string()),
    tone: v.optional(v.string()),
    rawIdea: v.optional(v.string()),
  },
  handler: async (ctx, { bookId, ...patch }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const next = { ...patch, updatedAt: Date.now() };
    if (patch.title !== undefined) next.title = patch.title.trim() || book.title;
    await ctx.db.patch(book._id, next);
  },
});

export const saveRefinedIdea = mutation({
  args: {
    bookId: v.id("books"),
    refinedIdea: refinedIdeaShape,
    advanceStatus: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookId, refinedIdea, advanceStatus }) => {
    const book = await requireOwned(ctx, "books", bookId);
    const patch: Record<string, unknown> = {
      refinedIdea: { ...book.refinedIdea, ...refinedIdea },
      updatedAt: Date.now(),
    };
    if (advanceStatus && (book.status === "idea" || book.status === "refining")) {
      patch.status = "refining";
    }
    await ctx.db.patch(book._id, patch);
    await recordEvent(ctx, book.userId, "idea_refined", { bookId });
  },
});

export const updateRefinedField = mutation({
  args: {
    bookId: v.id("books"),
    field: v.union(
      v.literal("premise"),
      v.literal("mainCharacter"),
      v.literal("stakes"),
      v.literal("centralConflict"),
      v.literal("readerArc")
    ),
    value: v.string(),
  },
  handler: async (ctx, { bookId, field, value }) => {
    const book = await requireOwned(ctx, "books", bookId);
    await ctx.db.patch(book._id, {
      refinedIdea: { ...book.refinedIdea, [field]: value },
      updatedAt: Date.now(),
    });
  },
});

export const setSubtitle = mutation({
  args: { bookId: v.id("books"), subtitle: v.string() },
  handler: async (ctx, { bookId, subtitle }) => {
    const book = await requireOwned(ctx, "books", bookId);
    await ctx.db.patch(book._id, { subtitle, updatedAt: Date.now() });
  },
});

export const advanceToOutlining = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const book = await requireOwned(ctx, "books", bookId);
    if (book.status === "idea" || book.status === "refining") {
      await ctx.db.patch(book._id, { status: "outlining", updatedAt: Date.now() });
    }
  },
});
