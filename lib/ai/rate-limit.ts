import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { AiTask } from "./models";

/**
 * Per-user, per-task hourly limits. Numbers are pulled directly from the
 * original Supabase app's audit. A few non-AI buckets (cover gen, voice
 * transcription) are included so all rate-limited routes share one home.
 */
export const LIMITS: Record<AiTask | "generate_cover" | "voice_to_chapter", number> = {
  generate_chapter: 20,
  expand_outline: 30,
  scene_beat: 60,
  rewrite_transitions: 40,
  polish_replacements: 20,
  chapter_assist: 60,
  inline_assist: 100,
  inline_command: 100,
  voice_to_chapter: 10,
  refine_idea: 30,
  regenerate_idea_field: 30,
  generate_subtitle: 60,
  generate_book_metadata: 30,
  generate_about_author: 30,
  generate_back_cover: 30,
  generate_outline: 30,
  extract_codex_seeds: 40,
  suggest_codex_entry: 40,
  check_consistency: 40,
  chat: 120,
  brainstorm: 100,
  analyze_beats: 40,
  slop_scan_deepdive: 80,
  suggest_series_arc: 40,
  suggest_series_beat: 50,
  generate_cover: 10,
  generate_character_bible: 10,
};

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function limiterFor(bucket: string, perHour: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  let l = limiters.get(bucket);
  if (!l) {
    l = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(perHour, "1 h"),
      prefix: `bg4:${bucket}`,
      analytics: false,
    });
    limiters.set(bucket, l);
  }
  return l;
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // ms epoch
};

/**
 * Check and consume one token. **Fails open** when Upstash isn't configured
 * (dev) or unreachable — the upstream LLM rate limits then serve as the
 * backstop. Production must set UPSTASH_REDIS_REST_URL + _TOKEN.
 */
export async function rateLimit(
  userId: string,
  bucket: keyof typeof LIMITS
): Promise<RateLimitResult> {
  const perHour = LIMITS[bucket];
  const limiter = limiterFor(bucket, perHour);
  if (!limiter) {
    return { ok: true, limit: perHour, remaining: perHour, reset: 0 };
  }
  try {
    const r = await limiter.limit(userId);
    return { ok: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
  } catch {
    return { ok: true, limit: perHour, remaining: perHour, reset: 0 };
  }
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.reset),
  };
}
