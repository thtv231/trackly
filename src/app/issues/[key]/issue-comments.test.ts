import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IssueComments } from "./issue-comments";

// useFormError needs IssueDetails' private context, so stub just that hook.
vi.mock("./issue-details", () => ({
  useFormError: () => ({ error: null, show: () => {}, clear: () => {} }),
}));

const render = (body: string, author = "alice") =>
  renderToStaticMarkup(
    createElement(IssueComments, {
      issueKey: "TRK-1",
      canComment: false,
      comments: [{ id: 1, author, body, created_at: "2026-11-02T09:00:00.000Z" }],
    }),
  );

describe("IssueComments", () => {
  it("renders a comment with its author, date and wrapper", () => {
    const out = render("hello", "carol");
    expect(out).toContain('data-testid="comment"');
    expect(out).toContain("carol");
    expect(out).toContain("Nov 2, 2026");
    expect(out).toContain("<p>hello</p>");
  });

  it("shows a <script> tag in a comment as text, not an element", () => {
    const out = render("<script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("never turns an onerror attribute into an element or attribute", () => {
    const out = render('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<img");
    expect(out).not.toMatch(/<[^>]*\sonerror=/);
    expect(out).toContain("&lt;img");
  });

  it("never renders a javascript: link as <a> or href", () => {
    const out = render("[click](javascript:alert(1))");
    expect(out).not.toContain("<a");
    expect(out).not.toContain("href");
  });

  it("still renders **bold** as <strong> inside the comment", () => {
    expect(render("this is **bold**")).toContain("<strong>bold</strong>");
  });

  it("escapes markup in the author name", () => {
    const out = render("hi", "<b>eve</b>");
    expect(out).not.toContain("<b>eve");
    expect(out).toContain("&lt;b&gt;eve");
  });
});
