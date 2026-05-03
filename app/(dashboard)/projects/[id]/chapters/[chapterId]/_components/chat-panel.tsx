"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mention =
  | { kind: "codex"; id: Id<"codexEntries">; label: string }
  | { kind: "chapter"; id: Id<"chapters">; label: string };

export function ChatPanel({
  bookId,
  chapterId,
}: {
  bookId: Id<"books">;
  chapterId: Id<"chapters">;
}) {
  const threads = useQuery(api.chat.listThreads, { chapterId });
  const createThread = useMutation(api.chat.createThread);
  const deleteThread = useMutation(api.chat.deleteThread);
  const [activeThreadId, setActiveThreadId] =
    useState<Id<"chatThreads"> | null>(null);

  useEffect(() => {
    if (activeThreadId) return;
    if (threads && threads.length > 0) setActiveThreadId(threads[0]._id);
  }, [threads, activeThreadId]);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">Chat</p>
        <div className="flex gap-1">
          {threads && threads.length > 0 && (
            <select
              value={activeThreadId ?? ""}
              onChange={(e) => setActiveThreadId(e.target.value as Id<"chatThreads">)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {threads.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const id = await createThread({ chapterId });
              setActiveThreadId(id);
            }}
          >
            New thread
          </Button>
          {activeThreadId && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={async () => {
                await deleteThread({ id: activeThreadId });
                setActiveThreadId(null);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {activeThreadId ? (
        <ThreadView
          threadId={activeThreadId}
          bookId={bookId}
          chapterId={chapterId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No threads yet. Create one to chat about this chapter.
        </p>
      )}
    </div>
  );
}

function ThreadView({
  threadId,
  bookId,
  chapterId,
}: {
  threadId: Id<"chatThreads">;
  bookId: Id<"books">;
  chapterId: Id<"chapters">;
}) {
  const messages = useQuery(api.chat.getMessages, { threadId });
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  async function send() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    setStreaming("");
    setError(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, content, mentions }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          acc += decoder.decode(value, { stream: true });
          setStreaming(acc);
        }
      }
      setMentions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStreaming(null);
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollerRef}
        className="max-h-80 space-y-2 overflow-y-auto rounded border bg-muted/20 p-2"
      >
        {messages?.map((m) => (
          <Bubble key={m._id} role={m.role} content={m.content} />
        ))}
        {streaming !== null && <Bubble role="assistant" content={streaming || "…"} />}
        {(messages?.length ?? 0) === 0 && streaming === null && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Ask about plot, voice, character motives, anything in this chapter.
          </p>
        )}
      </div>

      <MentionPicker
        bookId={bookId}
        chapterId={chapterId}
        selected={mentions}
        onChange={setMentions}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message…"
          disabled={streaming !== null}
        />
        <Button onClick={send} disabled={!draft.trim() || streaming !== null}>
          Send
        </Button>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  return (
    <div
      className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
        role === "user"
          ? "ml-8 bg-background border"
          : "mr-8 bg-primary/5"
      }`}
    >
      <span className="text-xs uppercase text-muted-foreground">{role}</span>
      <div>{content}</div>
    </div>
  );
}

function MentionPicker({
  bookId,
  chapterId,
  selected,
  onChange,
}: {
  bookId: Id<"books">;
  chapterId: Id<"chapters">;
  selected: Mention[];
  onChange: (m: Mention[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const codex = useQuery(
    api.codex.search,
    search.trim() ? { bookId, q: search } : "skip"
  );
  const chapters = useQuery(api.chapters.listForBook, { bookId });

  function add(m: Mention) {
    if (selected.some((s) => s.id === m.id && s.kind === m.kind)) return;
    onChange([...selected, m]);
    setSearch("");
    setOpen(false);
  }
  function removeIdx(i: number) {
    onChange(selected.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((m, i) => (
          <span
            key={`${m.kind}:${m.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            @{m.kind === "codex" ? "" : "ch."}
            {m.label}
            <button onClick={() => removeIdx(i)} className="text-muted-foreground hover:text-foreground">
              ×
            </button>
          </span>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "+ Mention"}
        </Button>
      </div>
      {open && (
        <div className="space-y-2 rounded-md border bg-background p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search codex by name…"
            autoFocus
          />
          {(codex ?? []).map((c) => (
            <button
              key={c._id}
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
              onClick={() => add({ kind: "codex", id: c._id, label: c.name })}
            >
              <span className="text-xs uppercase text-muted-foreground">
                {c.type}
              </span>{" "}
              {c.name}
            </button>
          ))}
          <div className="border-t pt-2">
            <p className="mb-1 text-xs text-muted-foreground">Chapters</p>
            {chapters
              ?.filter((c) => c._id !== chapterId)
              .map((c) => (
                <button
                  key={c._id}
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() =>
                    add({ kind: "chapter", id: c._id, label: c.title })
                  }
                >
                  <span className="text-xs text-muted-foreground">
                    {c.order}.
                  </span>{" "}
                  {c.title}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
