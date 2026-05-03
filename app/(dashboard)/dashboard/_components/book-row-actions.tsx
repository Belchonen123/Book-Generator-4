"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BookRowActions({
  bookId,
  title,
}: {
  bookId: Id<"books">;
  title: string;
}) {
  const rename = useMutation(api.books.rename);
  const remove = useMutation(api.books.remove);
  const [mode, setMode] = useState<"idle" | "rename" | "confirm-delete">("idle");
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);

  if (mode === "rename") {
    return (
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await rename({ id: bookId, title: draft });
          setBusy(false);
          setMode("idle");
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          className="w-48"
        />
        <Button type="submit" size="sm" disabled={busy}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancel
        </Button>
      </form>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm text-muted-foreground">Delete?</span>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await remove({ id: bookId });
            setBusy(false);
          }}
        >
          Yes, delete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="ghost" onClick={() => setMode("rename")}>
        Rename
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600 hover:bg-red-50"
        onClick={() => setMode("confirm-delete")}
      >
        Delete
      </Button>
    </div>
  );
}
