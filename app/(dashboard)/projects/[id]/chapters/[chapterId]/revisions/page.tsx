"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export default function RevisionsPage() {
  const params = useParams<{ id: string; chapterId: string }>();
  const bookId = params.id as Id<"books">;
  const chapterId = params.chapterId as Id<"chapters">;
  const chapter = useQuery(api.chapters.get, { id: chapterId });
  const revisions = useQuery(api.chapters.listRevisions, { chapterId });
  const restore = useMutation(api.chapters.restoreRevision);
  const remove = useMutation(api.chapters.deleteRevision);
  const [openId, setOpenId] = useState<string | null>(null);

  if (chapter === undefined || revisions === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (!chapter) return <p>Not found</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Revisions — {chapter.title}</h2>
          <p className="text-xs text-muted-foreground">
            Snapshots from every generation, AI assist, restore, and find/replace.
          </p>
        </div>
        <Link
          href={`/projects/${bookId}/chapters/${chapterId}`}
          className="text-sm hover:underline"
        >
          ← Back to editor
        </Link>
      </div>

      {revisions.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No revisions yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {revisions.map((r) => (
            <li key={r._id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>{" "}
                  · {r.source} · {r.wordCount.toLocaleString()} words
                  {r.note && (
                    <span className="text-muted-foreground"> — {r.note}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenId(openId === r._id ? null : r._id)}
                  >
                    {openId === r._id ? "Hide" : "Preview"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore({ revisionId: r._id })}
                  >
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => remove({ revisionId: r._id })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {openId === r._id && (
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">
                  {r.plainText}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
