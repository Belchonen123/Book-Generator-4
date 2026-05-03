"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TYPES = [
  "character",
  "location",
  "object",
  "lore",
  "faction",
  "subplot",
] as const;

export function SeriesCodexTab({ seriesId }: { seriesId: Id<"series"> }) {
  const entries = useQuery(api.seriesCodex.list, { seriesId });
  const create = useMutation(api.seriesCodex.create);
  const update = useMutation(api.seriesCodex.update);
  const remove = useMutation(api.seriesCodex.remove);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("character");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New entry name…"
        />
        <Button
          disabled={!name.trim()}
          onClick={async () => {
            await create({ seriesId, type, name });
            setName("");
          }}
        >
          Add
        </Button>
      </div>
      {entries === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No series codex yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry._id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs uppercase text-muted-foreground">
                    {entry.type}
                  </span>{" "}
                  <Input
                    defaultValue={entry.name}
                    onBlur={(e) =>
                      update({ id: entry._id, name: e.target.value })
                    }
                    className="inline-block w-auto"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => remove({ id: entry._id })}
                >
                  Delete
                </Button>
              </div>
              <textarea
                rows={2}
                defaultValue={entry.summary ?? ""}
                onBlur={(e) =>
                  update({ id: entry._id, summary: e.target.value })
                }
                placeholder="Summary…"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
