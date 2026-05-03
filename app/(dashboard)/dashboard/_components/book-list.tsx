"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { BookRowActions } from "./book-row-actions";

export function BookList() {
  const books = useQuery(api.books.list, {});
  if (books === undefined) return <p className="text-muted-foreground">Loading…</p>;
  const active = books.filter((b) => !b.archivedAt);
  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No books yet. Create your first to get started.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {active.map((book) => (
        <li key={book._id} className="flex items-center justify-between p-4">
          <Link href={`/projects/${book._id}`} className="min-w-0 flex-1">
            <div className="font-medium">{book.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {book.status} · {book.chapterCount} chapter{book.chapterCount === 1 ? "" : "s"}
              {" · "}
              {book.wordCount.toLocaleString()} words
            </div>
          </Link>
          <BookRowActions bookId={book._id} title={book.title} />
        </li>
      ))}
    </ul>
  );
}
