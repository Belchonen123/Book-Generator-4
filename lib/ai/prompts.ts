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

  regenerate_idea_field: `You are an editorial assistant. Regenerate the {{field}} for a book.
Existing context (other fields): {{existingJson}}
Genre: {{genre}}
Tone: {{tone}}

Return only the new value as plain text, no JSON, no quotes.`,

  generate_subtitle: `Write a single concise subtitle for the following book. No quotes, no
explanation — just the subtitle.

Title: {{title}}
Genre: {{genre}}
Premise: {{premise}}`,

  generate_outline: `You are an outliner. Produce {{sectionCount}} chapter-level sections for the following book.
Title: {{title}}
Genre: {{genre}}
Tone: {{tone}}
Premise: {{premise}}
Main character: {{mainCharacter}}
Central conflict: {{centralConflict}}

For each section output: title, summary (3-5 sentences), notes (optional).
Return a JSON array, ordered.`,

  expand_outline: `Deepen the following outline section. Keep the same beat structure but
expand the summary into 6-10 sentences with concrete sensory and dramatic
detail. Return JSON: { "summary": "...", "notes": "..." }.

Title: {{title}}
Existing summary: {{summary}}
Book context: {{bookContext}}`,

  generate_character_bible: `Build a character bible for the following book in concise Markdown.
Group by Major / Supporting / Minor. For each named character: name, role,
voice/manner, primary motivation, key relationships, an arc note. Pull names
and roles from the outline.

Title: {{title}}
Genre: {{genre}}
Premise: {{premise}}

Outline:
{{outline}}`,

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

  chapter_assist: `Apply the operation "{{op}}" to the following chapter prose. Preserve
the storyline and POV exactly. Output ONLY the rewritten prose, paragraph
breaks intact, no commentary.

Op detail: {{opDetail}}

Style guidance: {{styleGuidance}}

Chapter:
{{chapter}}`,

  inline_assist: `Apply "{{op}}" to the selected passage. Output only the rewritten
passage, no quotes, no commentary.

Selection:
{{selection}}

Surrounding context (do not output):
{{context}}`,

  inline_command: `Produce {{count}} distinct alternative rewrites for the selected passage.
Each rewrite should preserve meaning but vary tone or rhythm. Return a JSON
array of strings.

Instruction: {{instruction}}
Selection: {{selection}}`,

  scene_beat: `Write the scene described by the beat below as continuous prose, in the
voice of "{{bookTitle}}" ({{genre}}). Aim for {{targetWords}} words. Output
prose only.

Beat: {{beat}}
Surrounding context: {{context}}
Style guidance: {{styleGuidance}}`,

  polish_replacements: `The author just performed a global find/replace ("{{needle}}" -> "{{replacement}}").
Lightly polish the chapter so the substitutions read naturally. DO NOT change
plot, dialogue meaning, or character voice. Output ONLY the polished prose,
paragraphs intact.

Chapter:
{{chapter}}`,

  rewrite_transitions: `Smooth the transition between two consecutive chapters. Edit ONLY the
last paragraph of A and the first paragraph of B so the handoff feels
continuous. Return JSON: {"endA": "...", "startB": "..."}.

Chapter A end:
{{endA}}

Chapter B start:
{{startB}}`,

  voice_to_chapter: `The author dictated the following voice memo describing a scene or
chapter. Turn it into polished chapter prose for "{{bookTitle}}" ({{genre}}).
Aim for {{targetWords}} words. Output prose only.

Memo transcript:
{{transcript}}

Style guidance: {{styleGuidance}}`,

  chat: `You are an editorial collaborator embedded in chapter {{chapterNumber}} of
"{{bookTitle}}". You can see the chapter content and any codex entries the
author mentions with @-tags. Be concrete, brief, and direct.`,

  brainstorm: `You are a brainstorming partner for "{{bookTitle}}" ({{genre}}). The user
will ask for a list of ideas (character names, plot twists, scenes, etc.).
Produce {{count}} concrete options. One per line.`,

  analyze_beats: `Analyze the pacing of the following book. Identify scene-level beats per
chapter and rate each on tension (0-10) and momentum (0-10). Output JSON:
{
  "perChapter": [
    {
      "chapter": <order>,
      "title": "...",
      "wordCount": <int>,
      "beats": [
        { "label": "...", "tension": <0-10>, "momentum": <0-10>, "summary": "..." }
      ],
      "avgTension": <number>,
      "avgMomentum": <number>
    }
  ],
  "overall": {
    "shape": "rising|episodic|flat|...",
    "warnings": ["..."]
  }
}

Book:
{{book}}`,

  extract_codex_seeds: `Read the chapter and extract codex entries the author should track. Find
characters (named people), locations (named places), objects (significant
items), factions (groups), lore (world rules / history). For each, output
{ "type": "...", "name": "...", "summary": "1-2 sentences" }. Skip generic
descriptions and one-off mentions. Return a JSON array.

Chapter:
{{chapter}}`,

  suggest_codex_entry: `Fill in the codex entry below. Output a JSON object whose keys are the
field names listed under SCHEMA, with concise concrete values. If a value
isn't supported by the source, omit the key.

SCHEMA: {{schema}}

NAME: {{name}}
TYPE: {{type}}
EXISTING FIELDS: {{existingJson}}

SOURCE (book context):
{{context}}`,

  slop_scan_deepdive: `Read the chapter and flag passages that read as generic, AI-sounding, or
overwrought. Skip generic word frequency — focus on passages that lack
specificity, lean on cliché, or sound like marketing prose. Output JSON:
{ "flags": [ { "excerpt": "...", "issue": "...", "suggestion": "..." } ] }.

Chapter:
{{chapter}}`,

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
