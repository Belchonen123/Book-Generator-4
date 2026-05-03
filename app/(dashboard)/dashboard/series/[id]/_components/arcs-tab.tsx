"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ARC_TYPES = [
  "character",
  "plot",
  "thematic",
  "romance",
  "mystery",
  "world",
  "custom",
] as const;
const BEAT_KINDS = [
  "setup",
  "foreshadow",
  "development",
  "complication",
  "payoff",
  "resolution",
] as const;

export function SeriesArcsTab({ seriesId }: { seriesId: Id<"series"> }) {
  const arcs = useQuery(api.seriesArcs.listArcs, { seriesId });
  const create = useMutation(api.seriesArcs.createArc);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ARC_TYPES)[number]>("plot");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as (typeof ARC_TYPES)[number])}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {ARC_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New arc name…"
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
      {arcs?.map((arc) => <ArcCard key={arc._id} arc={arc} />)}
    </div>
  );
}

function ArcCard({ arc }: { arc: Doc<"seriesArcs"> }) {
  const beats = useQuery(api.seriesArcs.listBeats, { arcId: arc._id });
  const updateArc = useMutation(api.seriesArcs.updateArc);
  const removeArc = useMutation(api.seriesArcs.removeArc);
  const createBeat = useMutation(api.seriesArcs.createBeat);
  const [suggesting, setSuggesting] = useState(false);
  const [beatTitle, setBeatTitle] = useState("");
  const [beatKind, setBeatKind] = useState<(typeof BEAT_KINDS)[number]>("setup");

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          defaultValue={arc.name}
          onBlur={(e) => updateArc({ id: arc._id, name: e.target.value })}
          className="font-medium"
        />
        <span className="text-xs uppercase text-muted-foreground">{arc.type}</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={suggesting}
          onClick={async () => {
            setSuggesting(true);
            try {
              await fetch("/api/ai/suggest-series-arc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ arcId: arc._id }),
              });
            } finally {
              setSuggesting(false);
            }
          }}
        >
          {suggesting ? "…" : "AI fill"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={() => removeArc({ id: arc._id })}
        >
          Delete
        </Button>
      </div>
      <textarea
        rows={2}
        defaultValue={arc.description ?? ""}
        onBlur={(e) => updateArc({ id: arc._id, description: e.target.value })}
        placeholder="Description…"
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="mt-3 space-y-1.5">
        {beats?.map((beat) => <BeatRow key={beat._id} beat={beat} />)}
        <div className="flex gap-2">
          <select
            value={beatKind}
            onChange={(e) => setBeatKind(e.target.value as (typeof BEAT_KINDS)[number])}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {BEAT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <Input
            value={beatTitle}
            onChange={(e) => setBeatTitle(e.target.value)}
            placeholder="New beat title…"
            className="text-sm"
          />
          <Button
            size="sm"
            disabled={!beatTitle.trim()}
            onClick={async () => {
              await createBeat({ arcId: arc._id, kind: beatKind, title: beatTitle });
              setBeatTitle("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function BeatRow({ beat }: { beat: Doc<"seriesArcBeats"> }) {
  const update = useMutation(api.seriesArcs.updateBeat);
  const remove = useMutation(api.seriesArcs.removeBeat);
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded border p-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase text-muted-foreground">{beat.kind}</span>
        <Input
          defaultValue={beat.title}
          onBlur={(e) => update({ id: beat._id, title: e.target.value })}
          className="text-sm"
        />
        <select
          value={beat.status}
          onChange={(e) =>
            update({
              id: beat._id,
              status: e.target.value as "planned" | "drafted" | "complete",
            })
          }
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option>planned</option>
          <option>drafted</option>
          <option>complete</option>
        </select>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await fetch("/api/ai/suggest-series-beat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ beatId: beat._id }),
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : "AI"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={() => remove({ id: beat._id })}
        >
          ×
        </Button>
      </div>
      {beat.description && (
        <p className="mt-1 text-xs text-muted-foreground">{beat.description}</p>
      )}
    </div>
  );
}
