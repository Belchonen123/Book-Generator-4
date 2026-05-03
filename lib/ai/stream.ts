import { anthropic, openai } from "./clients";
import { MODEL_ROUTING, type AiTask } from "./models";

export type Message = { role: "user" | "assistant" | "system"; content: string };

export type GenerateOptions = {
  task: AiTask;
  system?: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
};

/**
 * Streams an AI completion as a ReadableStream of plain UTF-8 chunks. Tries
 * the task's primary model first, falls through to fallbacks on transient
 * errors. The returned stream is suitable for direct use in a Next.js route
 * handler (`return new Response(stream)`) or Vercel AI SDK consumers.
 */
export async function streamCompletion(opts: GenerateOptions): Promise<ReadableStream<Uint8Array>> {
  const chain = MODEL_ROUTING[opts.task];
  if (!chain?.length) throw new Error(`No model routing for task ${opts.task}`);

  let lastError: unknown = null;
  for (const choice of chain) {
    try {
      if (choice.provider === "anthropic") {
        return await streamAnthropic(choice.model, opts);
      }
      return await streamOpenAi(choice.model, opts);
    } catch (err) {
      lastError = err;
      if (!isTransient(err)) throw err;
    }
  }
  throw lastError ?? new Error("All providers failed");
}

/**
 * Non-streaming convenience: collects the full response as a string. Used
 * by structured ops (idea refinement, metadata, codex suggestions).
 */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const stream = await streamCompletion(opts);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

async function streamAnthropic(
  model: string,
  opts: GenerateOptions
): Promise<ReadableStream<Uint8Array>> {
  const stream = await anthropic().messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature,
    system: opts.system,
    messages: opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

async function streamOpenAi(
  model: string,
  opts: GenerateOptions
): Promise<ReadableStream<Uint8Array>> {
  const messages = opts.system
    ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
    : opts.messages;

  const completion = await openai().chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    stream: true,
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status && (status === 429 || status >= 500)) return true;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}
