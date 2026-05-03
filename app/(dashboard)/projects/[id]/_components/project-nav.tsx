"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const TABS: Array<{ slug: string; label: string }> = [
  { slug: "", label: "Overview" },
  { slug: "idea", label: "Idea" },
  { slug: "outline", label: "Outline" },
  { slug: "chapters", label: "Chapters" },
  { slug: "style", label: "Style" },
  { slug: "codex", label: "Codex" },
  { slug: "brainstorm", label: "Brainstorm" },
  { slug: "pacing", label: "Pacing" },
  { slug: "cover", label: "Cover" },
  { slug: "audio", label: "Audio" },
  { slug: "export", label: "Export" },
];

export function ProjectNav({ bookId }: { bookId: string }) {
  const book = useQuery(api.books.get, { id: bookId as Id<"books"> });
  const pathname = usePathname();

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {book?.title ?? "…"}
        </h1>
        {book && (
          <p className="text-xs text-muted-foreground">
            {book.status} · {book.chapterCount} chapters · {book.wordCount.toLocaleString()} words
          </p>
        )}
      </div>
      <nav className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const href = `/projects/${bookId}${tab.slug ? `/${tab.slug}` : ""}`;
          const active =
            tab.slug === ""
              ? pathname === `/projects/${bookId}`
              : pathname.startsWith(href);
          return (
            <Link
              key={tab.slug}
              href={href}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
