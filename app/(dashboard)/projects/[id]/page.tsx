"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>();
  const book = useQuery(api.books.get, { id: params.id as Id<"books"> });

  if (book === undefined) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Project shell. Each tab fills in over the next phases.
      </p>
      <NextStep status={book.status} bookId={params.id} />
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
