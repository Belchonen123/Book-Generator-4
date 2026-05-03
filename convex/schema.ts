import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Status / enum values used across tables.
export const bookStatus = v.union(
  v.literal("idea"),
  v.literal("refining"),
  v.literal("outlining"),
  v.literal("writing"),
  v.literal("editing"),
  v.literal("cover"),
  v.literal("complete")
);

export const bookType = v.union(v.literal("fiction"), v.literal("non-fiction"));

export const chapterStatus = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("draft"),
  v.literal("edited"),
  v.literal("approved")
);

export const revisionSource = v.union(
  v.literal("generation"),
  v.literal("manual_save"),
  v.literal("assist_expand"),
  v.literal("assist_tone"),
  v.literal("regenerate"),
  v.literal("restore"),
  v.literal("rewrite_transition"),
  v.literal("regenerate_for_outline"),
  v.literal("find_replace")
);

export const codexEntryType = v.union(
  v.literal("character"),
  v.literal("location"),
  v.literal("object"),
  v.literal("lore"),
  v.literal("faction"),
  v.literal("subplot")
);

export const codexAiScope = v.union(
  v.literal("always"),
  v.literal("match"),
  v.literal("never")
);

export const seriesStatus = v.union(
  v.literal("planning"),
  v.literal("active"),
  v.literal("complete"),
  v.literal("abandoned")
);

export const arcType = v.union(
  v.literal("character"),
  v.literal("plot"),
  v.literal("thematic"),
  v.literal("romance"),
  v.literal("mystery"),
  v.literal("world"),
  v.literal("custom")
);

export const arcStatus = v.union(
  v.literal("setup"),
  v.literal("developing"),
  v.literal("climax"),
  v.literal("resolved"),
  v.literal("abandoned")
);

export const beatKind = v.union(
  v.literal("setup"),
  v.literal("foreshadow"),
  v.literal("development"),
  v.literal("complication"),
  v.literal("payoff"),
  v.literal("resolution")
);

export const beatStatus = v.union(
  v.literal("planned"),
  v.literal("drafted"),
  v.literal("complete")
);

export const audioJobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed")
);

export const chatRole = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
);

export const subscriptionTier = v.union(v.literal("free"), v.literal("pro"));

export default defineSchema({
  ...authTables,

  // ---------- User ----------
  profiles: defineTable({
    userId: v.id("users"),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    penName: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    subscriptionTier,
    stripeCustomerId: v.optional(v.string()),
    hasSeenOnboarding: v.boolean(),
    preferences: v.object({
      askRewriteOnOutlineEdit: v.optional(v.boolean()),
      autoSlopScanGeneratedChapters: v.optional(v.boolean()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // ---------- Books ----------
  books: defineTable({
    userId: v.id("users"),
    title: v.string(),
    subtitle: v.optional(v.string()),
    bookType: v.optional(bookType),
    genre: v.optional(v.string()),
    tone: v.optional(v.string()),
    status: bookStatus,
    rawIdea: v.optional(v.string()),
    refinedIdea: v.optional(
      v.object({
        premise: v.optional(v.string()),
        mainCharacter: v.optional(v.string()),
        stakes: v.optional(v.string()),
        centralConflict: v.optional(v.string()),
        readerArc: v.optional(v.string()),
      })
    ),
    styleGuidance: v.optional(v.string()),
    coverStorageId: v.optional(v.id("_storage")),
    coverUrl: v.optional(v.string()),
    seriesId: v.optional(v.id("series")),
    seriesOrder: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        keywords: v.optional(v.array(v.string())),
        category: v.optional(v.string()),
        backCover: v.optional(v.string()),
        aboutAuthor: v.optional(v.string()),
      })
    ),
    wordCount: v.number(),
    chapterCount: v.number(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_series", ["seriesId", "seriesOrder"]),

  // ---------- Outlines ----------
  outlineSections: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    order: v.number(),
    title: v.string(),
    summary: v.string(),
    notes: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId", "order"])
    .index("by_user", ["userId"]),

  // ---------- Chapters ----------
  chapters: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    order: v.number(),
    title: v.string(),
    content: v.string(), // serialized Tiptap JSON
    plainText: v.string(),
    summary: v.optional(v.string()),
    status: chapterStatus,
    wordCount: v.number(),
    generationStartedAt: v.optional(v.number()),
    generationCompletedAt: v.optional(v.number()),
    lastGenerationError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId", "order"])
    .index("by_user", ["userId"])
    .index("by_status", ["status", "generationStartedAt"]),

  chapterRevisions: defineTable({
    chapterId: v.id("chapters"),
    bookId: v.id("books"),
    userId: v.id("users"),
    source: revisionSource,
    content: v.string(),
    plainText: v.string(),
    wordCount: v.number(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_chapter", ["chapterId", "createdAt"])
    .index("by_user", ["userId"]),

  // ---------- Style ----------
  styleExamples: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    label: v.optional(v.string()),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),

  // ---------- Codex ----------
  characterBibles: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    content: v.string(),
    sourceVersion: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),

  codexEntries: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    type: codexEntryType,
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    fields: v.any(), // type-specific JSON
    aiScope: codexAiScope,
    matchPatterns: v.optional(v.array(v.string())),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_book_type", ["bookId", "type"])
    .index("by_user", ["userId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["bookId", "type"],
    }),

  codexRelations: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    fromEntryId: v.id("codexEntries"),
    toEntryId: v.id("codexEntries"),
    label: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_from", ["fromEntryId"])
    .index("by_to", ["toEntryId"]),

  // ---------- Continuity ----------
  continuityWarnings: defineTable({
    bookId: v.id("books"),
    chapterId: v.id("chapters"),
    userId: v.id("users"),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    title: v.string(),
    detail: v.string(),
    relatedCodexIds: v.optional(v.array(v.id("codexEntries"))),
    dismissedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_chapter", ["chapterId"])
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),

  // ---------- Chat ----------
  chatThreads: defineTable({
    chapterId: v.id("chapters"),
    bookId: v.id("books"),
    userId: v.id("users"),
    title: v.string(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_chapter", ["chapterId", "updatedAt"])
    .index("by_user", ["userId"]),

  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    userId: v.id("users"),
    role: chatRole,
    content: v.string(),
    mentions: v.optional(
      v.array(
        v.object({
          kind: v.union(v.literal("codex"), v.literal("chapter")),
          id: v.string(),
          label: v.string(),
        })
      )
    ),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId", "createdAt"])
    .index("by_user", ["userId"]),

  // ---------- Brainstorm ----------
  brainstormSessions: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    title: v.string(),
    prompt: v.optional(v.string()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId", "updatedAt"])
    .index("by_user", ["userId"]),

  brainstormItems: defineTable({
    sessionId: v.id("brainstormSessions"),
    userId: v.id("users"),
    content: v.string(),
    isKeeper: v.boolean(),
    isHidden: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_user", ["userId"]),

  // ---------- Analysis (cached) ----------
  pacingAnalyses: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    contentHash: v.string(),
    result: v.any(), // beats, scene map, metrics
    createdAt: v.number(),
  })
    .index("by_book_hash", ["bookId", "contentHash"])
    .index("by_user", ["userId"]),

  slopScans: defineTable({
    chapterId: v.id("chapters"),
    bookId: v.id("books"),
    userId: v.id("users"),
    contentHash: v.string(),
    regexHits: v.any(),
    deepdive: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_chapter_hash", ["chapterId", "contentHash"])
    .index("by_user", ["userId"]),

  // ---------- Audio ----------
  audioJobs: defineTable({
    bookId: v.id("books"),
    chapterId: v.id("chapters"),
    userId: v.id("users"),
    voiceId: v.string(),
    status: audioJobStatus,
    storageId: v.optional(v.id("_storage")),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_chapter", ["chapterId"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  coverVariants: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    source: v.union(v.literal("ai"), v.literal("upload")),
    prompt: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_book", ["bookId", "createdAt"])
    .index("by_user", ["userId"]),

  audioExports: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    voiceId: v.string(),
    sizeBytes: v.number(),
    createdAt: v.number(),
  })
    .index("by_book", ["bookId", "createdAt"])
    .index("by_user", ["userId"]),

  // ---------- Book exports (EPUB/PDF/KDP) ----------
  bookExports: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    format: v.union(
      v.literal("epub"),
      v.literal("pdf"),
      v.literal("kdp"),
      v.literal("boxed_set")
    ),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
    createdAt: v.number(),
  })
    .index("by_book", ["bookId", "createdAt"])
    .index("by_user", ["userId"]),

  // ---------- Series ----------
  series: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    tagline: v.optional(v.string()),
    genre: v.optional(v.string()),
    plannedBookCount: v.optional(v.number()),
    status: seriesStatus,
    worldNotes: v.optional(v.string()),
    coverStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId", "updatedAt"]),

  seriesCodexEntries: defineTable({
    seriesId: v.id("series"),
    userId: v.id("users"),
    type: codexEntryType,
    name: v.string(),
    summary: v.optional(v.string()),
    fields: v.any(),
    aiScope: codexAiScope,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_series", ["seriesId"])
    .index("by_series_type", ["seriesId", "type"])
    .index("by_user", ["userId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["seriesId", "type"],
    }),

  seriesArcs: defineTable({
    seriesId: v.id("series"),
    userId: v.id("users"),
    name: v.string(),
    type: arcType,
    description: v.optional(v.string()),
    status: arcStatus,
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_series", ["seriesId", "order"])
    .index("by_user", ["userId"]),

  seriesArcBeats: defineTable({
    arcId: v.id("seriesArcs"),
    seriesId: v.id("series"),
    userId: v.id("users"),
    bookId: v.optional(v.id("books")),
    chapterId: v.optional(v.id("chapters")),
    kind: beatKind,
    title: v.string(),
    description: v.optional(v.string()),
    status: beatStatus,
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_arc", ["arcId", "order"])
    .index("by_series", ["seriesId"])
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),

  // ---------- Analytics ----------
  analyticsEvents: defineTable({
    userId: v.id("users"),
    bookId: v.optional(v.id("books")),
    seriesId: v.optional(v.id("series")),
    type: v.string(), // 19 known types; kept open for new ones
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_type_created", ["type", "createdAt"])
    .index("by_book", ["bookId"]),

  // ---------- Prompts ----------
  customPrompts: defineTable({
    userId: v.id("users"),
    bookId: v.optional(v.id("books")), // null = user-level override
    promptKey: v.string(), // e.g. "generate_chapter", "expand_outline"
    template: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_key", ["userId", "promptKey"])
    .index("by_book_key", ["bookId", "promptKey"]),

  platformPrompts: defineTable({
    promptKey: v.string(),
    template: v.string(),
    version: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["promptKey"]),

  // ---------- Stripe ----------
  paymentEvents: defineTable({
    userId: v.optional(v.id("users")),
    stripeEventId: v.string(),
    type: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_event", ["stripeEventId"])
    .index("by_user", ["userId", "createdAt"]),

  coupons: defineTable({
    code: v.string(),
    description: v.optional(v.string()),
    grantsTier: subscriptionTier,
    durationDays: v.optional(v.number()),
    maxRedemptions: v.optional(v.number()),
    redemptionCount: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  couponRedemptions: defineTable({
    couponId: v.id("coupons"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_coupon", ["couponId"]),

  // ---------- Rate limit fallback (when Upstash is offline) ----------
  rateLimitBuckets: defineTable({
    userId: v.id("users"),
    bucket: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_user_bucket", ["userId", "bucket"]),
});
