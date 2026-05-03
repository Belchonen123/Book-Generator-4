import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(needle: string, opts: { caseSensitive: boolean; wholeWord: boolean }) {
  const flags = opts.caseSensitive ? "g" : "gi";
  const escaped = escapeRegex(needle);
  return new RegExp(opts.wholeWord ? `\\b${escaped}\\b` : escaped, flags);
}

export const preview = query({
  args: {
    bookId: v.id("books"),
    needle: v.string(),
    caseSensitive: v.optional(v.boolean()),
    wholeWord: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookId, needle, caseSensitive, wholeWord }) => {
    await requireOwned(ctx, "books", bookId);
    if (!needle) return [];
    const pattern = buildPattern(needle, {
      caseSensitive: !!caseSensitive,
      wholeWord: !!wholeWord,
    });
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .order("asc")
      .collect();
    return chapters
      .map((c) => {
        const matches = c.plainText.match(pattern);
        return {
          chapterId: c._id,
          chapterTitle: c.title,
          chapterOrder: c.order,
          count: matches?.length ?? 0,
        };
      })
      .filter((m) => m.count > 0);
  },
});

export const applyReplace = mutation({
  args: {
    bookId: v.id("books"),
    needle: v.string(),
    replacement: v.string(),
    caseSensitive: v.optional(v.boolean()),
    wholeWord: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookId, needle, replacement, caseSensitive, wholeWord }) => {
    const book = await requireOwned(ctx, "books", bookId);
    if (!needle) throw new Error("Empty needle");
    const pattern = buildPattern(needle, {
      caseSensitive: !!caseSensitive,
      wholeWord: !!wholeWord,
    });
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();

    const now = Date.now();
    const changed: { chapterId: Id<"chapters">; replacements: number }[] = [];
    let totalReplacements = 0;

    for (const chapter of chapters) {
      pattern.lastIndex = 0;
      const matches = chapter.plainText.match(pattern);
      if (!matches?.length) continue;
      const replacements = matches.length;

      // Snapshot prior content as a revision.
      await ctx.db.insert("chapterRevisions", {
        chapterId: chapter._id,
        bookId: chapter.bookId,
        userId: chapter.userId,
        source: "find_replace",
        content: chapter.content,
        plainText: chapter.plainText,
        wordCount: chapter.wordCount,
        note: `Find/replace: "${needle}" → "${replacement}" (${replacements})`,
        createdAt: now,
      });

      const newPlain = chapter.plainText.replace(pattern, replacement);
      const newJsonContent = chapter.content
        ? chapter.content.replace(
            new RegExp(`"text"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*?)"`, "g"),
            (full, captured: string) => {
              try {
                const decoded = JSON.parse(`"${captured}"`) as string;
                pattern.lastIndex = 0;
                if (!pattern.test(decoded)) return full;
                pattern.lastIndex = 0;
                const replaced = decoded.replace(pattern, replacement);
                return `"text":${JSON.stringify(replaced)}`;
              } catch {
                return full;
              }
            }
          )
        : "";

      const newWordCount = newPlain.trim() ? newPlain.trim().split(/\s+/).length : 0;
      const wordDelta = newWordCount - chapter.wordCount;

      await ctx.db.patch(chapter._id, {
        content: newJsonContent,
        plainText: newPlain,
        wordCount: newWordCount,
        updatedAt: now,
      });
      await ctx.db.patch(book._id, {
        wordCount: Math.max(0, book.wordCount + wordDelta),
        updatedAt: now,
      });

      changed.push({ chapterId: chapter._id, replacements });
      totalReplacements += replacements;
    }

    return { chaptersChanged: changed.length, totalReplacements, changed };
  },
});
