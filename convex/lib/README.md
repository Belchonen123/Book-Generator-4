# Convex helpers

## `auth.ts`

Replaces Supabase RLS. Every query and mutation that touches user-owned data
must:

1. Call `await requireUserId(ctx)` first.
2. Scope all reads/writes by that id, either via the table's `by_user` index
   or by passing fetched docs through `assertOwnership` / `requireOwned`.

Owner tables convention: every table that holds user data declares a
`userId: v.id("users")` field and an index named `by_user` (compound indexes
that start with `userId` also count). `purgeUserData` in `convex/profiles.ts`
walks this list when an account is deleted — keep it in sync when you add new
owner tables.
