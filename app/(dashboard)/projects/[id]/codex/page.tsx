"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPES = [
  { value: "character", label: "Characters" },
  { value: "location", label: "Locations" },
  { value: "object", label: "Objects" },
  { value: "faction", label: "Factions" },
  { value: "lore", label: "Lore" },
  { value: "subplot", label: "Subplots" },
] as const;

type CodexType = (typeof TYPES)[number]["value"];

export default function CodexPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const [activeType, setActiveType] = useState<CodexType>("character");
  const [query, setQuery] = useState("");

  const allEntries = useQuery(api.codex.list, { bookId, type: activeType });
  const searchResults = useQuery(
    api.codex.search,
    query.trim() ? { bookId, q: query, type: activeType } : "skip"
  );
  const entries = query.trim() ? searchResults : allEntries;

  const create = useMutation(api.codex.create);
  const [creatingName, setCreatingName] = useState("");

  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <aside className="space-y-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
              activeType === t.value ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </aside>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="max-w-xs"
          />
          <form
            className="flex flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!creatingName.trim()) return;
              await create({
                bookId,
                type: activeType,
                name: creatingName,
                fields: {},
              });
              setCreatingName("");
            }}
          >
            <Input
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              placeholder={`New ${activeType}…`}
            />
            <Button type="submit" disabled={!creatingName.trim()}>
              Add
            </Button>
          </form>
        </div>

        {entries === undefined ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No {activeType} entries yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <CodexCard key={entry._id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CodexCard({ entry }: { entry: Doc<"codexEntries"> }) {
  const update = useMutation(api.codex.update);
  const remove = useMutation(api.codex.remove);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.name);
  const [summary, setSummary] = useState(entry.summary ?? "");
  const [fieldsJson, setFieldsJson] = useState(
    JSON.stringify(entry.fields ?? {}, null, 2)
  );
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-codex-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry._id }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left"
        >
          <div className="font-medium">{entry.name}</div>
          {entry.summary && (
            <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
              {entry.summary}
            </div>
          )}
        </button>
        <span className="text-xs text-muted-foreground">{entry.aiScope}</span>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => update({ id: entry._id, name })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>AI scope</Label>
              <select
                value={entry.aiScope}
                onChange={(e) =>
                  update({
                    id: entry._id,
                    aiScope: e.target.value as "always" | "match" | "never",
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="always">Always inject</option>
                <option value="match">Inject when mentioned</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Summary</Label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={() => update({ id: entry._id, summary })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fields (JSON)</Label>
            <textarea
              rows={6}
              value={fieldsJson}
              onChange={(e) => setFieldsJson(e.target.value)}
              onBlur={() => {
                try {
                  const parsed = JSON.parse(fieldsJson);
                  update({ id: entry._id, fields: parsed });
                } catch {
                  /* ignore parse errors during edit */
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={suggest} disabled={suggesting}>
              {suggesting ? "Suggesting…" : "AI fill fields"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => remove({ id: entry._id })}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
