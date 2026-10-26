---
name: trackly-design
description: Visual design rules for Trackly UI work (pages, layouts, components, styles). Use when building or restyling anything under src/app or src/components so the app gets a distinctive, consistent look instead of default Tailwind styling.
paths:
  - "src/app/**"
  - "src/components/**"
---

# Trackly UI design

Trackly should look like a product someone designed on purpose, not a default Tailwind scaffold. Apply these rules whenever you touch UI in `src/app` or `src/components`.

## Rules

1. **Typography: a distinctive font pair via `next/font`.** Pick one display face for headings and the logo and one readable face for body text (plus a mono for issue keys if it helps). Load them with `next/font/google` in `src/app/layout.tsx`, expose them as CSS variables (`variable: "--font-display"` etc.), and wire them into `@theme` in `globals.css`. Don't fall back to Inter, Roboto, Arial or the system sans stack. `next/font` ships with Next, so this needs no new npm package.
2. **Color: one theme, one dominant color, one accent.** Choose a single committed theme (light or dark, not both) with one dominant brand color and one sharp accent for highlights and calls to action. Define them once as CSS variables on `:root` in `globals.css` (for example `--color-brand`, `--color-accent`, `--color-surface`, `--color-ink`) and map them into Tailwind's `@theme` so classes like `bg-brand` work. Use the variables everywhere instead of scattering raw hex values or a mix of Tailwind palettes. Status, priority and type colors may stay distinct, but should sit comfortably next to the theme.
3. **Motion: a few purposeful transitions.** Add transitions where they explain something: hover and focus states on links, buttons and rows, a fade or slide when a panel or menu opens, a short highlight when an item changes. Keep them quick (about 150–250 ms) and respect `prefers-reduced-motion`. No decorative animation for its own sake, and nothing that slows an interaction down: the acceptance tests run with a 3 s action timeout.
4. **Backgrounds: subtle depth, not flat white.** Give pages a quiet background such as a soft gradient, faint pattern or tinted surface, with cards and panels lifted off it by contrast, borders or light shadows. Keep text contrast readable.
5. **Never change `data-testid` attributes.** They are the contract with the Playwright tests (see `STORIES.md`). Restyle, re-wrap and reorder freely, but keep every `data-testid` with the same spelling, casing and element meaning, and don't remove or move one onto an element with different text or behavior.

## When you're done

- Run `npm run lint`.
- If you touched a page covered by a story, rerun that story's test, e.g. `npx playwright test -g "S03 "`, to confirm the restyle didn't break it.

## Credit

These ideas are adapted from Anthropic's claude-cookbooks notebook "Prompting for frontend aesthetics".
