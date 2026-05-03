"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StylePage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const book = useQuery(api.books.get, { id: bookId });
  const examples = useQuery(api.style.list, { bookId });
  const updateGuidance = useMutation(api.style.updateGuidance);
  const addExample = useMutation(api.style.addExample);
  const removeExample = useMutation(api.style.removeExample);

  const [guidance, setGuidance] = useState("");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (book) setGuidance(book.styleGuidance ?? "");
  }, [book]);

  if (book === undefined || examples === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  async function add() {
    if (!content.trim()) return;
    await addExample({ bookId, label: label.trim() || undefined, content });
    setLabel("");
    setContent("");
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Style guidance</h2>
          <p className="text-sm text-muted-foreground">
            Plain-language instructions the model should follow when writing
            chapters (e.g. "Hemingway-spare prose, no adverbs, dialogue carries
            most beats").
          </p>
        </div>
        <textarea
          rows={6}
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          onBlur={() => updateGuidance({ bookId, styleGuidance: guidance })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Voice examples</h2>
          <p className="text-sm text-muted-foreground">
            Paste a few paragraphs of prose the model should imitate. Each
            example is shown to the model alongside the outline.
          </p>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="example-label">Label (optional)</Label>
            <Input
              id="example-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Opening voice, Action beats"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="example-content">Prose</Label>
            <textarea
              id="example-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button onClick={add} disabled={!content.trim()}>
            Add example
          </Button>
        </div>

        <ul className="space-y-2">
          {examples.map((example) => (
            <li key={example._id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">
                  {example.label ?? "Untitled"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => removeExample({ id: example._id })}
                >
                  Remove
                </Button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {example.content}
              </p>
            </li>
          ))}
          {examples.length === 0 && (
            <li className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No voice examples yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
