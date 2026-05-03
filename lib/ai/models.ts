/**
 * Model registry — names live here, not scattered across feature code.
 * Each AI feature picks a `task` and the router resolves the model chain
 * (primary + fallbacks).
 */

export const MODELS = {
  anthropic: {
    sonnet: "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5-20251001",
  },
  openai: {
    gpt4o: "gpt-4o",
    gpt4oMini: "gpt-4o-mini",
  },
  elevenlabs: {
    multilingual: "eleven_multilingual_v2",
  },
} as const;

export type Provider = "anthropic" | "openai";

export type AiTask =
  // Long-form generation
  | "generate_chapter"
  | "expand_outline"
  | "scene_beat"
  | "rewrite_transitions"
  // Chapter assists
  | "chapter_assist"
  | "inline_assist"
  | "inline_command"
  | "voice_to_chapter"
  // Idea / metadata
  | "refine_idea"
  | "regenerate_idea_field"
  | "generate_subtitle"
  | "generate_book_metadata"
  | "generate_about_author"
  | "generate_back_cover"
  // Outline
  | "generate_outline"
  // Codex
  | "extract_codex_seeds"
  | "suggest_codex_entry"
  | "check_consistency"
  // Chat / brainstorm
  | "chat"
  | "brainstorm"
  // Analysis
  | "analyze_beats"
  | "slop_scan_deepdive"
  // Series
  | "suggest_series_arc"
  | "suggest_series_beat"
  // Cover (image)
  | "generate_cover";

type ModelChoice = { provider: Provider; model: string };

export const MODEL_ROUTING: Record<AiTask, ModelChoice[]> = {
  // Heavy creative writing — Claude primary, GPT-4o fallback.
  generate_chapter: [
    { provider: "anthropic", model: MODELS.anthropic.sonnet },
    { provider: "openai", model: MODELS.openai.gpt4o },
  ],
  expand_outline: [
    { provider: "anthropic", model: MODELS.anthropic.sonnet },
    { provider: "openai", model: MODELS.openai.gpt4o },
  ],
  scene_beat: [
    { provider: "anthropic", model: MODELS.anthropic.sonnet },
    { provider: "openai", model: MODELS.openai.gpt4o },
  ],
  rewrite_transitions: [{ provider: "anthropic", model: MODELS.anthropic.sonnet }],
  chapter_assist: [{ provider: "anthropic", model: MODELS.anthropic.sonnet }],
  inline_assist: [{ provider: "anthropic", model: MODELS.anthropic.haiku }],
  inline_command: [{ provider: "anthropic", model: MODELS.anthropic.sonnet }],
  voice_to_chapter: [{ provider: "anthropic", model: MODELS.anthropic.sonnet }],

  // Cheap structured ops — GPT-4o-mini.
  refine_idea: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  regenerate_idea_field: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  generate_subtitle: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  generate_book_metadata: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  generate_about_author: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  generate_back_cover: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  generate_outline: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],

  // Codex / consistency.
  extract_codex_seeds: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  suggest_codex_entry: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  check_consistency: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],

  // Conversational.
  chat: [{ provider: "anthropic", model: MODELS.anthropic.sonnet }],
  brainstorm: [{ provider: "anthropic", model: MODELS.anthropic.haiku }],

  // Analysis.
  analyze_beats: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],
  slop_scan_deepdive: [{ provider: "openai", model: MODELS.openai.gpt4oMini }],

  // Series.
  suggest_series_arc: [{ provider: "openai", model: MODELS.openai.gpt4o }],
  suggest_series_beat: [{ provider: "openai", model: MODELS.openai.gpt4o }],

  // Image — DALL-E 3 (handled via openai client).
  generate_cover: [{ provider: "openai", model: "dall-e-3" }],
};
