"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OutlinePage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const book = useQuery(api.books.get, { id: bookId });
  const sections = useQuery(api.outline.list, { bookId });
  const router = useRouter();

  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (book === undefined || sections === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (!book) return <p>Not found</p>;

  const approved = sections.length > 0 && sections.every((s) => s.approvedAt);
  const canApprove = sections.length > 0 && !approved;

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, sectionCount: 12 }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/approve-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/projects/${bookId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setApproving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Outline</h2>
        <div className="flex gap-2">
          {sections.length === 0 ? (
            <Button onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate outline with AI"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={generate} disabled={generating || approved}>
                {generating ? "Regenerating…" : "Regenerate"}
              </Button>
              {canApprove && (
                <Button onClick={approve} disabled={approving}>
                  {approving ? "Approving…" : "Approve & start writing"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {approved && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Outline approved. Chapters are seeded — head to a chapter to start
          writing.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ol className="space-y-3">
        {sections.map((section) => (
          <SectionRow
            key={section._id}
            section={section}
            disabled={approved}
          />
        ))}
      </ol>
    </div>
  );
}

function SectionRow({
  section,
  disabled,
}: {
  section: Doc<"outlineSections">;
  disabled: boolean;
}) {
  const update = useMutation(api.outline.update);
  const remove = useMutation(api.outline.remove);
  const [title, setTitle] = useState(section.title);
  const [summary, setSummary] = useState(section.summary);
  const [expanding, setExpanding] = useState(false);

  async function expand() {
    setExpanding(true);
    try {
      const res = await fetch("/api/ai/expand-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section._id }),
      });
      if (res.ok) {
        const { summary: newSummary } = await res.json();
        setSummary(newSummary);
      }
    } finally {
      setExpanding(false);
    }
  }

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          {section.order}
        </span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => update({ id: section._id, title })}
          disabled={disabled}
          className="font-medium"
        />
      </div>
      <textarea
        rows={4}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onBlur={() => update({ id: section._id, summary })}
        disabled={disabled}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={expand}
          disabled={disabled || expanding}
        >
          {expanding ? "Expanding…" : "Expand with AI"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={() => remove({ id: section._id })}
          disabled={disabled}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
