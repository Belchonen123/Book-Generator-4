"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChapterEditor,
  type ChapterEditorHandle,
} from "@/components/editor/chapter-editor";
import { wordCount as countWords } from "@/lib/text/word-count";
import { AssistPanel } from "./_components/assist-panel";

const SAVE_DEBOUNCE_MS = 1500;

export default function ChapterPage() {
  const params = useParams<{ id: string; chapterId: string }>();
  const bookId = params.id as Id<"books">;
  const chapterId = params.chapterId as Id<"chapters">;
  const chapter = useQuery(api.chapters.get, { id: chapterId });
  const chapters = useQuery(api.chapters.listForBook, { bookId });
  const saveContent = useMutation(api.chapters.saveContent);
  const updateTitle = useMutation(api.chapters.updateTitle);
  const setStatus = useMutation(api.chapters.setStatus);

  const editorRef = useRef<ChapterEditorHandle | null>(null);
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedId = useRef<string | null>(null);
  const lastSeenUpdatedAt = useRef<number>(0);
  const [assisting, setAssisting] = useState(false);

  useEffect(() => {
    if (!chapter) return;
    setTitle(chapter.title);
    const isNewChapter = lastLoadedId.current !== chapter._id;
    // Reload editor on chapter switch OR when server content changed via an
    // assist/generation that we didn't initiate locally.
    const externalUpdate =
      !isNewChapter &&
      !dirtyRef.current &&
      !generating &&
      chapter.updatedAt > lastSeenUpdatedAt.current;
    if (isNewChapter || externalUpdate) {
      editorRef.current?.setContent(chapter.content || null, chapter.plainText);
      lastLoadedId.current = chapter._id;
      lastSeenUpdatedAt.current = chapter.updatedAt;
      dirtyRef.current = false;
    }
  }, [chapter, generating]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const handle = editorRef.current;
      if (!handle || !dirtyRef.current) return;
      const json = handle.getJson();
      const plain = handle.getPlain();
      dirtyRef.current = false;
      await saveContent({
        id: chapterId,
        content: json,
        plainText: plain,
        wordCount: countWords(plain),
      });
      // Mark our save as seen so the reactive query won't trigger a reload.
      lastSeenUpdatedAt.current = Date.now();
    }, SAVE_DEBOUNCE_MS);
  }

  async function generate() {
    if (!editorRef.current) return;
    setGenerating(true);
    setError(null);
    editorRef.current.setContent(null, "");
    try {
      const res = await fetch("/api/ai/generate-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, targetWords: 2500 }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          editorRef.current.appendText(decoder.decode(value, { stream: true }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  if (chapter === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (chapter === null) return <p>Not found</p>;

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6">
      <aside className="space-y-1">
        <p className="px-2 text-xs uppercase text-muted-foreground">Chapters</p>
        {chapters?.map((c) => (
          <Link
            key={c._id}
            href={`/projects/${bookId}/chapters/${c._id}`}
            className={`block rounded px-2 py-1.5 text-sm ${
              c._id === chapterId ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
          >
            <span className="text-xs text-muted-foreground">{c.order}.</span>{" "}
            {c.title}
            <span className="ml-1 text-xs text-muted-foreground">
              {c.status === "generating" ? "…" : c.status === "pending" ? "·" : ""}
            </span>
          </Link>
        ))}
      </aside>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => updateTitle({ id: chapterId, title })}
            className="text-lg font-semibold"
          />
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {chapter.wordCount.toLocaleString()} words · {chapter.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={generate}
            disabled={generating || chapter.status === "generating"}
            size="sm"
          >
            {generating
              ? "Generating…"
              : chapter.content
                ? "Regenerate"
                : "Generate with AI"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={chapter.status === "approved" || !chapter.content}
            onClick={() => setStatus({ id: chapterId, status: "approved" })}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowRevisions((v) => !v)}
          >
            {showRevisions ? "Hide revisions" : "Revisions"}
          </Button>
        </div>

        {chapter.lastGenerationError && (
          <p className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-900">
            Previous attempt failed: {chapter.lastGenerationError}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <ChapterEditor
          handleRef={editorRef}
          initialJson={chapter.content || null}
          editable={!generating && !assisting && chapter.status !== "generating"}
          onChange={() => {
            dirtyRef.current = true;
            scheduleSave();
          }}
        />

        <AssistPanel
          bookId={bookId}
          chapterId={chapterId}
          busy={assisting}
          setBusy={setAssisting}
          onInsert={(text) => editorRef.current?.appendText(text)}
        />

        {showRevisions && <RevisionList chapterId={chapterId} />}
      </div>
    </div>
  );
}

function RevisionList({ chapterId }: { chapterId: Id<"chapters"> }) {
  const revisions = useQuery(api.chapters.listRevisions, { chapterId });
  const restore = useMutation(api.chapters.restoreRevision);
  const remove = useMutation(api.chapters.deleteRevision);
  if (!revisions) return null;
  if (revisions.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No revisions yet. They're saved on every generation, restore, and major
        edit.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 rounded-md border p-2">
      {revisions.map((r) => (
        <li
          key={r._id}
          className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50"
        >
          <div>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleString()}
            </span>{" "}
            <span className="text-muted-foreground">·</span>{" "}
            <span>{r.source}</span>{" "}
            <span className="text-muted-foreground">
              · {r.wordCount.toLocaleString()} words
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
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
        </li>
      ))}
    </ul>
  );
}
