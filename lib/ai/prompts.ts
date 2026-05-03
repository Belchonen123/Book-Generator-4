/**
 * Default prompt templates. Each AI feature route resolves its prompt via
 * `resolvePrompt(task, ctx)` which checks (in order): book-scoped override,
 * user-scoped override, then this default. Variables use `{{name}}` syntax
 * and are substituted via `renderPrompt`.
 *
 * The full set of templates is filled in as each feature ships in later
 * phases. This file holds the default text + the resolver/renderer that
 * those features consume.
 */

import type { AiTask } from "./models";

export type PromptKey = AiTask;

export const DEFAULT_PROMPTS: Partial<Record<PromptKey, string>> = {
  refine_idea: `You are an editorial assistant helping an author refine a book premise.
Given the raw idea, produce a JSON object with these fields:
- premise (1-2 sentences)
- mainCharacter (one sentence)
- stakes (one sentence)
- centralConflict (one sentence)
- readerArc (what readers feel by the end)

Raw idea:
{{idea}}

Genre: {{genre}}
Tone: {{tone}}

Respond with JSON only.`,

  generate_outline: `You are an outliner. Produce {{sectionCount}} chapter-level sections for the following book.
Title: {{title}}
Genre: {{genre}}
Tone: {{tone}}
Premise: {{premise}}
Main character: {{mainCharacter}}
Central conflict: {{centralConflict}}

For each section output: order (1-indexed), title, summary (3-5 sentences),
notes (optional). Return a JSON array.`,

  generate_chapter: `You are writing chapter {{chapterNumber}} of "{{bookTitle}}" — a {{genre}} novel.

# Tone
{{tone}}

# Style guidance
{{styleGuidance}}

# Outline section
{{outlineTitle}}
{{outlineSummary}}

# Relevant codex (characters, locations, lore)
{{codexContext}}

# Previously
{{priorChapterSummary}}

Write the chapter as continuous prose. Do not output a chapter heading or
section breaks unless they appear in the source style. Aim for {{targetWords}}
words.`,

  chat: `You are an editorial collaborator embedded in chapter {{chapterNumber}} of
"{{bookTitle}}". You can see the chapter content and any codex entries the
author mentions with @-tags. Be concrete, brief, and direct.`,

  brainstorm: `You are a brainstorming partner for "{{bookTitle}}" ({{genre}}). The user
will ask for a list of ideas (character names, plot twists, scenes, etc.).
Produce {{count}} concrete options. One per line.`,

  check_consistency: `Compare the new chapter against the codex and prior chapter summaries.
Report concrete contradictions only. For each: title, severity (info|warn|error),
and detail. JSON array. If none, return [].

Codex:
{{codex}}

Prior summaries:
{{priorSummaries}}

New chapter:
{{chapter}}`,
};

export function renderPrompt(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Lookup priority: book override → user override → platform default → built-in
 * default. Custom templates are stored in the `customPrompts` and
 * `platformPrompts` tables; the resolver itself runs in a Convex query that
 * AI feature routes call before invoking the model.
 */
export type ResolvedPrompt = {
  template: string;
  source: "book" | "user" | "platform" | "default";
};

export function resolveDefault(task: PromptKey): ResolvedPrompt | null {
  const t = DEFAULT_PROMPTS[task];
  return t ? { template: t, source: "default" } : null;
}
