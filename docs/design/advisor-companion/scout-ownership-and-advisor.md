# What do I really own? — ownership and Advisor redesign

Implemented locally on `feat/advisor-companion`, 2026-09-27. No push, deployment, live provider request or live model evaluation was performed for this milestone.

## The user experience

Advisor opens on **What I own**, with **Risk check** and **Research** as its other two tools. Scout remains beside “Ask about your money.” The workspace keeps the deep navy, subtle glass surfaces and yellow action color, with shorter labels and fewer competing panels.

- Ownership shows each reported security's direct and fund exposure together. Expand a row to see the dollar contribution from each fund; use **Overlaps** to isolate repeated exposure.
- Mapped coverage and the unmapped dollar amount remain visible. Dates, fund coverage and limitations live in **Sources & limits**.
- **Risk check** keeps the deterministic hypothetical drop slider. Its assumptions are expandable, and the current holding/drop follow typed and voice questions.
- **Research** keeps company search and three financial figures. Business descriptions, financial sources and related headlines open on demand.
- **Your context** opens the existing profile/portfolio panel when wanted. **Ask Scout** opens the shared conversation alongside the tool on desktop; phones focus on the conversation until it closes. A compact composer also works directly below the tool.
- Tool actions open a sourced question. Switching tools clears a previously pinned selection so the next question follows the visible tool. Voice, drafts, history and in-flight requests remain shared with the floating companion. Multiple answer receipts are grouped behind one Sources disclosure.

## The calculation

For security S:

```
exposure(S) = direct position value(S)
              + sum(owned fund value × reported fund weight(S) / 100)
portfolio exposure % = exposure(S) / saved portfolio total × 100
```

The backend uses Decimal arithmetic before rounding money for display. Duplicated positions across accounts are summed first. An overlap means at least two ownership paths (two different funds, or a direct holding plus a fund); duplicated direct positions alone do not count.

Synthetic test example, **not actual fund weights**: a $10,000 portfolio holds $4,000 Fund A, $3,000 Fund B, $1,000 Apple directly and $2,000 cash. Fixture fund weights of 10% and 5% Apple produce $1,550 Apple exposure, or 15.5%. Partial fund lists remain partial; they are never rescaled to 100%.

Cash contributes to mapped portfolio coverage but is not a company row. Unknown asset types remain unmapped. Unsupported shorts, derivatives, nonfinite values or inconsistent balances do not produce an apparently valid exposure result. Zero-balance positions do not create false overlaps.

## Data and provenance

The provider adapter calls FMP's documented [`/stable/etf/holdings`](https://site.financialmodelingprep.com/developer/docs/stable/holdings) endpoint. It normalizes `asset`, `name`, `weightPercentage`, `isin` and `updatedAt`, checking the returned fund symbol, numeric weights, security ticker, names and dates.

This is **validated provider-reported data**, not independent verification against issuer filings. A provider retrieval does not prove completeness. The UI says what was mapped and discloses the source; it does not claim that every underlying item is an operating company.

- `providerUpdatedAt` is a provider update date, **not** an issuer holdings or filing date. `fetchedAt` is our retrieval time. The portfolio has its own `asOf` date. Applying reported weights to a differently dated portfolio is a look-through estimate of that saved portfolio, not a simultaneous live valuation.
- The shared fund cache lasts 24 hours. Exposure excludes expired entries and provider updates more than 35 days old; 35 days is this application's freshness policy, not an FMP guarantee. Future or absent dates are excluded.
- If rows have different update days, only the latest day's rows contribute. Duplicate tickers within a source, negative/excessive weights and aggregate weights over 100% reject the source. Unidentifiable rows stay unmapped.
- Large sources retain at most the largest 1,000 usable rows and a 300 kB JSON row budget. Dropped tails reduce mapped coverage. This keeps DynamoDB items safely below their size limit, including escaped non-ASCII names.
- Matching uses exact security tickers. Available conflicting ISINs prevent a merge. Share classes are **not** consolidated into a company-wide total; missing ISINs do not establish global security identity. Known nested funds are excluded; there is no recursive fund-of-funds expansion or general issuer/security-master classification.
- The page requests at most eight distinct owned funds, ranked by aggregated position value. Other funds can contribute only if a usable source is already cached; otherwise their value stays unmapped. Instruments classified as fixed income/unknown are not guessed to be ETFs from their ticker.

## Request path

1. `usePortfolioExposure()` loads the existing normalized portfolio.
2. It requests public `GET /market/fund-holdings?symbol=...` for the bounded fund set, reusing the existing FMP secret and MarketFn. Fund rows are shared public cache data; account balances are never sent to FMP.
3. After those requests settle, private `GET /portfolio/exposure` reads the caller's saved `HOLDINGS` and the normalized caches. Fresh cache reads are strongly consistent so a just-loaded fund is visible to the calculation.
4. The page renders server-calculated contributions, percentages, source coverage and dates. Failed fund requests still allow direct holdings and available funds to be shown.
5. “Ask Scout about overlap” sends `context: {page:'advisor', metric:'exposure', symbol?}` and `grounded:true`. Scout recomputes the source from server holdings/caches. The browser never supplies trusted weights or balances. Missing evidence does not fall back to an unrelated portfolio explanation.

The same shared source builder is available to ordinary text and voice turns. Explicit tool questions use the existing standalone grounding check. Ordinary conversational/voice answers retain the existing Context used semantics; they do not acquire a grounding badge merely because they have context.

No new AWS resources or permissions are needed: existing MarketFn/PortfolioFn catch-all routes, FMP credentials and DynamoDB permissions cover the feature. The prior guardrail resources on this branch still require their own authorized deployment. Demo identity remains the existing `X-User-Id`; this work does not introduce production authentication.

## Verification and demo

`tests/layer/test_exposure.py` covers the formula, duplicate account positions, partial/mixed/outdated sources, wrong symbols, invalid weights, security-identity conflicts, nested funds, byte bounds, unsupported positions, provider/API contracts, caller isolation and Scout's independently calculated reference.

`npm run test:scout-ownership -w frontend` uses **synthetic API fixtures** to verify request ordering, ownership paths, coverage, filtering, keyboard access, source receipts, tool context changes, mobile layout and unavailable/unlinked states. Other Scout motion, safety, workspace and voice checks remain in place. Screenshots are local under `frontend/node_modules/.cache/clearvest-review/` and are not committed as real data.

Demo sequence: open What I own → select Overlaps → expand a security → point to direct and two-fund contributions → show Sources & limits → ask Scout to explain the overlap. Use a clearly labeled synthetic fixture until the deployment account's FMP entitlement, actual returned rows/dates and at least one issuer comparison have been checked. Provider failures must remain visible; do not add plausible replacement weights for the demo.
