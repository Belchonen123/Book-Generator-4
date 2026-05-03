import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Full app schema (25+ tables) lands in Phase 3. Auth tables come from
// @convex-dev/auth; profiles is added in Phase 2.
export default defineSchema({
  ...authTables,

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
    subscriptionTier: v.union(v.literal("free"), v.literal("pro")),
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
});
