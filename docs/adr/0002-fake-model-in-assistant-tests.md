# ADR 0002: A scripted fake model in the assistant tests

**Status:** Accepted · **Date:** 2026-10-27

## Context
The assistant (stories S36–S40) calls Claude with tool use, streams its reply, and asks the user to confirm before any
write. Testing that against the real API would be slow, cost money, need a key in CI, and give different answers on
every run, while the tests must check exact behavior: which tools run, what reaches the model, that a write waits for
confirmation, and that issue text only reaches the model inside tool results.

## Decision
Behind one `Model` interface (`src/lib/assistant/model.ts`), `getModel()` returns:
- **Production:** `claude-model.ts`, the Anthropic Messages API (streamed), when `ANTHROPIC_API_KEY` or
  `ANTHROPIC_AUTH_TOKEN` is set; else `groq-model.ts` (Groq, OpenAI-compatible) when `GROQ_API_KEY` is set;
  otherwise `null` ("Assistant is not configured").
- **Test mode (`TRACKLY_TEST=1`):** `fake-model.ts`. A test queues replies (text and/or `tool_use` blocks) through
  `POST /api/test/assistant-script`; each model request takes the next one, streams its text word by word, and is
  appended to a log the test reads through `GET /api/test/assistant-log`. The script can also simulate missing
  credentials.

The tool loop, the tools and the confirmation flow (`loop.ts`, `tools.ts`) are the same code in both cases; only the
model is swapped.

## Consequences
- The assistant tests are free, fast and deterministic, and need no secret in CI.
- The tests can check what the app *sends* to the model (prompt-injection boundaries, tool results), not only what it
  shows.
- Nothing in CI proves the real Claude integration works (model ID, SDK parameters, streaming). Check it by hand
  with a real key before each release.
- The fake model and its endpoints must never be reachable in production; they depend on `TRACKLY_TEST` not being set
  there.
