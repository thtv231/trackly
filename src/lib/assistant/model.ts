import type Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_CONFIGURED, isTestMode, readJsonSetting } from "../testing";

// The assistant talks to "a model": Claude in production, the scripted fake model under test (group F).
// Both take the same request and report text deltas as they arrive.

export type ModelRequest = {
  model: string;
  max_tokens: number;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
};

export type ModelReply = { content: Anthropic.ContentBlockParam[]; stop_reason: string | null };

export interface Model {
  send(req: ModelRequest, onText: (delta: string) => void): Promise<ModelReply>;
}

export const MODEL_ID = process.env.TRACKLY_AI_MODEL || "claude-opus-5-5";

/** The model to use, or null when the assistant has no credentials ("Assistant is not configured"). */
export async function getModel(): Promise<Model | null> {
  if (isTestMode()) {
    if (!(await readJsonSetting(ASSISTANT_CONFIGURED, true))) return null;
    return (await import("./fake-model")).fakeModel;
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  return (await import("./claude-model")).claudeModel;
}
