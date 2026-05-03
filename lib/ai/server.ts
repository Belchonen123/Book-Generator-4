/**
 * Helpers for Next.js route handlers that call AI. Centralizes the
 * authenticate → rate-limit → stream/respond pattern used by every feature.
 */

import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { rateLimit, rateLimitHeaders, LIMITS } from "./rate-limit";
import { DEFAULT_PROMPTS, renderPrompt, type PromptKey } from "./prompts";

export type AuthedContext = {
  userId: string;
  token: string;
};

export async function requireAuthedRoute(): Promise<AuthedContext | Response> {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const me = await fetchQuery(api.profiles.me, {}, { token });
  if (!me?.user) return new Response("Unauthorized", { status: 401 });
  return { userId: me.user._id as string, token };
}

export async function checkRateLimit(
  userId: string,
  bucket: keyof typeof LIMITS
): Promise<Response | null> {
  const r = await rateLimit(userId, bucket);
  if (r.ok) return null;
  return new Response("Rate limit exceeded", {
    status: 429,
    headers: rateLimitHeaders(r),
  });
}

/**
 * Resolves a prompt template (book/user/platform/built-in default) and
 * substitutes variables. Throws if none of the four levels has a template.
 */
export async function resolvePromptForRoute(
  token: string,
  promptKey: PromptKey,
  vars: Record<string, string | number | undefined>,
  bookId?: Id<"books">
): Promise<string> {
  const resolved = await fetchQuery(
    api.prompts.resolve,
    { promptKey, bookId },
    { token }
  );
  const template = resolved?.template ?? DEFAULT_PROMPTS[promptKey];
  if (!template) {
    throw new Error(`No prompt template registered for "${promptKey}"`);
  }
  return renderPrompt(template, vars);
}
