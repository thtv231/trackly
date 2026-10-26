import Anthropic from "@anthropic-ai/sdk";
import type { Model } from "./model";

// Production model: Claude through the Messages API, streamed so text reaches the panel as it is written.
// Credentials come from the environment (ANTHROPIC_API_KEY).

let client: Anthropic | undefined;

export const claudeModel: Model = {
  async send(req, onText) {
    client ??= new Anthropic();
    const stream = client.messages.stream({
      ...req,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
    stream.on("text", onText);
    const message = await stream.finalMessage();
    // Returned unchanged (thinking blocks included): the loop sends it back as the assistant turn.
    return { content: message.content as Anthropic.ContentBlockParam[], stop_reason: message.stop_reason };
  },
};
