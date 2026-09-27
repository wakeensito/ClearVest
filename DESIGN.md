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
percentage-based asset mix for an empty account. The rail card is titled “Your plan vs. today” (§4.14);
this by-type bar sits under it as “By investment type”, the detail behind the plan comparison.

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

### 4.8 Visual company comparison

Markets comparison starts with removable company chips, an add-ticker field and optional industry
pairs. Accept 2–4 distinct tickers; adding/removing a chip does not request data. Compare and the
explicit pair buttons fetch the selected set. Keep the selected draft separate from the displayed
response, and explain when results belong to an earlier selection.

Default to a visual comparison grouped into Valuation, Growth & profitability, and Financial
strength. Give each company a consistent color from `viz-1` through `viz-4`, always paired with its
ticker and exact value. Each metric uses a separate zero-based scale; if any value is negative,
center the zero and draw negative values to its left. Missing values have no bar, and all-zero values
have zero length. Bar length is not a rating. Preserve a Data table view for all seven metrics.

Use the existing `/market/compare-companies` contract and nullable metrics. Margin and growth are
fractions, multiples are ratios, and per-share figures follow §10. Reporting periods and per-field
sources are absent; retain source notes and local retrieval time in a compact expandable explanation.

Downloads are a small header disclosure with CSV and JSON actions, not a separate work surface.
Export the displayed response even if the draft has changed, disabling export during fetching or
without a successful nonempty result. Preserve raw precision, explicit units, source notes and
retrieval time; fractions stay fractions in files. CSV missing cells are blank and JSON nulls remain
null. Escape and neutralize formula-like CSV strings. Export happens entirely in the browser.

### 4.9 Compact market lists and research workspace

Market overview and Compare companies use clearly bordered, filled buttons. Overview starts with the
learner's watchlist (non-guided only; `components/market/Watchlist.tsx`, store `lib/watchlist.ts`):
starred symbols, newest first, at most 20, per demo user on this device. Each row is the symbol (links to
`/markets?symbol=X`), the name only if the page already cached it (else `—`, never a per-row fetch), the
signed 1-year return as a gain/loss `Badge`, and a 44px remove `×`. Returns come from `/market/history`
in chunks of five symbols; a pending refresh shows `Dots`. Empty: one sentence and a link to VOO. The
Watch/Watching star toggle (`aria-pressed`) sits beside the fund identity line in Security research.

Trading activity is demoted: below the research workspace, a collapsed `<details>` “Market activity:
most active, gainers and losers” mounts the board (and its `/market/movers` calls) only once opened.
Inside it, two compact surfaces sit side by side. Top 10 most active has ten ranked rows in a 300px scroll region, showing
five 60px rows at once. The second surface switches between Top gainers and Top losers in place; only
the selected list loads. Both support keyboard scrolling, signed daily moves and cached/empty/error
states. Company symbols have FMP logo images, falling back to labelled initials when unavailable.

The user chose trading activity as the Top 10 definition, not a best-investment score. Active order
comes from FMP; gainers/losers sort by daily percentage change. `/market/movers` caches each list for
one hour. Retain retrieval time and delayed-data context. Do not invent volume or quote timestamps.

The primary Security research surface spans the full width below the compact lists. Board ticker
selection scrolls to it and focuses its search. Show closing price, available-history return,
annualized volatility, actual observation count, chart/table inspection and supported time ranges.

Compare securities opens a native full-screen dialog with two independent research panels. The
second starts empty until a ticker is submitted. Each has its own query, input, time range and local
error/retry state. A 280ms inward transition fills the workspace with the two panels; disable it for
reduced motion. Below 850px the panels stack. Use native modal focus containment, Escape/Exit
comparison, restore trigger focus and lock background scrolling. Keep Exit available in a sticky
header. Explain that the chart scales and available periods can differ.

### 4.10 Related market news

Place a prominent Market news surface below research, both on the overview and in the comparison
dialog. A lead story and supporting headlines link directly to their publishers, with publication
dates, publisher attribution and optional provider images. Never synthesize headlines or claim that
an article caused a price movement. Missing images have a neutral newspaper fallback.

`/market/news` returns up to six cached headlines, optionally filtered to one or two researched
symbols. Related news follows submitted tickers, not input drafts. The Market-wide control requests
broader stock headlines; an empty related response automatically falls back to that feed with an
explicit explanation. Preserve loading, stale, empty and retry states. Render only web URLs validated
by the backend; do not render publisher HTML. The provider timestamp has no guaranteed timezone, so
show its calendar date and distinguish that from our retrieval time. News is cached for one hour.

### 4.11 Guided company research and beginner home

The default route is a small interactive explanation of a share, using a clearly fictional business
with 100 equal shares. It offers an optional knowledge check and paths into Learn, research and
portfolio context. A primary action under the headline starts (or resumes) the starter lessons, so
there is a clear first step above the fold on phones. A correct answer to the share check reveals
“So how do investors spot sturdier companies?”: four clues from the financial statements (revenue,
net income, debt, P/E), a caution that clues never guarantee a price won’t drop, a primary link to
guided research on Apple, an “Ask the professor to explain” advisor prefill, and a “Next: <lesson>”
link into the first unfinished lesson. The three path links end with a visible
action label and arrow so they read as links. One “Your progress” panel shows both starter-lesson
progress (count and meter) and the three research milestones (“Understand a share”, “Tell sales
from profit”, “Understand how a stock is priced”), stored separately on this browser and scoped to
the demo user ID. They award no points for trades, investment returns or daily streaks. Home resumes
the first unfinished lesson once a lesson has been completed.

`guided=1` on Markets hides movers and introduces a company through three explicit steps: its
business, annual sales/profit, and valuation. The chart opens on request. The normal market overview
retains the compact lists and chart, followed by the financial guide and related news. Full-screen
comparison gives each selected security its own chart and independent financial guide.

Annual statements contain up to five fiscal years of revenue, direct costs, gross profit, operating
income, net income and diluted EPS. Dates and reported currency appear alongside values. Revenue
growth requires consecutive fiscal years in the same known currency and positive prior revenue.
Chart bars share a zero baseline and scale; losses extend below zero. Tables scroll within their own
labelled region on small screens, with full amounts and per-share labels. Missing values are not zero.

P/E uses the provider's trailing ratio, never a current price divided by a mismatched annual EPS.
Zero/negative earnings or P/E are not shown as meaningful valuation. Historical context is the median
of at least three positive annual observations; show sample count and dates and explain exclusions.
It is neither an industry average nor a target. Funds get a separate explanation because operating
company statements are not a suitable way to explain fund holdings. Comparisons no longer assume USD
when the original comparison contract omits currency.

`/market/company-research` caches profile, income, current ratios and historical ratios independently
for one day. A section failure preserves other sections and exposes a retry. Each source keeps its
original retrieval timestamp through a stale fallback. `/market/search` supports names and tickers.
One search box (`SymbolSearch`) takes both: from two characters it suggests up to eight matches after a
300 ms pause (in-flow listbox, name truncated, never blocks Enter); a ticker-shaped entry goes straight to
the chart unless the suggestions say otherwise (`lib/searchBox.ts`). Browser demonstrations use contract fixtures, not live entitlement.

Explanations use everyday language, disclose details only when needed, and include local feedback on
sales versus profit and on interpreting P/E. Contextual disclosures also explain charts, portfolios,
comparisons and headlines. Advisor instructions answer one idea first and define unfamiliar terms.
General questions remain useful without asking for age or brokerage details. Linked questions remain
in the URL until submitted so optional profile editing can return to them.

### 4.12 Advisor replies

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

### 4.13 Fund explainer ("What is this?")

For a beginner who just linked an account and owns VOO without knowing what it is. One glance answers
"what is this thing I own?"; more is one tap away; one tap returns to the plain search. It is inline:
no new page, tab or modal. Data comes from `GET /market/fund` (`api.getFund`, `useFund`, one-day
`staleTime`); rules live in `lib/fundExplainer.ts`, views in `components/market/FundExplainer.tsx`.
Deeper learning: see #44.

**Identity line.** Directly under the ticker search: “VOO · Index fund (ETF)” and, only when `tracks`
is set, “Tracks the Standard & Poor's 500 Index”, plus an outlined “What is this?” button (44px,
`aria-expanded`). Kind labels: index ETF “Index fund (ETF)”, ETF “ETF”, index mutual fund “Index fund
(mutual fund)”, mutual fund “Mutual fund”, stock “Company stock”, index “Stock market index”, crypto
“Cryptocurrency”, anything else “Investment”. `leveraged` wins over all of these: “Leveraged ETF · high
risk”, with “high risk” in semibold `loss` (the words carry the meaning; color only reinforces it). A
leveraged fund never gets index-fund copy, even when the provider says it tracks an index. Loading
shows a quiet, `aria-hidden` two-line skeleton; an error removes the line. Fund data never blocks or
replaces the chart. Closed, nothing else is added to the research card.

**Open explainer.** Opens directly below the identity line and pushes the chart down. A sticky bar
(“VOO explained” + Done) sits under the app top bar. Three items stay visible, each at most two lines at
375px: (1) What is it? — the first sentence of the API `summary`; (2) What's inside? — the dollar strip
and “Of every $1: 8¢ NVIDIA · 7¢ Apple · 6¢ Microsoft + hundreds more” (“+ hundreds more” for a plain
index fund, “+ more” otherwise; the API has no holdings count); (3) What does it cost? — “About $3 a
year on every $10,000 invested · expense ratio 0.03%” (ratio × 10,000, whole dollars; “Under $1” below
$0.50; “No yearly fee” at 0; “Fee information isn't available.” when null). Stocks show step 1 only,
unnumbered, with “See what this company earns →”, which scrolls to and focuses `[data-company-financials]`
(or opens Markets, where that section exists). An index shows step 1 and “You can't buy an index
directly; index funds like VOO copy it.” with “Research VOO →”, which switches the panel's ticker.
Crypto and “other” show step 1 only. A 12px data line gives the as-of date, “saved copy” when stale, and “Summary written
by AI” when `summarySource` is `model`. Measured at 375px: 528px tall, 672px with a chip answer open.

**Dollar strip (signature).** One 32px bar is $1. Up to ten holdings are slices proportional to weight,
largest first, with 2px surface gaps; the rest is “Everything else” on `surface-sunken` (labelled only
when it is at least 35% wide). Slices are a sequential accent ramp: `accent`, then 72%, 50% and (holdings
4–10) 24% mixes with `surface`. The viz scale is not used: `viz-1..8` mean asset categories, and every
slice here is the same category. Matching 8px swatches precede the three named cents. The strip is
`aria-hidden`; the sentence carries the meaning. Cents round to whole cents; below half a cent reads “<1¢”.
Weights summing past 1 are scaled to exactly $1; invalid weights are dropped. No holdings: “Holdings
information isn't available for this fund right now.” Names drop corporate suffixes (“Apple Inc” →
“Apple”) but keep share classes.

**Keep learning chips.** One row of outlined question chips (44px, no icons), scrolling inside itself
rather than wrapping; while chips are offscreen the row's right edge fades out (`mask-image`, toggled
by a scroll listener and a ResizeObserver), so phone users can tell it scrolls. Who runs it? (needs `fundFamily`), Where is the money? (a static plain-word map of
`category`, or of `sector` for stocks; an unknown value skips the chip, never shows raw jargon), Why own
it? (index fund: a slice of hundreds of companies, low fees; leveraged: “It borrows to multiply daily
moves, so losses can grow fast; it's built for short-term traders, not long-term saving.”; crypto: “No
company or earnings are behind it, so prices can swing a lot.”; bond funds say “investments”, not
“companies”), How do I buy it?, and last, ETF or mutual fund?. Indexes and “other” get no chips. One answer at a time, at most two sentences, on a
sunken band with an accent rule; tapping another chip swaps it. Each answer ends with “Next: <question>
→”; the last ends with “Ask the advisor about VOO →” (`/advisor?q=`, prefilled, never submitted).

**Comparison hook.** The last chip opens a static table: Index fund | ETF | Mutual fund, with rows What
it is / How you buy it / When the price updates / Typical fees / Minimum to start. Generalities only, no
fund names or figures; it says an index fund can be either an ETF or a mutual fund. Each row topic is a
full-width `th scope="rowgroup"`, so the three answer columns keep the full width and wrap whole words at
320px (hyphenating words of seven or more letters). Styling follows §4.12: fixed layout, 13/20 text,
rule borders, a focusable region labelled “Comparison table”. On phones the table spans the answer band.

**Sync and back.** Open state is `explain=1` in the URL beside `symbol`. Writers (the explainer and
`MarketsPage.selectSymbol`/`switchView`) build from `window.location.search`, not the render's params,
so a param set in the same frame is never dropped. Opening pushes a history entry, so
the phone Back button closes it. Done pops that entry, or replaces the URL when a symbol change happened
in between, and returns focus to the search input. Escape inside the explainer does the same. Changing
the ticker keeps the explainer open and loads the new security: the learner is already in “explain” mode
and comparing what two tickers are is the natural next step. Opening moves focus to the “VOO explained”
heading.

**Compare securities.** The full-screen comparison has no URL-synced explainer. Under each chart a
compact explainer shows the identity, the three items and the chips (collapsed); it renders nothing on
error. Above the two columns, once both sides load, “What's the real difference?” gives at most three
sentences from data. Two funds: top-holding overlap (a holding matches on its symbol, with “.” read as
“-”, or on its normalized name; “the same”, “almost the same”, “share N of their top M” or “different”),
same index, how you buy them, and fees in dollars; a missing fee reads “Fee information isn't available
for X.” A fund and a stock: “VOO is a basket of hundreds of companies; AAPL is one of them (about 7¢ of
every $1 in VOO)”, or “a single company”. A leveraged side is never a basket: “TQQQ is a leveraged ETF, a
very different kind of product than VOO.” plus the leveraged why. Two stocks: one sentence and an “Open
Compare companies” button that closes the dialog through its own close, selects both tickers in Compare
companies, switches the view and focuses that tab. Indexes, crypto and “other” get no strip.

**Phone and a11y.** No page overflow at 320, 375 or 393px (`npm run test:fund-explainer -w frontend`).
All targets are 44px. The explainer is a labelled `section`; the chips are a labelled group with
`aria-expanded`/`aria-controls`; answers are in a polite live region. No new colors, badges or
illustrations beyond the strip.

### 4.14 What you really own and your plan vs. today

The two portfolio moments: who the money is really in once funds are opened up, and how the mix
compares with a model plan. Math lives in `lib/portfolioXray.ts` and `lib/targetMix.ts`; every sentence in
`lib/xrayCopy.ts`; fund facts come from `lib/useFundMap.ts` (the same `['fund', SYMBOL]` query and
one-day cache as `useFund`, `retry: 1`, at most the 8 largest funds; a failed fund is simply
missing). Only shown when an account is linked.

**What you really own** (`components/portfolio/OwnershipXray.tsx`, `section#xray`, the first thing in the
Portfolio main column, above Security research; Holdings stays below research). The pitch opens here. A 13px secondary heading, then one static `t-body-sm` secondary line, “Funds are baskets of companies, so
the same company can sit in several of your funds.” (in every state except “no stocks or funds”), then the headline sentence at 20/28 medium (18/26 on
phones): “Apple is about 20% of your money: 14% directly, 6% inside VOO, QQQ and VGT.” Whole percents;
the fund part is the rounded total minus the rounded direct part, so the two parts add up on screen;
“all of it inside VOO and QQQ.” with nothing direct, “all of it held directly.” with no fund in a
stock-only account, “held directly (none in your funds' top 10 holdings).” when the account holds funds
(only once every fund was looked inside; otherwise “…, held directly (we couldn't look inside 1 of your funds).”, or
“still looking inside” while one loads); a sliver
reads “under 1%”, never “0%”. Share classes are one company: GOOG folds into GOOGL and BRK-B into
BRK-A (the `company()` map in `lib/lookthrough.ts`, used by `lib/portfolioXray.ts`). Five company rows follow, each stacked at every width: name, symbol in
12px tertiary, share right-aligned at 1 decimal; a full-width 8px track; then a 12px tertiary line
“14% direct · VOO 3% · QQQ 2% · VGT 1%” (parts under 0.5% dropped). The track fills to share ÷ top
share, solid `accent` for the direct part and the 50% `accent`/`surface` ramp step (§4.13) for the part held through
funds. It is `aria-hidden`; the via line says the same thing. Every row is one category, so the accent
ramp is used, never `viz-1..8` (§4.13 rationale). Then “Your top 7 companies are 47% of everything.”
(fewer when fewer exist; nothing for one), and the 12px data line “Counting each fund's top 10 holdings
(3 of 3 funds checked) · as of Sep 26, 2026”, plus “ · funds' smaller holdings aren't counted” when
under half the fund money is covered by those top holdings. Stock-only accounts read “Based on your
holdings as of …”.

**What it costs** (inside the same card, under a rule, `t-h3` heading). “Your funds cost about $13 a
year (0.08% of the money in them).” / the same rate per $10,000 via `feePerTenThousand`: “That's about
$8 a year on every $10,000.” (“Under $1 a year on every $10,000.”; none without a rate; kept when
values are hidden, since it is a rate, not the client's dollars) / “At the same balance that's about $130 over 10 years.” / only
when it saves at least $1: “If every fund cost what your cheapest one does (0.03%), it would be about $5
a year.” A three-column table (Fund, Expense ratio, Per year; symbol, `expenseRatioLabel`, full
currency). While any requested fund is loading, the panel shows only “Adding up fees…” with `Dots`, so a
loading fund never reads as missing or undercounts the total. Settled: a fund that loaded with no ratio
or whose request failed reads “Fee not available: XYZ”; a fund never requested (past the 8-fund cap,
or not a valid ticker) reads “Not checked: XYZ”; when either exists the lead says “The funds we could
check cost …”. None known: “Fee information isn't available for your funds.”; zero cost: “… charge no
yearly fee.”; no funds: no panel. No fund is ever recommended.

**Plan vs. today** (`components/portfolio/PlanVsActual.tsx`, `[data-plan-vs-actual]`, in the rail card
“Your plan vs. today”, above “By investment type” §4.5). A labelled native `select` “Compare with” (44px,
6px radius, `border-input`) lists `/market/templates` names; the default is `suggestTemplate(profile)`,
the pick lives in component state only. Beside the label: `Badge` “Suggested for you” (accent tone)
when the pick is the suggestion, “Pick a plan” (neutral) with no profile. Under the select, a
`t-body-sm` secondary line: “Picked from your answers (age, time horizon, risk comfort). A starting
point, not advice.” when the pick is the suggestion; with no profile (404), “Answer three questions in your
investment profile to get a suggested plan.” (any other profile error: the default plan, no line) (“investment profile” links to `/welcome?edit=1`). Two `aria-hidden` 12px bars,
“Today” and the plan name, slices in stocks/bonds/cash/other order coloured as their asset category
(stocks `viz-1`, bonds `viz-4`, cash `viz-7`, other `viz-8`), then a small table: kind, Today, Plan at
1 decimal. Under a rule, the lead sentence from `drift()`, which always says both whole percents, never
a bare “N points” gap. When the biggest gap (3+ points) is bonds or cash that the account holds none of
while the plan keeps 10%+, it leads with that: “Nothing in bonds, where the Classic 60/40 plan keeps
40%. Stocks: 94% today vs 60% in the plan.” (the second sentence only when an over-gap of 3+ points
exists). Otherwise the largest over-gap leads, else the largest under-gap: “Stocks: 94% today vs 60% in
the Classic 60/40 plan; nothing in bonds.” / “Stocks: 54% today vs 90% in the Buffett 90/10 plan.”; the
“; nothing in cash” tail never repeats the lead class. While any fund is loading, failed or was never
checked (it is assumed to hold stocks, so it might really be a bond fund), neither “Nothing in” form is
said; only the “Stocks: 94% today vs 60% in the … plan.” comparison. The template tickers (VTI, BND,
SHV, …) are classed from a static map first, before any fund facts; otherwise a fund's category decides
(“bond/treasury/fixed income/municipal/aggregate” is bonds; “Derivative Income” or “Equity Income” stays
stocks). All gaps under 3 read “Your mix is close to the …
plan.” Then the plan description in tertiary and “Ask the advisor why this matters →”, a prefilled,
never-sent `/advisor?q=` in the first person (“My mix has stocks at 94% today vs 60% in the … plan.” /
“My mix has nothing in …” / “My mix is close to …”). While funds
load or fail: “2 of 3 funds checked · assumes unchecked funds hold stocks”.

**States.** Holdings loading: the `#xray` surface with a skeleton. Funds all loading: skeleton;
partial: render, `Dots` beside the heading, “N of M” in the data line. Every fund lookup failed (or
came back without holdings): one sentence, “We couldn't look inside your funds right now.”, and a Retry
button that refetches the failed fund queries, instead of a headline and rows. No stocks or funds (a
cash- or bond-only account): “This account has no stocks or funds to look inside.” The card never
tells a linked account to link one. `useFundMap` exposes `pending`, `unchecked` and `failed` symbol
lists beside the map; its `total` and lookThrough's `fundsTotal` both count distinct symbols. Plan card: profile or templates loading shows
a skeleton; templates error shows only the Today bar and its percents; an empty account shows “Your mix
will appear here once the account holds investments.” Hide portfolio values replaces every dollar
figure (sentences drop the dollar clause, table cells read “Hidden”) and keeps every percent (§6.2).

**Phone.** Single column, no overflow at 320/375/393px; long names wrap (`overflow-wrap: anywhere`),
the fee table is fixed-layout within the card, the plan name on its bar truncates with an ellipsis
(the select and legend still carry it in full).

### 4.15 What-if ("What would this do to my portfolio?")

The ticker-page moment: before anyone adds money to a security, show what it would do to the account
they already have. Math lives in `lib/whatIf.ts` (a hypothetical "holdings after" fed to `lookThrough()`
and the `riskScore()` port of `risk.py`; nothing is sold, every weight renormalizes); copy and the
amount rules in `lib/whatIfCopy.ts`; the view is `components/market/WhatIfCard.tsx`
(`[data-what-if="NVDA"]`). Fund facts come from `useFundMap` (§4.14), so the portfolio cards and this
one share one request per fund.

**Where.** Inside the research card, under the identity row (§4.13); an open explainer keeps its
place directly under the identity line and pushes this card down. Only when `explainable`, the
fund lookup succeeded, holdings loaded (linked) and the kind can be bought: stock, ETF, mutual fund or
crypto. Never for an index or “other”, never in Compare securities.

**Card.** The explainer's inner surface: white, 1px rule, 10px radius, 16px padding. A 13px secondary
heading “What would this do to my portfolio?”. An amount row: `SegmentedControl` “Amount to add”
$500 / $1,000 / $5,000 (default $1,000), then “Other amount”, a 44px `$`-prefixed text box
(`inputMode="decimal"`, accepts “2,500”, “$2,500”, “12.50”) that overrides the segment while it holds a
valid amount (no segment pressed); a preset tap clears it. Outside $1–$1,000,000: “Enter an amount from
$1 to $1,000,000. Showing $1,000.” in the field-error style, and the figures keep the preset. Component
state only, no URL state.

**The sentence is the answer.** At 17/26 medium (16/24 on phones), in a polite live region:
“Adding $1,000 of NVDA: NVDA would be about 21% of your money instead of 17% (counting your funds' top
10 holdings), and your risk score would go from 34 to 35 out of 100 (Moderate).” Starting from 0% in an
account with funds: “ORCL would be about 9% of your money instead of none we can see today”; with no
funds, where nothing is unseen: “… instead of none today”. The risk label is repeated on both sides
only when it changes (“from 34 (Moderate) to 68 (Aggressive) out of 100”). Whole percents; a sliver
reads “under 1%” (“would be under 1% of your money”), never “0%”. For a stock or crypto the exposure is its look-through company share; for
an ETF or mutual fund it is the fund's own share of the account. “(counting your funds' top 10
holdings)” appears only when the account holds funds and a company (a stock) is being added; a fund's
own share, or a stock-only account, is exact. Share classes count as one company (GOOG is GOOGL, §4.14).

**A lower bound.** Funds are looked through their top 10 holdings only (§4.14), so the exposure figure
never counts a company sitting deeper in a fund, and the copy never claims it does. A company outside
the look-through's top 10 companies counts its direct weight. The figure can jump when a company enters
a fund's top 10 on the “after” side (adding a fund brings its top holdings in with it).

**Figures.** Two compact before → after pairs, side by side on desktop, stacked on phones, as a `dl`:
“Risk score 34 → 35” with the band label in 12px tertiary (“Moderate → Aggressive” when it crosses), over
the risk card's three neutral bands (§4.6) with a short `text-secondary` tick for today, a tall `accent`
tick for after, and a 2px `accent` line between them for the move; and “NVDA's share of your money
17% → 21%” (the before side reads “none” at 0%, matching the sentence) over an
8px sunken track out of the whole account: solid `accent` for today, a 45% `accent`/`surface` mix for the
added part (the §4.13 ramp; never `viz-1..8`, never green or red). Both drawings are `aria-hidden`; the
sentence and the numbers carry them. When the biggest single look-through company changes: “NVDA would
become your biggest single company.” (13px medium).

**Data line.** 12px tertiary: “Counting each fund's top 10 holdings (3 of 3 funds checked).
Educational, not a recommendation.” A fund being added is looked inside too and joins the count; an
account with no funds reads “Based on your holdings. Educational, not a recommendation.” No buy
button, no link to a broker, no “you should”.

**States.** Anything loading (fund, holdings, profile, the account's first fund) renders nothing, never
a skeleton, so the research header never jumps or waits. Not linked (409), for an addable kind whose
fund loaded: one 13px medium line, a `Link` to `/portfolio` with a 44px target, “Link an account, or
try the sample one, to see what adding NVDA would do to your mix →” — on Markets only; the portfolio
page passes `invite={false}` (it already shows the link card, and the line would link to itself). Any
other error, an empty account, an index: nothing. No saved profile (404) scores without
one, like the backend. Funds still arriving after the first: render with “N of M”. Every fund failed or
never checked: render anyway, and the data line says so (“0 of 3 funds checked”).

**Phone.** No overflow at 320/375/393px; the presets keep one row and the amount box takes the next
full row below 640px. Measured at 375px: about 570px tall with the biggest-company line, 530px at 393px.

## 5. Layout and routes

Desktop: 76px navigation, slim workspace information row, centered content up to 1440px with 40px
side padding. Portfolio has an account summary above an expanding main column and a 336px context
column. Under 1024px, context stacks below; under 640px, all content uses a single column.
Mobile keeps five bottom navigation items with safe-area spacing: Home, Portfolio, Advisor, Markets and Learn.

| Route | Task |
|---|---|
| `/` | Start-lesson action, an interactive first idea that leads into lesson 1, links into Learn/research, and one combined progress panel; no setup required |
| `/portfolio` | Account summary, security research, searchable holdings, allocation and risk |
| `/markets?symbol=VOO` | Compact discovery lists, full-width research, dual-chart comparison and related news |
| `/markets?symbol=VOO&explain=1` | The same, with the fund explainer open under the identity line (§4.13); `explain=1` also works on `/portfolio` |
| `/markets?view=companies` | Build a visual company comparison, inspect exact values and export |
| `/markets?symbol=AAPL&guided=1` | Guided company research, with optional price chart and company-name lookup |
| `/advisor` | General questions without setup; optional saved profile/holdings provide more context |
| `/welcome` | Profile and Plaid account linking; light introduction panel |
| `/learn` | Beginner starter path (units and lessons), common questions, growth illustration, glossary with flashcards |
| `/learn/:lessonId` | One short lesson: idea cards, a two-question quick check, completion and next step |

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
No assumptions about wealth, gender, family structure, goals or expertise. All main routes are available
before profile creation. General advisor questions do not require a profile or linked account. Onboarding
is optional and includes “Explore first”, returning to the beginner home.

“Hide portfolio values” replaces account totals, position amounts and quantities, allocation values,
and account-specific risk text. It persists on the device; it is a portfolio-view convenience, not an
access-control boundary or a promise to hide already-existing advisor conversations. Public security
prices, ownership symbols and percentages remain visible.

Learn is written for people who have never invested. It has a four-unit starter path of short
lessons (three idea cards, then a two-question quick check with immediate right/wrong feedback and
an explanation), “Questions beginners ask” as native disclosures, a hypothetical compound-growth
illustration, and a searchable glossary with a flashcard mode. Lessons are never locked; the next
unfinished one is marked “Up next”. Completed lessons are stored in this browser (`cv-learn-progress`), with a session fallback when
storage is blocked. Reset requires a confirmation and leaves research milestones alone. Streak
metadata stays compatible with earlier storage but is not shown; the interface celebrates completion
at the learner’s pace. The growth illustration always states that its rate
is hypothetical and constant, and that real returns vary and can be negative. Retirement limits
match `src/advisor/advisor/data/retirement_accounts.json`. No learning content depends on a
connected account. Links to the advisor prefill questions and never submit them automatically.

The next unit is expanded initially; other units, extra FAQs and the growth illustration open on
request. The glossary starts with six terms and offers all terms plus search and flashcards. Home
resumes the next lesson; the stocks lesson links to guided company research and fund research links
to the fund lesson. Keep long lesson actions wrapping at 320px and retain focus when changing cards.

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

Use `format.ts` for shared display rules and `researchEducation.ts` for financial amounts with an explicit reported currency. Never call `toFixed` directly in components. Use `Intl.NumberFormat` with the `en-US` locale.

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
| `MarketStock.changePct` | fraction (`0.025`) | ×100 → `+2.50%` |
| `Company.grossMargin`, `.revenueGrowth` | fraction (`0.532`) | ×100 → `53.2%` |
| `Company.pe`, `.ps`, `.debtToEquity` | ratio | `95.1×`, `0.06×` |
| `Company.epsTTM`, `.fcfPerShare` | per share; currency not supplied | `1.90`, never imply USD |
| `AnnualIncome.revenue`, `.netIncome`, other statement totals | full amounts in `currency` | `USD 100M`; full amounts in tables |
| `AnnualIncome.epsDiluted` | reported currency per diluted share | `USD 5.00` |
| `ResearchValuation.dividendYield` | fraction (`0.0045`); `0` = no dividend; null = unknown (never "no dividend") | ×100, 2 decimals → `0.45%` |
| `ResearchProfile.marketCap` | full amount in `profile.currency` | compact → `USD 3.4T` |
| `ResearchProfile.beta` | ratio vs the market | data only; not shown |
| `Macro.fedFunds`, `cpiYoY`, `unemployment`, `wageGrowth`, `tenYear` | **already percent** (`4.33`) | **do not** ×100 → `4.33%` |
| `Risk.score` | integer 0–100 | `58` with `/100` in `text-tertiary` |

---

## 11. States and API errors

Every data card handles all of these states. The API error envelope is `{error: {code, message, requestId}}`.

| Situation | Where | What the user sees |
|---|---|---|
| Loading | Card | Skeleton while loading. After 8s: "Still working. This can take up to 30 seconds." |
| `404 NOT_FOUND` on `GET /profile` | App | No saved profile; continue learning, researching or asking general questions. Profile setup remains optional. |
| `409 NOT_LINKED` | Card | The card is replaced by the Link account card (§4.3): "Link an account to see your holdings." |
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
