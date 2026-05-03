"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BrainstormPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const sessions = useQuery(api.brainstorm.listSessions, { bookId });
  const createSession = useMutation(api.brainstorm.createSession);
  const deleteSession = useMutation(api.brainstorm.deleteSession);
  const [activeId, setActiveId] = useState<Id<"brainstormSessions"> | null>(
    null
  );
  const [showHidden, setShowHidden] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  useEffect(() => {
    if (activeId) return;
    if (sessions && sessions.length > 0) setActiveId(sessions[0]._id);
  }, [sessions, activeId]);

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-3">
        <form
          className="space-y-2 rounded-md border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newTitle.trim()) return;
            const id = await createSession({
              bookId,
              title: newTitle,
              prompt: newPrompt.trim() || undefined,
            });
            setActiveId(id);
            setNewTitle("");
            setNewPrompt("");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bs-title">New session</Label>
            <Input
              id="bs-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Chapter 5 plot twists"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-prompt">Optional context</Label>
            <textarea
              id="bs-prompt"
              rows={2}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button type="submit" size="sm" disabled={!newTitle.trim()}>
            Create
          </Button>
        </form>

        <ul className="space-y-1">
          {sessions?.map((s) => (
            <li key={s._id}>
              <button
                onClick={() => setActiveId(s._id)}
                className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                  s._id === activeId ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>

        {activeId && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={async () => {
              await deleteSession({ id: activeId });
              setActiveId(null);
            }}
          >
            Delete this session
          </Button>
        )}
      </aside>

      <div className="space-y-4">
        {activeId ? (
          <SessionView
            sessionId={activeId}
            showHidden={showHidden}
            onToggleHidden={() => setShowHidden((v) => !v)}
          />
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Create a brainstorm session to get started.
          </p>
        )}
      </div>
    </div>
  );
}

function SessionView({
  sessionId,
  showHidden,
  onToggleHidden,
}: {
  sessionId: Id<"brainstormSessions">;
  showHidden: boolean;
  onToggleHidden: () => void;
}) {
  const items = useQuery(api.brainstorm.getItems, {
    sessionId,
    includeHidden: showHidden,
  });
  const toggleKeeper = useMutation(api.brainstorm.toggleKeeper);
  const toggleHidden = useMutation(api.brainstorm.toggleHidden);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(12);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, count }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={count}
          min={5}
          max={30}
          onChange={(e) => setCount(Number(e.target.value) || 12)}
          className="w-20"
        />
        <Button onClick={generate} disabled={generating}>
          {generating ? "Generating…" : "Generate ideas"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggleHidden}>
          {showHidden ? "Hide hidden" : "Show hidden"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No items yet. Click "Generate ideas".
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item._id}
              className={`flex items-start gap-2 rounded-md border p-3 ${
                item.isKeeper ? "border-green-300 bg-green-50/50" : ""
              } ${item.isHidden ? "opacity-50" : ""}`}
            >
              <button
                onClick={() => toggleKeeper({ id: item._id })}
                title={item.isKeeper ? "Remove keeper" : "Mark as keeper"}
                className={`mt-0.5 text-lg leading-none ${
                  item.isKeeper ? "text-green-600" : "text-muted-foreground"
                }`}
              >
                ★
              </button>
              <p className="flex-1 text-sm whitespace-pre-wrap">{item.content}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleHidden({ id: item._id })}
              >
                {item.isHidden ? "Unhide" : "Hide"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
