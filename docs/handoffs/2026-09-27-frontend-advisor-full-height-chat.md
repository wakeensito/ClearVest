# Advisor chat fills the screen, no footer

- **Date:** 2026-09-27
- **Author:** Claude Code, working with @Mario-Recondo
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** `feat/advisor-full-height-chat`
- **Follows:** [Square advisor tabs](2026-09-27-frontend-square-advisor-tabs.md)

## What changed

- `/advisor` no longer shows the site footer.
- While the Scout conversation is open, the page is exactly one screen tall: only the thread scrolls, and the composer sits at the bottom of the screen like a chat app (ChatGPT style).
- On phones the composer now sits above the bottom tab bar. Before this, it was hidden behind the tab bar and the thread was only ~240px tall.
- On phones (<=767px) the "Your investing context" rail is hidden while chatting. It still shows on the What I own / Risk check / Research tabs.
- The tool tabs are unchanged: the page scrolls normally there.

## How to run / verify it

```bash
cd frontend
npm run dev            # or: VITE_API_BASE_URL=http://127.0.0.1:4010 npx vite (with npm run mock)
# open /advisor at a phone width (375, 390, 412) and at 1440x900
# document should not scroll; send a few messages; the composer stays at the bottom above the tab bar
npm run lint && npx tsc -b && npm test
```

## Decisions & why

- **CSS only, driven by one attribute.** `AdvisorPage` puts `data-fill` on its root while the chat is showing. `AppShell.module.css` uses `.shell[data-advisor='true']:has([data-fill])` to lock the shell to `100dvh`, and `AdvisorPage.module.css` makes the layout, main column and chat flex to fill it. No new JS, and the thread keeps its existing auto-scroll.
- **Only lock the height while chatting.** Tool views (ownership, risk check, research) are long and need normal page scroll.
- **Hide the rail on phones while chatting.** At 375px it took ~100px of a ~550px screen. On tablets (768–1023px) it stays on top, collapsed, capped at `40dvh` with its own scroll.
- **Footer disclaimer.** The footer's "educational, not financial advice" line is gone on this page, but the chat's own disclaimer still shows under the composer.

## Gotchas

- Uses CSS `:has()` (Safari 15.4+, Chrome 105+, Firefox 121+).
- The mobile bottom padding (`64px + safe-area + 8px`) has to match the tab bar height in `AppShell.module.css`. If the tab bar changes, change it too.
- The iPhone SE (375x560 visible) is tight: about 160px of thread with a reply showing. It's usable, but it's the smallest case.
- Landscape phones (`max-height: 500px`) also hide the page heading and the rail while chatting. That gives 145px of thread at 844x390, up from 52px. An iPhone SE in landscape (667x375) still only gets ~78px because the bottom tab bar stays on screen.
- On tool tabs on phones, `.main` has extra bottom padding (tab bar + 24px). The hidden footer used to provide that space, and without it the disclaimer sat behind the tab bar.
- A mobile QA pass with the viewport shrunk to 350px (a rough soft-keyboard stand-in) crushed the thread to ~44px and put the tab bar over the composer. iOS Safari and Chrome 108+ normally don't shrink the layout viewport when the keyboard opens, so this isn't confirmed on a device.

## Next steps

1. Check on a real iPhone and Android phone with the keyboard open. If the tab bar covers the composer, hide it while `#advisor-input` has focus: `@media (max-width:767px){.shell:has(#advisor-input:focus) .tabbar{display:none}}`.
2. If the SE size feels cramped, shrink the page heading ("Ask about your money" + Scout) while chatting on phones.

## Open questions / blockers

- None.
