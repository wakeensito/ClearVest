# ClearVest Design System

- **Status:** v2, light brokerage workspace, 2026-09-26
- **Owner:** `team:frontend`
- **Source of truth:** this file and the matching tokens in `frontend/src/styles/tokens.css` (§13).
- **Direction and brainstorm:** [Account desk design plan](docs/frontend-design-direction.md).

## 1. Visual direction

ClearVest is an investing workspace for understanding ownership, allocation and risk. It should feel
familiar to a brokerage customer: clear navigation, readable balances, precise tables and interactive
research. It has read-only account access and does not execute trades.

The previous institutional-editorial direction is superseded. Use a light canvas, white work surfaces,
SamsungOne typography and restrained blue actions. The research chart is the focal interaction. Keep
surrounding information quiet; do not add an oversized marketing headline inside the application.

## 2. Palette

| Role | Hex | Purpose |
|---|---|---|
| Canvas | `#F5F7FA` | Cool light page background |
| Paper | `#FFFFFF` | Navigation, account summary, research and tables |
| Ink | `#172B46` | Primary headings and numbers |
| Action blue | `#2457C5` | Links, focus, selected security line and primary action |
| Rule | `#DDE3EB` | Table rows and surface boundaries |
| Secondary ink | `#536176` | Explanations and labels |

The complete semantic colors are in §13. Green and red convey gains and losses, always with signs.
Risk uses neutral bands. Asset categories retain a stable mapping: equity, ETF, mutual fund, fixed
income, cryptocurrency, derivative, cash, other map to `viz-1` through `viz-8`. The price-history line
is neutral blue, with the return separately signed and colored; a line is not a recommendation.

## 3. Typography

SamsungOne is self-hosted in regular, semibold and bold from Samsung Internet's public
web-code repository at pinned revision `caf2401227497d00cf728d5ee3edcbd9972c0771`.
The unmodified font binaries, source hashes and MIT license are retained in
`frontend/public/fonts/samsungone/`. Regular and semibold are preloaded; all font requests use the
app's own origin. No local installation or external font service is needed. System fonts remain a
fallback for missing glyphs or failed font requests. Use the same font in chart labels.

| Role | Size / line height | Weight |
|---|---|---|
| Account balance | 48/60, mobile 40/50 | 500 |
| Page title | 32/40, mobile 28/36 | 600 |
| Section title | 20/28 | 600 |
| Research close | 36/48, mobile 30/48 | 500 |
| Body | 15/24, mobile 16/24 | 400 |
| Table/help text | 13/20 | 400–500 |
| Caption | 12/16 | 500 |

Use sentence case; tickers keep uppercase. No tracked uppercase eyebrows. Use tabular figures for
numbers and right-align numeric columns. Legacy `font-serif`, `font-mono` and `t-overline` aliases
remain for existing components, but resolve to the same sans family and sentence-case labels.

## 4. Components

### 4.1 Actions and fields

One primary action per task. Secondary actions use an outlined white control; tertiary links use blue.
Controls have a 6px radius. Research controls and navigation targets are at least 44px high. Fields have
visible labels, error text, and keyboard focus. Do not imply an action exists with a decorative button.

### 4.2 Work surfaces

White, 1px border, 10px radius, 24px padding (16px mobile). No decorative shadows or gradients.
Only overlays use shadow. A section heading appears once, without a repeated category eyebrow.

### 4.3 Account summary

Account value and its timestamp, followed by holdings count, largest holding and bonds/cash weight.
Use only API values or direct aggregations. No fabricated daily P&L or portfolio performance curve.
Empty holdings show an explicit empty state. Unlinked accounts use the existing Plaid flow.

### 4.4 Holdings

Search by name or ticker. Preserve sorting, tabular values and type labels. Symbol links open research.
Desktop tables stay inside their surface; mobile uses an investment list. Search only changes visible
holdings; it does not recompute the account balance or allocation.

### 4.5 Allocation

A stacked bar and a vertical legend show asset-type composition in the context column. Long-position
values are aggregated by type. If shorts exist, explain that the bar excludes them. Do not show a
percentage-based asset mix for an empty account.

### 4.6 Risk and context

Neutral risk bands, numeric score and the backend explanation. Show an advisor prompt using the
largest holding when known. Educational disclosures accompany advisor content. Economy data has a
separate error boundary, source label and observation date.

### 4.7 Security charts

Use **TradingView Lightweight Charts v5**, imported from `lightweight-charts`. The shared
`SecurityResearch` component serves Portfolio and Markets. Fetch `/market/history` with one symbol
and only supported ranges: `1y`, `5y`, `10y`. Validate ticker syntax against the backend's 12-character
rule. No mock series, random curves, smoothing or estimated account performance in application code.

Normalize dates to unique ascending observations before passing them to the chart. Ignore invalid
calendar dates, non-finite and non-positive closes. A missing symbol or empty series gets an empty
state, not another symbol’s data. Show actual available dates even when the requested range is longer.
The backend can downsample and fall back from Yahoo Finance to FMP to Alpha Vantage; do not claim
every observation is daily, unadjusted, or from one specific provider. Currency metadata is absent,
so format prices without a fabricated currency symbol. Returns use the API's fraction units.

Use a white chart background, blue 2px line, subtle area fill and quiet horizontal grid. Keep wheel
scrolling available to the page. Enable pointer/touch inspection, left/right keyboard inspection,
previous/next observation buttons and a scrollable table alternative. Remove the chart on unmount.
Disable the in-chart TradingView logo with `attributionLogo: false`. Keep the NOTICE credit and TradingView link in the application footer, as permitted by the library’s attribution option.

### 4.8 Advisor replies

Replies render a small markdown subset as React nodes, never `innerHTML` (`features/advisor/parseMarkdown.ts`,
`Markdown.tsx`): paragraphs, `-`/`*`/`•` and numbered lists, `**bold**`, headings and comparison tables.
Lists and tables may start directly after a sentence; a line without a pipe ends a table.

Headings (`#` to `######`) render as a semibold 15/24 lead-in paragraph, not an `h1`–`h6`, so a reply never
adds to the page outline. Surrounding `**` is dropped. It has 20px above and the reply's 12px gap below,
grouping it with what follows. A bare `###` stays text.

A GFM table needs a header, a delimiter row with the same cell count and at least one body row; otherwise
it stays text. Outer pipes are optional, `\|` is a literal pipe, and ragged rows are padded or truncated
to the header. It renders as a semantic table (`th scope="col"`; each row's first cell is `th scope="row"`)
on a white surface with a 1px rule border, 6px radius, 13/20 text, 8px cells and rule-coloured row
separators. The wrapper is a focusable region labelled "Comparison table" with a visible focus ring.

Phone behavior: up to three columns fit the reply at 320px with no scrolling. The layout is fixed, the
label column is 34% wide, and cells wrap. Only words of ten or more letters hyphenate. Four or more
columns scroll inside the wrapper (momentum, overscroll contained). The first column stays pinned on the
surface, and a 12px shade on the right edge hints at more content until the end is reached.
`contain: inline-size` keeps a wide table from widening the page. The advisor prompt asks for at most
three columns and six rows.

## 5. Layout and routes

Desktop: 76px navigation, slim workspace information row, centered content up to 1440px with 40px
side padding. Portfolio has an account summary above an expanding main column and a 336px context
column. Under 1024px, context stacks below; under 640px, all content uses a single column.
Mobile keeps four bottom navigation items with safe-area spacing.

| Route | Task |
|---|---|
| `/portfolio` | Account summary, security research, searchable holdings, allocation and risk |
| `/markets?symbol=VOO` | Research a selected security and inspect available closes |
| `/advisor` | Ask about holdings, with the existing profile/portfolio context |
| `/welcome` | Profile and Plaid account linking; light introduction panel |
| `/learn` | Searchable plain-language glossary and three learning paths with source links |

No sidebar full of nonfunctional trading tools. No buy/sell controls or fabricated market-open status.

## 6. Depth and motion

Surface contrast and borders establish hierarchy. Control radius 6px, work-surface radius 10px.
No global radius on every DOM element. Avoid entrance choreography and automatic chart animations.
Use existing 120/200/280ms tokens for interaction feedback; respect reduced motion.

### 6.1 Welcoming motion and landscape imagery

The portfolio welcome panel shows a greeting based on the device’s local time: “Good morning.”
from 05:00, “Good afternoon.” from 12:00, and “Good evening.” from 18:00 until 05:00.
Refresh the greeting every minute and when a hidden tab becomes visible. There is no phrase
rotation, animation, pause control, or stored greeting preference. The accessible h1 remains
“Your portfolio”.

Generated coastal and valley photographs live in `public/images` as WebP, with full prompts and
provenance in that folder’s README. Keep images separate from text, with empty alt for decorative
use and explicit dimensions to reserve layout. Do not put financial values on image backgrounds.

### Profile questions and edit actions

Use plain-language questions for time horizon and risk tolerance. Present “Under 3 years”,
“3–10 years” and “10+ years” directly as horizon choices while retaining the API values
`short`, `medium` and `long`. Radio cards include visible native controls for clear selection
and standard keyboard navigation; color and card outlines are supplementary cues.

Use 24px gaps between form fields, a 32px desktop top inset and a short introductory sentence.
Editing shows Save profile and Cancel together. Cancel discards local changes without a save
request; both actions return to the originating application page, falling back to Portfolio
for a direct visit. Disable Cancel while saving so it cannot imply cancellation of an in-flight
write. New-user onboarding keeps Continue and its profile/link progression.

### Illustrated welcome introduction

Use three original SVG spot illustrations beside the welcome panel’s explanatory bullets:
a route toward a goal, linked account records, and a conversation with a chart. Assets live
in `public/images/onboarding/`. Display at 72px on desktop and 56px on phones, with empty
alt text because adjacent copy explains each point. Use the existing navy/cobalt palette.
Remove the duplicate ClearVest label above the headline; retain the navigation wordmark.
These are unordered benefits, not a numbered progress indicator. The form keeps its actual
step indicator. The introduction follows the form on small screens.

### Advisor context panel

Present “Your investing context” as one white, bordered surface using SamsungOne. Separate
profile facts into paired labels and values, list goals as non-interactive labels, and group
portfolio value with its holdings count and risk score. Use a neutral risk track with a cobalt
position marker and numeric score; risk is not a completion target. A muted source footer names
FRED and its supplied as-of date. Keep Edit profile beside the profile heading.

The context disclosure starts expanded on desktop and collapsed below 1024px. Its native summary
supports keyboard and touch interaction. Preserve explicit loading, unavailable and unlinked
states without claiming a failed request means an account is not linked.

### 6.2 Inclusive product behavior

Offer “Understand my holdings”, “Explore investments” and “Learn the basics” as labelled actions.
No assumptions about wealth, gender, family structure, goals or expertise. Markets and Learn are
available before profile creation; portfolio and advisor setup requirements still apply. Onboarding
includes “Explore first”.

“Hide portfolio values” replaces account totals, position amounts and quantities, allocation values,
and account-specific risk text. It persists on the device; it is a portfolio-view convenience, not an
access-control boundary or a promise to hide already-existing advisor conversations. Public security
prices, ownership symbols and percentages remain visible.

Learn includes short starting paths and a searchable eight-term glossary with native disclosure
controls and Investor.gov references. No learning content depends on a connected account. Links to
the advisor prefill questions and never submit them automatically.

## 7. Product principles

Show ownership before interpretation. Put dates next to data. Distinguish a security's history from
personal returns. Keep provider failures local. Prefer an actionable empty state over a blank panel.
Keep profile, account linking and advisor workflows intact while reshaping their presentation.

## 8. Responsive and keyboard behavior

No page-level horizontal overflow at 320px. Tables may scroll within their own surface. Numeric text
must remain readable. Bottom navigation accounts for safe-area insets; sticky composers clear it.
Use visible focus, labelled controls, semantic headings/tables, and accessible chart summaries.

## 9. Light-only theme

All routes render light, regardless of system color preference or an old `cv-theme` localStorage value.
The dark token set, theme menu and pre-paint system-theme script are removed. `color-scheme: light`
applies to native controls. All component colors read the shared tokens.

## 10. Data formatting

Use one `format.ts` module for this, and never call `toFixed` directly in components. Use `Intl.NumberFormat` with the `en-US` locale.

| Kind | Rule | Example |
|---|---|---|
| Currency | 2 decimals, thousands separators | `$10,000.00` |
| Currency, compact (tables ≥ $1M, tiles) | 2 significant decimals | `$1.23M` |
| Signed change | Always signed, with a true minus `−` (U+2212) | `+$123.45`, `−2.31%` |
| Percent, weights and allocations | 1 decimal | `50.0%` |
| Percent, returns and volatility | 2 decimals | `+4.94%`, `13.20%` |
| Multiples | 1 decimal and `×` | `65.4×` |
| Quantity | Up to 4 decimals, trailing zeros dropped | `20`, `0.1234` |
| Missing value (`null`) | Em dash with a tooltip "Not available from the data provider" | `—` |
| Date | `MMM D, YYYY` | `Sep 26, 2026` |
| Timestamp | Local time | `Sep 26, 2026, 2:14 PM` |
| Ticker | Uppercase, SamsungOne medium | `VTI` |

### ⚠ Units by API field. Check before formatting.

| Field | Arrives as | Display |
|---|---|---|
| `Holding.weight`, `Template.allocations[].weight` | fraction (`0.5`) | ×100 → `50.0%` |
| `HistorySeries.returnPct`, `.volatility` | fraction (`0.0494`) | ×100 → `+4.94%` |
| `Company.grossMargin`, `.revenueGrowth` | fraction (`0.532`) | ×100 → `53.2%` |
| `Company.pe`, `.ps`, `.debtToEquity` | ratio | `95.1×`, `0.06×` |
| `Company.epsTTM`, `.fcfPerShare` | dollars | `$1.90` |
| `Macro.fedFunds`, `cpiYoY`, `unemployment`, `wageGrowth`, `tenYear` | **already percent** (`4.33`) | **do not** ×100 → `4.33%` |
| `Risk.score` | integer 0–100 | `58` with `/100` in `text-tertiary` |

---

## 11. States and API errors

Every data card handles all of these states. The API error envelope is `{error: {code, message, requestId}}`.

| Situation | Where | What the user sees |
|---|---|---|
| Loading | Card | Skeleton while loading. After 8s: "Still working. This can take up to 30 seconds." |
| `404 NOT_FOUND` on `GET /profile` | App | Not an error: go to `/welcome` |
| `409 NOT_LINKED` | Card | The card is replaced by the Link account card (§4.14): "Link an account to see your holdings." |
| `502 UPSTREAM_UNAVAILABLE` | Card | Warning banner: "Market data is temporarily unavailable." and a Retry button. Other cards are unaffected. |
| `400 VALIDATION` | Field or form | Inline error under the field. Map the API `message` to the field when possible. |
| `500 INTERNAL` | Card | "Something went wrong on our side." with Retry, plus `Reference: <requestId>` in `mono` `caption` |
| `429` throttle (API Gateway, **not** the envelope) | Composer / voice | "You're sending requests quickly. Wait a moment and try again." |
| Network failure or timeout | Card | "Can't reach ClearVest. Check your connection." with Retry |
| `stale: true` on a 200 | Card header | Stale badge: "Cached data", with the time in a tooltip. The data is still shown. |
| Empty (no holdings, no chat) | Card | One sentence explaining what will appear there, plus the next action |
| Voice: empty transcript (`400`) | Under the mic | "Didn't catch that. Try again a little closer to the mic." |
| Voice: microphone denied | Under the mic | "Microphone access is off. You can type your question instead." and a focus move to the composer |

---

## 12. Voice, copy and accessibility

**Tone:** a knowledgeable colleague explaining something over coffee. Direct, calm and specific, with
no jargon unless it's explained.

- Second person ("your portfolio"), active voice, sentence case, no exclamation marks, no emoji.
- **Say the number.** "Your largest position, VTI, is 50.0% of your portfolio," not "You're quite concentrated."
- **Explain terms on first use** with a dotted-underline tooltip: P/E, volatility, expense ratio, Roth.
- **Hedge honestly, not nervously.** Write "Consider…" or "One option is…", never "You should…" or "We recommend buying…".
- **Banned words:** guaranteed, safe, risk-free, can't lose, moon, crush, beat the market.
- **The disclaimer** comes from the API response. Fallback copy (the same as the backend):
  *"ClearVest provides educational information, not financial advice. Consider a licensed professional
  before making investment decisions."*

| Say | Not |
|---|---|
| Link account | Connect your bank / Sync |
| Holdings | Positions / Bag |
| Model portfolios | Famous portfolios / Hot picks |
| Risk score | Danger level |
| Sandbox data | Demo money / Fake |
| Retry | Oops! Try again |

### Accessibility (WCAG 2.2 AA)

- Check text contrast at 4.5:1 and control boundaries at 3:1 when changing tokens.
- Never use color alone: signs, arrows, labels and patterns carry the same meaning.
- Visible focus everywhere: a 2px `accent` ring with a 2px offset in `bg`. Never remove the `outline` without a replacement.
- Everything works with the keyboard: scrubbing the chart with ←/→, sorting tables, the chip input, and recording (Space toggles).
- Charts have a visually hidden summary ("VOO returned +4.94% over 1 year with 13.20% volatility")
  and a "View as table" toggle.
- Advisor replies and voice status changes are announced through an `aria-live="polite"` region.
- Respect `prefers-reduced-motion` (§6) and 200% browser zoom without horizontal scrolling.

---

## 13. Implementation: tokens

The token test requires this block to match `tokens.css` exactly.

```css
:root {
  /* neutrals */
  --cv-bg: #F5F7FA;            --cv-surface: #FFFFFF;
  --cv-surface-raised: #FFFFFF; --cv-surface-sunken: #F0F3F7;
  --cv-border: #DDE3EB;        --cv-border-strong: #C3CDD9;  --cv-border-input: #7C8799;
  --cv-text: #172B46;          --cv-text-secondary: #536176;  --cv-text-tertiary: #617086;
  /* accent — Clear Cobalt */
  --cv-accent: #2457C5;        --cv-accent-hover: #2343B8;    --cv-accent-pressed: #1C379A;
  --cv-accent-subtle: #EDF3FF; --cv-on-accent: #FFFFFF;
  /* semantic */
  --cv-gain: #0A7D3E;  --cv-gain-subtle: #E6F4EC;
  --cv-loss: #C8302B;  --cv-loss-subtle: #FBEAE9;
  --cv-warning: #8A5A00; --cv-warning-subtle: #FFF4D6;
  /* data viz (fixed asset-type mapping, see §2.5) */
  --cv-viz-1: #2457C5; --cv-viz-2: #7A5AF8; --cv-viz-3: #0F8B8D; --cv-viz-4: #B7791F;
  --cv-viz-5: #C2418A; --cv-viz-6: #475569; --cv-viz-7: #7C8799; --cv-viz-8: #8C7A6B;
  /* shape, depth, motion */
  --cv-radius: 6px;
  --cv-radius-panel: 10px;
  --cv-shadow-overlay: 0 8px 24px rgba(14,17,22,.12), 0 2px 6px rgba(14,17,22,.08);
  --cv-ease: cubic-bezier(0.2, 0, 0, 1);
  --cv-motion-fast: 120ms; --cv-motion-base: 200ms; --cv-motion-slow: 280ms;
  /* type */
  --cv-font-sans: "SamsungOne", system-ui, -apple-system, "Segoe UI", sans-serif;
  --cv-font-serif: var(--cv-font-sans);
  --cv-font-mono: var(--cv-font-sans);
  color-scheme: light;
}

body {
  background: var(--cv-bg);
  color: var(--cv-text);
  font: 400 15px/24px var(--cv-font-sans);
  -webkit-font-smoothing: antialiased;
}
.num, td, [data-numeric] { font-variant-numeric: lining-nums tabular-nums; }
```

## 14. Brand and assets

The shared app footer is a full-width navy band (`text`, #172B46), inspired by the reference’s
spacious dark brand sign-off. The ClearVest wordmark sits left and “Clarity for every investor.”
sits right in white SamsungOne semibold. A restrained divider separates the brand row from existing
educational disclosures and TradingView attribution. Content aligns with the 1440px app grid.
On mobile, brand and tagline stack left, and the footer clears the fixed tabs and safe-area inset.
White focus outlines keep footer links visible. This branded surface does not change the light theme.

The compact ClearVest mark uses an open C with a check-shaped rising stroke. Keep it a quiet navigation
anchor; no decorative finance illustrations are necessary. Favicon is the same mark on action blue.
TradingView Lightweight Charts™ — Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/

## 15. Adding a surface

Use typed API methods and TanStack Query. Keep data failures scoped with QueryView, and number
formatting in `lib/format.ts`. Use CSS Modules and the shared tokens. Read the latest frontend handoff.
Add a new handoff in the same PR; never rewrite the previous author's handoff.

## 16. Next product work

See the design plan for prioritized ideas: benchmark comparison; account grouping; contributions,
fees and true portfolio performance once the backend supplies them; goal progress with explicit
assumptions. SamsungOne font assets are bundled with the app. Do not invent unavailable data to fill a UI.

## 17. Agent brief

Build a light classic brokerage workspace with SamsungOne typography, precise account figures,
readable tables and TradingView Lightweight Charts. White surfaces on cool grey, navy text, blue
controls. A calm landscape welcome panel introduces the workspace; Learn uses a matching valley image. Keep explanations plain. No serif hero, dark mode, repeated eyebrows or decorative cards.
Preserve API contracts, correct units, empty/loading/stale/error states and existing account workflows.
