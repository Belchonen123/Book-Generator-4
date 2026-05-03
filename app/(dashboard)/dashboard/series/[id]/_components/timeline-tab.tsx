"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function SeriesTimelineTab({ seriesId }: { seriesId: Id<"series"> }) {
  const arcs = useQuery(api.seriesArcs.listArcs, { seriesId });
  const beats = useQuery(api.seriesArcs.beatsForSeries, { seriesId });
  const books = useQuery(api.series.booksInSeries, { seriesId });

  if (arcs === undefined || beats === undefined || books === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (arcs.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Add arcs and beats to populate the timeline.
      </p>
    );
  }

  const bookOrders = books.map((b) => b.seriesOrder ?? 0);

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="flex gap-1 text-xs text-muted-foreground">
        <div className="w-32 flex-shrink-0" />
        {books.map((b) => (
          <div key={b._id} className="w-32 flex-shrink-0 text-center">
            #{b.seriesOrder} {b.title}
          </div>
        ))}
      </div>
      {arcs.map((arc) => {
        const arcBeats = beats.filter((b) => b.arcId === arc._id);
        return (
          <div key={arc._id} className="flex gap-1">
            <div className="w-32 flex-shrink-0 text-sm">
              <div className="font-medium">{arc.name}</div>
              <div className="text-xs text-muted-foreground">{arc.type}</div>
            </div>
            {bookOrders.map((order) => {
              const cellBeats = arcBeats.filter(
                (b) =>
                  books.find((book) => book.seriesOrder === order && book._id === b.bookId)
              );
              return (
                <div
                  key={order}
                  className="min-h-12 w-32 flex-shrink-0 rounded border bg-muted/20 p-1 text-xs"
                >
                  {cellBeats.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    cellBeats.map((b) => (
                      <div key={b._id} className="rounded bg-background px-1 py-0.5">
                        {b.kind}: {b.title}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
