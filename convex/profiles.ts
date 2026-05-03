import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function profileForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"profiles"> | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await profileForUser(ctx, userId);
    return { user, profile };
  },
});

export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await profileForUser(ctx, userId);
    if (existing) return existing._id;
    const user = await ctx.db.get(userId);
    const now = Date.now();
    return await ctx.db.insert("profiles", {
      userId,
      email: user?.email,
      fullName: user?.name,
      avatarUrl: user?.image,
      subscriptionTier: "free",
      hasSeenOnboarding: false,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    penName: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await profileForUser(ctx, userId);
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, { ...args, updatedAt: Date.now() });
  },
});

export const updatePreferences = mutation({
  args: {
    askRewriteOnOutlineEdit: v.optional(v.boolean()),
    autoSlopScanGeneratedChapters: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await profileForUser(ctx, userId);
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      preferences: { ...profile.preferences, ...args },
      updatedAt: Date.now(),
    });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await profileForUser(ctx, userId);
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      hasSeenOnboarding: true,
      updatedAt: Date.now(),
    });
  },
});

// Account deletion: purge profile + auth records. Other tables (books,
// chapters, codex, series, storage objects) are purged as they're added in
// later phases — each owner table will extend `purgeUserData`.
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await purgeUserData(ctx, userId);
    // Auth identity records
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const a of authAccounts) await ctx.db.delete(a._id);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    await ctx.db.delete(userId);
  },
});

async function purgeUserData(ctx: MutationCtx, userId: Id<"users">) {
  const profile = await profileForUser(ctx, userId);
  if (profile) await ctx.db.delete(profile._id);
  // Future phases extend here: books, chapters, codex, series, storage, etc.
}
