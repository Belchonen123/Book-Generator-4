/**
 * Common LLM-isms and overused phrases. Stored as raw patterns; the scanner
 * builds a single combined regex for performance. Patterns are
 * case-insensitive and anchored on word boundaries.
 */
export const SLOP_PATTERNS: string[] = [
  "a tapestry of",
  "tapestry of",
  "delve into",
  "delves into",
  "in the realm of",
  "navigate the complex",
  "navigating the",
  "it's important to (?:note|remember)",
  "in conclusion",
  "in today's (?:world|society|landscape)",
  "fast-paced world",
  "ever-?(?:changing|evolving)",
  "stands as a testament",
  "a testament to",
  "the world of",
  "embark on a journey",
  "journey of (?:discovery|self-discovery)",
  "in the heart of",
  "at the heart of",
  "rich(?:ly)? (?:detailed|woven|textured)",
  "a symphony of",
  "a (?:beacon|bastion) of",
  "leverage(?:s|d)?",
  "elevate your",
  "the dance of",
  "whispered (?:secrets|promises|truths)",
  "shrouded in (?:mystery|secrecy)",
  "uncover(?:ing)? the (?:hidden|mysteries|secrets)",
  "transformative",
  "intricate(?:ly)?",
  "weave(?:s|d)? together",
  "stark contrast",
  "stark reminder",
  "sent shivers down",
  "shivers down (?:his|her|their|my) spine",
  "every fiber of (?:his|her|their|my) being",
  "hung in the air",
  "hung heavy in the air",
  "echoed through",
  "echoed in",
  "barely a whisper",
  "more than just",
  "not just (?:a|an|the)",
  "isn't just (?:a|an|the)",
];

export type SlopHit = {
  phrase: string;
  count: number;
  excerpts: string[];
};

const EXCERPT_RADIUS = 60;

export function scanText(text: string): SlopHit[] {
  if (!text) return [];
  const hits: SlopHit[] = [];
  for (const pattern of SLOP_PATTERNS) {
    const re = new RegExp(`\\b${pattern}\\b`, "gi");
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = Math.max(0, m.index - EXCERPT_RADIUS);
      const end = Math.min(text.length, m.index + m[0].length + EXCERPT_RADIUS);
      let excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) excerpt = "…" + excerpt;
      if (end < text.length) excerpt = excerpt + "…";
      matches.push(excerpt);
      if (matches.length >= 5) break; // cap excerpts per phrase
    }
    if (matches.length > 0) {
      hits.push({ phrase: pattern, count: matches.length, excerpts: matches });
    }
  }
  return hits.sort((a, b) => b.count - a.count);
}
