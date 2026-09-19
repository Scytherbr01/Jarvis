import { config } from "../config.js";

export interface YouTubeContentDraft {
  title: string;
  description: string;
  tags: string[];
  script: string;
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message: string };
}

/**
 * The Content subagent: drafts everything Jarvis can genuinely produce
 * for a YouTube upload — title, description, tags, and a spoken script —
 * given just a topic. It does not generate footage; pairing this draft
 * with a video the user already has (or records) is what /youtube/upload
 * posts.
 */
export async function draftYouTubeContent(topic: string): Promise<YouTubeContentDraft> {
  if (!config.anthropic.apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the backend.");
  }

  const prompt = [
    `Draft YouTube metadata and a short spoken script for a video on this topic: ${topic}`,
    ``,
    `Respond with strict JSON only, no markdown fences:`,
    `{"title": string, "description": string, "tags": string[], "script": string}`,
    `- title: under 70 characters, punchy, no clickbait ALL CAPS.`,
    `- description: 2-4 sentences, plain text.`,
    `- tags: 5-10 short keyword tags.`,
    `- script: a 100-200 word spoken script the creator can read on camera.`,
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropic.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Anthropic API error (${res.status})`);
  }
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as YouTubeContentDraft;
    if (!parsed.title || !parsed.description || !parsed.script) throw new Error("Missing fields");
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    return parsed;
  } catch {
    throw new Error(`Couldn't parse a content draft from the model response: ${text.slice(0, 200)}`);
  }
}
