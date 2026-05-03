"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FindReplace } from "./_components/find-replace";

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const book = useQuery(api.books.get, { id: bookId });

  if (book === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (book === null) return <p>Not found</p>;

  return (
    <div className="space-y-6">
      <NextStep status={book.status} bookId={params.id} />
      <FindReplace bookId={bookId} />
    </div>
  );
}

function NextStep({ status, bookId }: { status: string; bookId: string }) {
  const nextHref =
    status === "idea" || status === "refining"
      ? `/projects/${bookId}/idea`
      : status === "outlining"
        ? `/projects/${bookId}/outline`
        : status === "writing" || status === "editing"
          ? `/projects/${bookId}/outline`
          : status === "cover"
            ? `/projects/${bookId}/cover`
            : `/projects/${bookId}/export`;
  return (
    <Link
      href={nextHref}
      className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-muted"
    >
      Continue →
    </Link>
  );
}
