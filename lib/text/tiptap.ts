type TipTapNode = {
  type: string;
  text?: string;
  content?: TipTapNode[];
};

/** Build a minimal Tiptap doc from raw prose (paragraphs split on blank lines). */
export function plainToTiptap(text: string): { json: string; plain: string } {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const doc: TipTapNode = {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
  return { json: JSON.stringify(doc), plain: paragraphs.join("\n\n") };
}

export function tiptapToPlain(json: string): string {
  if (!json) return "";
  try {
    const doc = JSON.parse(json) as TipTapNode;
    return walk(doc).join("\n").trim();
  } catch {
    return "";
  }
}

function walk(node: TipTapNode | undefined): string[] {
  if (!node) return [];
  if (node.type === "text") return [node.text ?? ""];
  const inner = (node.content ?? []).flatMap(walk).join("");
  if (node.type === "paragraph" || node.type === "heading") {
    return [inner, ""];
  }
  return [inner];
}
