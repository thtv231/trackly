import type Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_LOG, ASSISTANT_SCRIPT, readJsonSetting, writeJsonSetting } from "../testing";
import type { Model } from "./model";

// TEST ONLY: the scripted fake model. Each request is appended to the log (GET /api/test/assistant-log) and
// answered with the next reply queued through POST /api/test/assistant-script. Text is streamed word by word,
// `chunkDelayMs` apart, so the tests can see a reply before it is complete (S36).

type ScriptedReply = { content?: Anthropic.ContentBlockParam[]; chunkDelayMs?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let fakeIds = 0;

export const fakeModel: Model = {
  async send(req, onText) {
    const log = await readJsonSetting<unknown[]>(ASSISTANT_LOG, []);
    const { model, system, messages, tools } = req;
    await writeJsonSetting(ASSISTANT_LOG, [...log, { model, system, messages, tools }]);

    const [reply, ...rest] = await readJsonSetting<ScriptedReply[]>(ASSISTANT_SCRIPT, []);
    await writeJsonSetting(ASSISTANT_SCRIPT, rest);
    const content = reply?.content ?? [{ type: "text", text: "(The fake model has no scripted reply.)" }];

    let first = true;
    for (const block of content) {
      if (block.type === "tool_use") block.id ||= `toolu_fake_${++fakeIds}`;
      if (block.type !== "text") continue;
      for (const word of block.text.split(/(?<=\s)/)) {
        if (!first) await sleep(reply?.chunkDelayMs ?? 0);
        first = false;
        onText(word);
      }
    }
    return { content, stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn" };
  },
};
