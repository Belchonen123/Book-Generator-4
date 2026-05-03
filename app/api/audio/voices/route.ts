import { listVoices } from "@/lib/ai/elevenlabs";
import { requireAuthedRoute } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthedRoute();
  if (auth instanceof Response) return auth;
  try {
    const voices = await listVoices();
    return Response.json({
      voices: voices.map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url,
      })),
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Failed", {
      status: 502,
    });
  }
}
