import { elevenLabsKey } from "./clients";
import { MODELS } from "./models";

const BASE = "https://api.elevenlabs.io/v1";

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
};

export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${BASE}/voices`, {
    headers: { "xi-api-key": elevenLabsKey() },
  });
  if (!res.ok) throw new Error(`ElevenLabs voices: ${res.status}`);
  const data = (await res.json()) as { voices: ElevenLabsVoice[] };
  return data.voices;
}

/**
 * Synthesize a chunk of text. ElevenLabs limits ~5k chars per request; the
 * audio worker chunks chapters before calling this.
 */
export async function synthesize(opts: {
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<ArrayBuffer> {
  const res = await fetch(
    `${BASE}/text-to-speech/${opts.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: opts.modelId ?? MODELS.elevenlabs.multilingual,
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status}: ${detail}`);
  }
  return await res.arrayBuffer();
}
