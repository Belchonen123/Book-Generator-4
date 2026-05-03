import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

// Full app schema (25+ tables) lands in Phase 3. Auth tables come from
// @convex-dev/auth and back the providers wired in convex/auth.ts.
export default defineSchema({
  ...authTables,
});
