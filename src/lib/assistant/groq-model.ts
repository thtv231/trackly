import type Anthropic from "@anthropic-ai/sdk";
import type { Model } from "./model";

// Alternative production model: Groq's OpenAI-compatible Chat Completions API, streamed.
// The loop speaks the Messages format, so requests and replies are translated here.
// Credentials come from the environment (GROQ_API_KEY); the model from TRACKLY_AI_MODEL.

const URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

const textOf = (content: Anthropic.ToolResultBlockParam["content"]): string =>
  typeof content === "string"
    ? content
    : (content ?? []).map((b) => (b.type === "text" ? b.text : "")).join("");

function toChat(system: string, messages: Anthropic.MessageParam[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content } as ChatMessage);
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const calls: ToolCall[] = m.content
        .filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use")
        .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    for (const b of m.content) {
      if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: textOf(b.content) });
      else if (b.type === "text") out.push({ role: "user", content: b.text });
    }
  }
  return out;
}

// Groq validates tool arguments against the schema, and the model often sends null for fields it leaves out.
// Optional fields that don't take null accept it here, and those nulls are dropped before the loop sees the input
// (fields where null has a meaning, like update_issue's assignee, keep it).
type Prop = { type?: string | string[]; enum?: unknown[] };
const takesNull = (p: Prop) => [p.type].flat().includes("null");

function nullableOptional(schema: Anthropic.Tool["input_schema"]): Anthropic.Tool["input_schema"] {
  const required = new Set(schema.required ?? []);
  const props = Object.fromEntries(
    Object.entries((schema.properties ?? {}) as Record<string, Prop>).map(([k, p]) =>
      required.has(k) || !p.type || takesNull(p)
        ? [k, p]
        : [k, { ...p, type: [...[p.type].flat(), "null"], ...(p.enum ? { enum: [...p.enum, null] } : {}) }],
    ),
  );
  return { ...schema, properties: props };
}

function dropAddedNulls(input: unknown, schema: Anthropic.Tool["input_schema"] | undefined): unknown {
  if (!input || typeof input !== "object" || !schema) return input;
  const props = (schema.properties ?? {}) as Record<string, Prop>;
  return Object.fromEntries(Object.entries(input).filter(([k, v]) => v !== null || (props[k] && takesNull(props[k]))));
}

const STOP: Record<string, string> = { tool_calls: "tool_use", stop: "end_turn", length: "max_tokens" };

export const groqModel: Model = {
  async send(req, onText) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: process.env.TRACKLY_AI_MODEL || GROQ_DEFAULT_MODEL,
        max_completion_tokens: req.max_tokens,
        messages: toChat(req.system, req.messages),
        tools: req.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: nullableOptional(t.input_schema) },
        })),
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Groq request failed: ${res.status}`);

    let text = "";
    let finish: string | null = null;
    const calls: { id: string; name: string; args: string }[] = [];
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data || data === "[DONE]") continue;
        const chunk = JSON.parse(data);
        // Groq reports mid-stream failures (e.g. tool_use_failed) as an error event, not an HTTP status.
        if (chunk.error) throw new Error(`Groq stream error: ${chunk.error.code ?? chunk.error.message}`);
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};
        if (delta.content) {
          text += delta.content;
          onText(delta.content);
        }
        for (const tc of delta.tool_calls ?? []) {
          const c = (calls[tc.index] ??= { id: "", name: "", args: "" });
          if (tc.id) c.id = tc.id;
          if (tc.function?.name) c.name += tc.function.name;
          if (tc.function?.arguments) c.args += tc.function.arguments;
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    }

    const content: Anthropic.ContentBlockParam[] = [];
    if (text) content.push({ type: "text", text });
    for (const c of calls.filter(Boolean)) {
      let input: unknown = {};
      try {
        input = c.args ? dropAddedNulls(JSON.parse(c.args), req.tools.find((t) => t.name === c.name)?.input_schema) : {};
      } catch {
        input = {};
      }
      content.push({ type: "tool_use", id: c.id, name: c.name, input });
    }
    const stop = calls.length > 0 ? "tool_use" : finish ? (STOP[finish] ?? finish) : null;
    return { content, stop_reason: stop };
  },
};
