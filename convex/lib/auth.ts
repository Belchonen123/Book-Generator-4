import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AnyCtx = QueryCtx | MutationCtx;

/**
 * Replaces Supabase RLS. Every query and mutation that touches user-owned
 * data MUST start by calling `requireUserId` and then scope reads/writes by
 * that id (either via the `by_user` index or the `requireOwned*` helpers
 * below). There is no safety net — a missed check is a data leak.
 */
export async function requireUserId(ctx: AnyCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not authenticated");
  return userId;
}

export async function maybeUserId(ctx: AnyCtx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

/**
 * Loads a document and asserts its `userId` matches the caller. Throws
 * "Not found" (not "Forbidden") to avoid leaking existence of foreign rows.
 */
export async function requireOwned<T extends TableNames>(
  ctx: AnyCtx,
  table: T,
  id: Id<T>
) {
  const userId = await requireUserId(ctx);
  const doc = await ctx.db.get(id);
  if (!doc) throw new ConvexError("Not found");
  // All owner tables include a `userId` field by convention.
  if ((doc as { userId?: Id<"users"> }).userId !== userId) {
    throw new ConvexError("Not found");
  }
  return doc as NonNullable<Awaited<ReturnType<typeof ctx.db.get<T>>>>;
}

export async function assertOwnership(
  ctx: AnyCtx,
  doc: { userId: Id<"users"> } | null
) {
  const userId = await requireUserId(ctx);
  if (!doc || doc.userId !== userId) throw new ConvexError("Not found");
}
