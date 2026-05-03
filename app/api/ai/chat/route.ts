import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { streamCompletion } from "@/lib/ai/stream";
import {
  checkRateLimit,
  requireAuthedRoute,
  resolvePromptForRoute,
} from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Mention =
  | { kind: "codex"; id: Id<"codexEntries">; label: string }
  | { kind: "chapter"; id: Id<"chapters">; label: string };

export async function POST(req: Request) {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  const limited = await checkRateLimit(auth.userId, "chat");
  if (limited) return limited;

  const { threadId, content, mentions = [] } = (await req.json()) as {
    threadId: Id<"chatThreads">;
    content: string;
    mentions?: Mention[];
  };
  if (!content.trim()) return new Response("Empty message", { status: 400 });

  const messages = await fetchQuery(
    api.chat.getMessages,
    { threadId },
    { token: auth.token }
  );
  // Persist the user message before generating.
  await fetchMutation(
    api.chat.appendMessage,
    { threadId, role: "user", content, mentions },
    { token: auth.token }
  );

  const thread = messages[0]
    ? { chapterId: messages[0].userId as unknown as Id<"chapters"> } // placeholder
    : null;
  void thread;

  // Load thread + chapter context.
  const threads = await fetchQuery(
    api.chat.listThreads,
    {
      chapterId: (await loadThreadChapterId(auth.token, threadId)) as Id<"chapters">,
    },
    { token: auth.token }
  );
  const currentThread = threads.find((t) => t._id === threadId);
  if (!currentThread) return new Response("Thread missing", { status: 404 });

  const chapter = await fetchQuery(
    api.chapters.get,
    { id: currentThread.chapterId },
    { token: auth.token }
  );
  const book = await fetchQuery(
    api.books.get,
    { id: chapter.bookId },
    { token: auth.token }
  );

  // Resolve mentions into context blocks.
  const mentionBlocks: string[] = [];
  for (const m of mentions) {
    if (m.kind === "codex") {
      try {
        const entry = await fetchQuery(
          api.codex.get,
          { id: m.id as Id<"codexEntries"> },
          { token: auth.token }
        );
        mentionBlocks.push(
          `# Codex: ${entry.name} (${entry.type})\n${entry.summary ?? ""}\n${JSON.stringify(entry.fields ?? {})}`
        );
      } catch {
        /* skip */
      }
    } else {
      try {
        const ch = await fetchQuery(
          api.chapters.get,
          { id: m.id as Id<"chapters"> },
          { token: auth.token }
        );
        mentionBlocks.push(`# Chapter ${ch.order}: ${ch.title}\n${ch.plainText}`);
      } catch {
        /* skip */
      }
    }
  }

  const systemPrompt = await resolvePromptForRoute(
    auth.token,
    "chat",
    { chapterNumber: chapter.order, bookTitle: book.title },
    chapter.bookId
  );

  const systemFull =
    systemPrompt +
    `\n\n# Current chapter\n${chapter.plainText}` +
    (mentionBlocks.length ? `\n\n${mentionBlocks.join("\n\n")}` : "");

  const history = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await streamCompletion({
      task: "chat",
      system: systemFull,
      messages: [...history, { role: "user", content }],
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Failed", {
      status: 502,
    });
  }

  let buffer = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });
          }
        }
        buffer += decoder.decode();
        await fetchMutation(
          api.chat.appendMessage,
          { threadId, role: "assistant", content: buffer },
          { token: auth.token }
        );
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function loadThreadChapterId(
  token: string,
  threadId: Id<"chatThreads">
): Promise<Id<"chapters">> {
  // Cheap lookup: pull a single message to find the threadId, then list
  // threads via the chapter that the appendMessage above gave us. Since the
  // schema doesn't expose getThread directly, walk via getMessages first;
  // the very first user message we just inserted shares the userId/threadId.
  // We instead added a dedicated query below.
  const t = await fetchQuery(
    api.chat._getThread,
    { id: threadId },
    { token }
  );
  return t.chapterId;
}
