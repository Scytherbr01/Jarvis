import { config } from "../config.js";

export interface ComposeRequest {
  recipientName?: string;
  recipientEmail?: string;
  topic: string;
  instructions?: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface TextDraft {
  body: string;
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message: string };
}

async function callAnthropic(prompt: string): Promise<string> {
  if (!config.anthropic.apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the backend.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropic.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Anthropic API error (${res.status})`);
  }
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

/**
 * Drafts an email from a short voice-command-style topic using the
 * Claude API. This is the piece that turns "Jarvis, write an email to
 * Sam about rescheduling Friday" into an actual subject + body the app
 * can read back and, once you approve it, send.
 */
export async function composeEmail(req: ComposeRequest): Promise<EmailDraft> {
  const prompt = [
    `Draft a short, natural email.`,
    req.recipientName ? `Recipient: ${req.recipientName}${req.recipientEmail ? ` <${req.recipientEmail}>` : ""}` : undefined,
    `Topic: ${req.topic}`,
    req.instructions ? `Additional instructions: ${req.instructions}` : undefined,
    ``,
    `Respond with strict JSON only, no markdown fences: {"subject": string, "body": string}.`,
    `The body should be plain text, ready to send, with a greeting and sign-off but no placeholder brackets left unfilled — if you don't know the sender's name, sign off as "Sent via Jarvis".`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await callAnthropic(prompt);
  try {
    const parsed = JSON.parse(text) as EmailDraft;
    if (!parsed.subject || !parsed.body) throw new Error("Missing subject/body");
    return parsed;
  } catch {
    throw new Error(`Couldn't parse a draft from the model response: ${text.slice(0, 200)}`);
  }
}

/**
 * Same idea as composeEmail but for a text message: short, no subject
 * line, casual register. The app still reads this back and requires
 * approval, but note it can only pre-fill the Messages compose sheet —
 * iOS requires the user to tap Send themselves, there is no API for a
 * third-party app to send SMS/iMessage silently.
 */
export async function composeText(req: ComposeRequest): Promise<TextDraft> {
  const prompt = [
    `Draft a short text message (SMS-style, casual, no greeting/sign-off needed, one or two sentences).`,
    req.recipientName ? `Recipient: ${req.recipientName}` : undefined,
    `Topic: ${req.topic}`,
    req.instructions ? `Additional instructions: ${req.instructions}` : undefined,
    ``,
    `Respond with strict JSON only, no markdown fences: {"body": string}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await callAnthropic(prompt);
  try {
    const parsed = JSON.parse(text) as TextDraft;
    if (!parsed.body) throw new Error("Missing body");
    return parsed;
  } catch {
    throw new Error(`Couldn't parse a draft from the model response: ${text.slice(0, 200)}`);
  }
}
