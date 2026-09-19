import { config } from "../config.js";

/**
 * The subagents Jarvis can direct. Each is a real, separately-implemented
 * capability (compose, dial, open, YouTube content) — this dispatcher's
 * only job is picking which one a spoken command means, using Claude's
 * tool-calling instead of the old keyword-matching CommandRouter so
 * phrasing that CommandRouter couldn't parse (e.g. "shoot Sam a message
 * about running late") still routes correctly.
 */
const TOOLS = [
  {
    name: "draft_email",
    description: "Draft an email to send on the user's behalf. Used for phrases like 'email X about Y' or 'write an email to X'.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Who the email is to, if named (a name or email address). Omit if not said." },
        topic: { type: "string", description: "What the email should say, in the user's own words." },
      },
      required: ["topic"],
    },
  },
  {
    name: "draft_text",
    description: "Draft a text/SMS message to send on the user's behalf. Used for phrases like 'text X that Y' or 'send a message to X'.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Who the text is to (a name)." },
        topic: { type: "string", description: "What the text should say, in the user's own words." },
      },
      required: ["recipient", "topic"],
    },
  },
  {
    name: "place_call",
    description: "Call someone. Used for phrases like 'call X'.",
    input_schema: {
      type: "object",
      properties: { target: { type: "string", description: "Who to call (a name)." } },
      required: ["target"],
    },
  },
  {
    name: "open_app",
    description: "Open another app on the phone. Used for phrases like 'open Instagram'.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "The app's name." } },
      required: ["name"],
    },
  },
  {
    name: "create_youtube_content",
    description:
      "Direct the content subagent to draft a YouTube video's title, description, tags, and script for a given topic, ahead of posting it. Used for phrases like 'make a YouTube video about X' or 'post something on YouTube about X'.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", description: "What the video should be about." } },
      required: ["topic"],
    },
  },
] as const;

export type AgentToolName = (typeof TOOLS)[number]["name"];

export interface AgentDispatchResult {
  tool: AgentToolName | "unknown";
  input: Record<string, unknown>;
}

interface AnthropicToolUseBlock {
  type: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content?: AnthropicToolUseBlock[];
  error?: { message: string };
}

/**
 * Sends the transcript to Claude with the subagent tool definitions above
 * and returns whichever one it picked, plus the arguments it extracted.
 * This is real tool-calling (the `tools` param), not prompted JSON —
 * Claude decides both which subagent applies and how to fill its inputs.
 */
export async function dispatchAgentCommand(transcript: string): Promise<AgentDispatchResult> {
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
      max_tokens: 400,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      system:
        "You are Jarvis's command router. Given a spoken command, call exactly one tool that matches the user's intent. If nothing matches any tool, don't call a tool.",
      messages: [{ role: "user", content: transcript }],
    }),
  });

  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Anthropic API error (${res.status})`);
  }

  const toolUse = (data.content ?? []).find((block) => block.type === "tool_use");
  if (!toolUse || !toolUse.name) {
    return { tool: "unknown", input: {} };
  }
  return { tool: toolUse.name as AgentToolName, input: toolUse.input ?? {} };
}
