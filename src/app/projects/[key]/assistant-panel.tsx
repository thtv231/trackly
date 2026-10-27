"use client";

import { useEffect, useRef, useState } from "react";

// The AI assistant panel on project pages (S36–S40). Replies stream in as NDJSON events from /api/assistant;
// a proposed write shows a confirmation card and nothing changes until the user confirms it.
// All model and issue text is rendered as plain text.

type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string }
  | { kind: "confirm"; pendingId: string; tool: string; input: Record<string, unknown>; decided?: "approved" | "cancelled" }
  | { kind: "result"; text: string }
  | { kind: "error"; text: string };

type AssistantEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "confirm"; pendingId: string; tool: string; input: Record<string, unknown> }
  | { type: "result"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const FIELD_LABEL: Record<string, string> = {
  key: "Issue",
  title: "Title",
  type: "Type",
  priority: "Priority",
  assignee: "Assignee",
  points: "Points",
  dueDate: "Due date",
  description: "Description",
};

/** The conversation as text turns for the API. Tool calls stay on the server. */
type Turn = { role: "user" | "assistant"; content: string };
function history(items: Item[]): Turn[] {
  return items.flatMap((item): Turn[] => {
    if (item.kind === "user") return [{ role: "user", content: item.text }];
    if (item.kind === "assistant" || item.kind === "result") return [{ role: "assistant", content: item.text }];
    return [];
  });
}

export function AssistantPanel({ projectKey }: { projectKey: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items]);

  function apply(event: AssistantEvent) {
    setItems((prev) => {
      const last = prev.at(-1);
      switch (event.type) {
        case "text":
          if (last?.kind === "assistant") return [...prev.slice(0, -1), { ...last, text: last.text + event.delta }];
          return [...prev, { kind: "assistant", text: event.delta }];
        case "tool":
          return [...prev, { kind: "tool", name: event.name }];
        case "confirm":
          return [...prev, { kind: "confirm", pendingId: event.pendingId, tool: event.tool, input: event.input }];
        case "result":
          return [...prev, { kind: "result", text: event.text }];
        case "error":
          return [...prev, { kind: "error", text: event.message }];
        default:
          return prev;
      }
    });
  }

  async function stream(url: string, payload: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        apply({ type: "error", message: body?.error ?? "The assistant is not available right now" });
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) apply(JSON.parse(line) as AssistantEvent);
        }
      }
    } catch {
      apply({ type: "error", message: "Lost the connection to the assistant" });
    } finally {
      setBusy(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Item[] = [...items, { kind: "user", text }];
    setItems(next);
    setInput("");
    void stream("/api/assistant", { projectKey, messages: history(next) });
  }

  function decide(pendingId: string, approve: boolean) {
    setItems((prev) =>
      prev.map((item) =>
        item.kind === "confirm" && item.pendingId === pendingId
          ? { ...item, decided: approve ? "approved" : "cancelled" }
          : item,
      ),
    );
    void stream("/api/assistant/confirm", { projectKey, pendingId, approve });
  }

  return (
    <>
      <button
        type="button"
        data-testid="assistant-open"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-medium text-brand shadow-sm transition-colors hover:bg-brand-soft"
      >
        ✦ Assistant
      </button>
      {open && (
        <aside
          data-testid="assistant-panel"
          aria-label="Assistant"
          className="fixed right-4 bottom-4 z-40 flex max-h-[min(36rem,calc(100vh-2rem))] w-[min(26rem,calc(100vw-2rem))] flex-col rounded-xl border border-line bg-panel shadow-xl"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="font-display text-sm font-semibold text-brand-strong">Assistant · {projectKey}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the assistant"
              className="rounded px-2 text-ink-muted hover:bg-brand-soft hover:text-brand"
            >
              ×
            </button>
          </header>
          <div ref={listRef} aria-live="polite" className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
            {items.length === 0 && (
              <p className="text-ink-muted">Ask about the issues in {projectKey}, or ask me to create or change one.</p>
            )}
            {items.map((item, i) => {
              switch (item.kind) {
                case "user":
                  return (
                    <p key={i} className="ml-8 rounded-lg bg-brand px-3 py-2 whitespace-pre-wrap text-white">
                      {item.text}
                    </p>
                  );
                case "assistant":
                  return (
                    <p
                      key={i}
                      data-testid="assistant-message"
                      className="mr-8 rounded-lg bg-surface px-3 py-2 whitespace-pre-wrap text-ink"
                    >
                      {withBold(item.text)}
                    </p>
                  );
                case "tool":
                  return (
                    <span
                      key={i}
                      data-testid="assistant-tool"
                      className="inline-block rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent"
                    >
                      {item.name}
                    </span>
                  );
                case "confirm":
                  return (
                    <div key={i} data-testid="assistant-confirm" className="rounded-lg border border-line bg-surface p-3">
                      <p className="mb-2 font-semibold text-ink">
                        {item.tool === "create_issue" ? "Create this issue?" : "Apply these changes?"}
                      </p>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        {Object.entries(item.input).map(([field, value]) => (
                          <div key={field} className="contents">
                            <dt className="text-ink-muted">{FIELD_LABEL[field] ?? field}</dt>
                            <dd className="break-words whitespace-pre-wrap text-ink">
                              {value === null ? "(none)" : typeof value === "string" ? value : JSON.stringify(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {item.decided ? (
                        <p className="mt-2 text-xs text-ink-muted">
                          {item.decided === "approved" ? "Confirmed" : "Cancelled"}
                        </p>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            data-testid="confirm-action"
                            disabled={busy}
                            onClick={() => decide(item.pendingId, true)}
                            className="rounded-md bg-brand px-3 py-1 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            data-testid="cancel-action"
                            disabled={busy}
                            onClick={() => decide(item.pendingId, false)}
                            className="rounded-md border border-line px-3 py-1 font-medium text-ink-muted hover:bg-brand-soft disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                case "result":
                  return (
                    <p key={i} className="text-xs font-medium text-ink-muted">
                      {item.text}
                    </p>
                  );
                case "error":
                  return (
                    <p
                      key={i}
                      data-testid="assistant-error"
                      role="alert"
                      className="rounded-md bg-red-50 px-3 py-2 text-red-700"
                    >
                      {item.text}
                    </p>
                  );
              }
            })}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <label htmlFor="assistant-input" className="sr-only">
              Message the assistant
            </label>
            <input
              id="assistant-input"
              data-testid="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about an issue…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              data-testid="assistant-send"
              disabled={busy}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60"
            >
              Send
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

/** Models sometimes answer in Markdown; show **bold** as bold and drop the stray asterisks instead of printing them. */
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part.replace(/\*\*/g, "")));
}
