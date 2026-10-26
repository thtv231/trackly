import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe("Markdown", () => {
  it("renders bold, italic and code", () => {
    expect(html("a **b** *c* `d`")).toContain("a <strong>b</strong> <em>c</em> <code");
  });

  it("renders paragraphs and lists", () => {
    const out = html("Intro.\n\n- one\n- two\n\n1. first");
    expect(out).toContain("<p>Intro.</p>");
    expect(out).toContain("<ul");
    expect(out.match(/<li>/g)).toHaveLength(3);
    expect(out).toContain("<ol");
  });

  it("shows raw HTML as text", () => {
    const out = html('<script>alert(1)</script> <img src=x onerror="alert(1)"> **ok**');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("<strong>ok</strong>");
  });
});
