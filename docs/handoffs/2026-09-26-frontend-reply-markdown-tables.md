# Advisor replies: heading lead-ins and comparison tables

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** frontend
- **Status:** done
- **PR / issue:** not opened yet (frontend half of "better-formatted advisor replies"; the backend prompt change ships separately)
- **Branch:** `worktree-agent-ac21bc7d87ce7909b` (local worktree, unpushed)
- **Follows:** [Frontend publication](2026-09-26-frontend-publication.md)

## What changed

- Advisor replies render `#`–`######` headings as a semibold lead-in paragraph instead of showing literal `####`. Surrounding `**` is stripped, so `#### **401(k)**` shows `401(k)`.
- GFM tables render as a real `<table>`. Column headers use `th scope="col"` and each row's first cell is `th scope="row"`. The table sits inside a focusable region labelled "Comparison table", and `**bold**` works in cells.
- Up to three columns fit a 320px phone with no scrolling. Four or more columns scroll inside their own region, with a pinned first column and a right-edge shade.
- DESIGN.md gains §4.8 "Advisor replies", which documents the full reply markdown subset.
- `tsconfig.node.json` (the program that type-checks `*.test.ts`) now has `jsx` and `vite/client` types. Tests can import `.tsx` components and render them with `react-dom/server`.

## How to run / verify it

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build   # 55 tests pass
# Visual check (the Prism mock is optional; Playwright can stub the API):
npm run dev -w frontend
# Open /advisor, send a question, and have /advisor/chat return a reply containing a table.
# Check: document.documentElement.scrollWidth <= innerWidth at 320, 375 and 393px.
```

Measured with Playwright against the real `/advisor` page, with `/advisor/chat` stubbed to return a 401(k) vs Roth IRA table:

- **3 columns:** the table fills the reply exactly, at 266px (320), 321px (375) and 339px (393). The label column is 90px at 320. The page scrollWidth equals innerWidth at every width.
- **6 columns:** the region is 266px wide and scrolls 706px of content internally. The page does not overflow at any width.

## Decisions & why

- **Headings are not `h1`–`h6`.** A reply sits under the page's own headings, and model-chosen levels would break the outline. The lead-in has 20px above it against the reply's 12px gap below, which groups it with what follows without a negative margin.
- **Every table rule has a reason.** A table needs a delimiter row with the same cell count as the header, and at least one body row. Anything less stays paragraph text, so prose like "A | B" is never a table. A line without a pipe ends the table: GFM would absorb a following sentence as a row, but model output often puts a sentence right after a table.
- **Alignment colons are accepted but ignored.** Cells stay left-aligned so the `{kind:'table', head, rows}` shape stays simple.
- **`contain: inline-size` on the wrapper.** Without it, a wide table's max-content width can grow the grid ancestors (`.layout` uses `1fr` below 1024px) and scroll the page.
- **Only words of ten or more letters hyphenate** (`hyphenate-limit-chars: 10 4 4`). At 320px, Chrome otherwise broke short words like "tax-able".
- **Rendering stays React nodes, never innerHTML.** A test confirms that `<img onerror>` in a cell comes out escaped.

## Gotchas

- Vitest runs in `environment: 'node'` with no DOM. The render tests use `renderToStaticMarkup`. CSS module class names come back empty in tests, so don't assert on them.
- The "Comparison table" region is always focusable, even when a 3-column table doesn't scroll. That keeps the markup predictable; it costs one extra tab stop per table.
- The edge shade uses the `background-attachment: local` / `scroll` pair. Table cells must stay transparent (only the sticky column has a background), or the shade disappears.

## Next steps

1. Once the backend prompt change lands, spot-check real replies. Confirm the model's tables use at most 3 columns and 6 rows, and that it has stopped sending headings.
2. Consider honouring alignment colons, e.g. right-aligning numeric columns, if replies start comparing numbers.
3. Add the advisor table case to `scripts/browser-smoke.cjs` (320px overflow assertion) so CI guards it.

## Open questions / blockers

- A follow-up request asked to show "Use a sample account" (`/plaid/sandbox-link`) on the deployed site and make it the primary action. It was **not** done on this branch: the agent's permission check blocked turning the sandbox shortcut on in production builds. @wakeensito needs to approve it directly, or make the change.
- `ChatProvider.tsx` cites "DESIGN.md §4.8" for the `/advisor/*` 2 req/s cap. §4.8 is now the reply markdown section. The cap should be documented in DESIGN.md or the comment repointed.
