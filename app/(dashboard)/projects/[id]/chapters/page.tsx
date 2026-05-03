"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

const STATUS_DOT = {
  pending: "bg-muted",
  generating: "bg-blue-400 animate-pulse",
  draft: "bg-yellow-400",
  edited: "bg-yellow-500",
  approved: "bg-green-500",
} as const;

export default function ChaptersPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const book = useQuery(api.books.get, { id: bookId });
  const chapters = useQuery(api.chapters.listForBook, { bookId });
  const sections = useQuery(api.outline.list, { bookId });

  if (book === undefined || chapters === undefined || sections === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (!book) return <p>Not found</p>;

  const approved = sections.length > 0 && sections.every((s) => s.approvedAt);

  if (chapters.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No chapters yet. {approved
            ? "Re-approving the outline will seed chapters."
            : "Approve your outline first — chapters are seeded from outline sections."}
        </p>
        <Button asChild>
          <Link href={`/projects/${bookId}/outline`}>Go to outline</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Chapters</h2>
          <p className="text-xs text-muted-foreground">
            {chapters.length} chapter{chapters.length === 1 ? "" : "s"} ·{" "}
            {book.wordCount.toLocaleString()} words
          </p>
        </div>
        <GenerateAllButton bookId={bookId} chapters={chapters} />
      </div>

      <ul className="divide-y rounded-md border">
        {chapters.map((c) => (
          <ChapterRow
            key={c._id}
            bookId={bookId}
            chapter={c}
            outlineSummary={sections.find((s) => s.order === c.order)?.summary}
          />
        ))}
      </ul>
    </div>
  );
}

function ChapterRow({
  bookId,
  chapter,
  outlineSummary,
}: {
  bookId: Id<"books">;
  chapter: Doc<"chapters">;
  outlineSummary: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter._id, targetWords: 2500 }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      // Drain stream so the route's onclose mutation fires.
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <span
        className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[chapter.status]}`}
        title={chapter.status}
      />
      <Link
        href={`/projects/${bookId}/chapters/${chapter._id}`}
        className="min-w-0 flex-1"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">{chapter.order}.</span>
          <span className="truncate font-medium">{chapter.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{chapter.status}</span>
          <span>·</span>
          <span>{chapter.wordCount.toLocaleString()} words</span>
          {outlineSummary && (
            <>
              <span>·</span>
              <span className="truncate">{outlineSummary}</span>
            </>
          )}
        </div>
        {chapter.lastGenerationError && (
          <div className="mt-1 text-xs text-red-600">
            {chapter.lastGenerationError}
          </div>
        )}
      </Link>
      <div className="flex flex-shrink-0 gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={busy || chapter.status === "generating"}
        >
          {busy
            ? "…"
            : chapter.status === "generating"
              ? "Running"
              : chapter.content
                ? "Regenerate"
                : "Generate"}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/projects/${bookId}/chapters/${chapter._id}`}>Open</Link>
        </Button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}

function GenerateAllButton({
  bookId,
  chapters,
}: {
  bookId: Id<"books">;
  chapters: Doc<"chapters">[];
}) {
  void bookId;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const targets = chapters.filter((c) => !c.content && c.status !== "generating");

  async function generateAll() {
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        const res = await fetch("/api/ai/generate-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId: targets[i]._id,
            targetWords: 2500,
          }),
        });
        if (!res.ok || !res.body) {
          setError(`Chapter ${targets[i].order} failed: ${await res.text()}`);
          break;
        }
        const reader = res.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        setProgress({ done: i + 1, total: targets.length });
      }
    } finally {
      setRunning(false);
    }
  }

  if (targets.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">All chapters drafted</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={generateAll} disabled={running}>
        {running
          ? `Generating ${progress?.done ?? 0}/${progress?.total ?? 0}…`
          : `Generate all ${targets.length} pending`}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
