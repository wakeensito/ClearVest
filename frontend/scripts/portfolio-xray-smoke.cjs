// Portfolio "What you really own" / "Your plan vs. today" (DESIGN.md §4.14) and the ticker
// "What would this do to my portfolio?" what-if card (§4.15). Start a dev server first, e.g.
//   npx vite --port 5174 --strictPort --host 127.0.0.1   (from frontend/)
//   CLEARVEST_PREVIEW_URL=http://127.0.0.1:5174 node scripts/portfolio-xray-smoke.cjs
// Every API call is intercepted. /portfolio/holdings is the Plaid sandbox sample account (same
// numbers as components/portfolio/xray.fixtures.ts sampleHoldings() / lib/risk.test.ts / lib/
// targetMix.test.ts); /market/fund fixtures mirror lib/fundExplainer.fixtures.ts; /market/templates
// returns the five real templates (src/market/market/data/templates.json), not the single-item
// contract example, so the profile's suggested plan (Buffett 90/10 for age 25 / long / high) is in
// the list; /profile and /portfolio/risk use fixed fixtures; everything else falls back to the
// docs/api/openapi.yaml example for that path.
//
// A parallel task (task/8) may reword the drift / what-if / earnings sentences, so this script
// checks stable anchors (`section#xray`, `[data-plan-vs-actual]`, `%`, `$`, "funds checked", "risk
// score", "of your money") rather than pinning full sentences.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const previewUrl = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5174';
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
const output = path.resolve(__dirname, '../node_modules/.cache/clearvest-review');
fs.mkdirSync(output, { recursive: true });

// Sample account (Plaid sandbox), 2026-09-26 prices: VOO 15x710.79, QQQ 6x744.50, VGT 8x126.17,
// NVDA 12x225.07, AAPL 10x341.07, $1,500 cash. Total ~$23,749.75. With the fund fixtures below this
// reproduces DESIGN.md's own worked example ("Your funds cost about $13 a year (0.08% ...)").
const ROWS = [
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', quantity: 15, price: 710.79 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', quantity: 6, price: 744.5 },
  { symbol: 'VGT', name: 'Vanguard Information Technology ETF', type: 'etf', quantity: 8, price: 126.17 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'equity', quantity: 12, price: 225.07 },
  { symbol: 'AAPL', name: 'Apple Inc', type: 'equity', quantity: 10, price: 341.07 },
  { symbol: 'CUR:USD', name: 'Cash', type: 'cash', quantity: 1500, price: 1 },
];
const rows = ROWS.map((r) => ({ ...r, value: r.quantity * r.price }));
const total = rows.reduce((s, r) => s + r.value, 0);
const HOLDINGS = { asOf: '2026-09-26T00:00:00+00:00', totalValue: total, holdings: rows.map((r) => ({ ...r, weight: r.value / total })) };

const PROFILE = { age: 25, horizon: 'long', riskTolerance: 'high', goals: [] };
const RISK = contract.paths['/portfolio/risk'].get.responses['200'].content['application/json'].example;

// The five real templates (src/market/market/data/templates.json), not the single-item contract
// example: PlanVsActual's default pick for this profile (Buffett 90/10) must be in the list.
const TEMPLATES = [
  { id: 'sixty-forty', name: 'Classic 60/40', description: 'A traditional balanced portfolio: 60% total US stock market, 40% total US bond market.', allocations: [{ asset: 'VTI', weight: 0.6 }, { asset: 'BND', weight: 0.4 }], source: 'https://www.bogleheads.org/wiki/Asset_allocation' },
  { id: 'three-fund', name: 'Bogleheads three-fund', description: 'US stocks, international stocks and US bonds in one example weighting; the Bogleheads wiki treats the exact split as a matter of personal risk tolerance.', allocations: [{ asset: 'VTI', weight: 0.5 }, { asset: 'VXUS', weight: 0.3 }, { asset: 'BND', weight: 0.2 }], source: 'https://www.bogleheads.org/wiki/Three-fund_portfolio' },
  { id: 'all-weather', name: 'All Weather (Ray Dalio, popularized)', description: 'A risk-balanced mix of stocks, long-term bonds, intermediate bonds, gold and commodities meant to hold up across growth and inflation regimes.', allocations: [{ asset: 'VTI', weight: 0.3 }, { asset: 'TLT', weight: 0.4 }, { asset: 'IEI', weight: 0.15 }, { asset: 'GLD', weight: 0.075 }, { asset: 'DBC', weight: 0.075 }], source: 'https://www.bridgewater.com/research-and-insights/the-all-weather-story' },
  { id: 'buffett-90-10', name: 'Buffett 90/10', description: "Warren Buffett's suggestion for his estate: 90% in a low-cost S&P 500 fund, 10% in short-term government bonds.", allocations: [{ asset: 'VOO', weight: 0.9 }, { asset: 'SHV', weight: 0.1 }], source: 'https://www.berkshirehathaway.com/letters/2013ltr.pdf' },
  { id: 'target-date-2065', name: 'Target-date style (young investor)', description: 'An approximate glide-path starting point for a decades-long horizon, weighted toward US and international stocks with a small bond allocation.', allocations: [{ asset: 'VTI', weight: 0.54 }, { asset: 'VXUS', weight: 0.36 }, { asset: 'BND', weight: 0.07 }, { asset: 'BNDX', weight: 0.03 }], source: 'https://investor.vanguard.com/investment-products/mutual-funds/target-retirement-funds' },
];

// /market/fund fixtures (mirrors src/lib/fundExplainer.fixtures.ts).
const TOP_TEN = [
  ['NVDA', 'NVIDIA Corp', 0.08082], ['AAPL', 'Apple Inc', 0.070339], ['MSFT', 'Microsoft Corp', 0.056958],
  ['AMZN', 'Amazon.com Inc', 0.038], ['META', 'Meta Platforms Inc Class A', 0.029], ['AVGO', 'Broadcom Inc', 0.025],
  ['GOOGL', 'Alphabet Inc Class A', 0.021], ['TSLA', 'Tesla Inc', 0.019], ['GOOG', 'Alphabet Inc Class C', 0.017],
  ['BRK-B', 'Berkshire Hathaway Inc Class B', 0.016],
].map(([symbol, name, weight]) => ({ symbol, name, weight }));
const VOO = {
  symbol: 'VOO', name: 'Vanguard S&P 500 ETF', kind: 'etf', isIndexFund: true, leveraged: false,
  tracks: "Standard & Poor's 500 Index", expenseRatio: 0.0003, topHoldings: TOP_TEN,
  summary: 'VOO is a fund that owns shares of about 500 of the biggest U.S. companies. When they do well, it does well.',
  summarySource: 'template', asOf: '2026-09-26', stale: false, fundFamily: 'Vanguard', category: 'Large Blend', sector: null,
};
const QQQ = {
  ...VOO, symbol: 'QQQ', name: 'Invesco QQQ Trust', expenseRatio: 0.002, tracks: 'Nasdaq-100 Index', category: 'Large Growth', fundFamily: 'Invesco',
  topHoldings: [
    ['NVDA', 'NVIDIA Corp', 0.091], ['AAPL', 'Apple Inc', 0.085], ['MSFT', 'Microsoft Corp', 0.078], ['AMZN', 'Amazon.com Inc', 0.055],
    ['AVGO', 'Broadcom Inc', 0.052], ['META', 'Meta Platforms Inc Class A', 0.04], ['TSLA', 'Tesla Inc', 0.034], ['GOOGL', 'Alphabet Inc Class A', 0.028],
    ['GOOG', 'Alphabet Inc Class C', 0.027], ['COST', 'Costco Wholesale Corp', 0.026],
  ].map(([symbol, name, weight]) => ({ symbol, name, weight })),
};
const VGT = {
  ...VOO, symbol: 'VGT', name: 'Vanguard Information Technology ETF', expenseRatio: 0.0009, tracks: 'MSCI US IMI Info Tech 25/50', category: 'Technology', fundFamily: 'Vanguard',
  topHoldings: [
    ['NVDA', 'NVIDIA Corp', 0.162], ['AAPL', 'Apple Inc', 0.15], ['MSFT', 'Microsoft Corp', 0.131], ['AVGO', 'Broadcom Inc', 0.046],
    ['ORCL', 'Oracle Corp', 0.028], ['PLTR', 'Palantir Technologies Inc', 0.022], ['CSCO', 'Cisco Systems Inc', 0.02], ['AMD', 'Advanced Micro Devices Inc', 0.019],
    ['CRM', 'Salesforce Inc', 0.015], ['IBM', 'International Business Machines Corp', 0.014],
  ].map(([symbol, name, weight]) => ({ symbol, name, weight })),
};
const AAPL = { symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', isIndexFund: false, leveraged: false, tracks: null, expenseRatio: null, topHoldings: [], summary: 'Apple makes the iPhone, Mac and other devices, and sells services like iCloud.', summarySource: 'model', asOf: '2026-09-26', stale: false, fundFamily: null, category: null, sector: 'Technology' };
const NVDA = { symbol: 'NVDA', name: 'NVIDIA Corp', kind: 'stock', isIndexFund: false, leveraged: false, tracks: null, expenseRatio: null, topHoldings: [], summary: 'NVIDIA designs graphics chips used for gaming, data centers and artificial intelligence.', summarySource: 'model', asOf: '2026-09-26', stale: false, fundFamily: null, category: null, sector: 'Technology' };
const BND = { ...VOO, symbol: 'BND', name: 'Vanguard Total Bond Market ETF', tracks: 'Bloomberg U.S. Aggregate Float Adjusted Index', category: 'Intermediate Core Bond', topHoldings: [], summary: 'BND is a fund that lends money to the U.S. government and many companies.' };
const VTI = { ...VOO, symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', tracks: 'CRSP US Total Market Index', topHoldings: TOP_TEN.map((h) => ({ ...h, weight: h.weight * 0.85 })), summary: 'VTI is a fund that owns shares of thousands of U.S. companies of all sizes.' };
const FUNDS = { VOO, QQQ, VGT, AAPL, NVDA, BND, VTI };

const SEARCH_RESULTS = { results: [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }, { symbol: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYSE' }], stale: false };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });

  let fundMode = 'ok'; // 'ok' | 'error'
  let slowFundSymbol = null; // when set, that /market/fund request takes ~3s
  let holdingsMode = 'ok'; // 'ok' | 'unlinked'

  await context.route('http://127.0.0.1:4010/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method().toLowerCase();
    let status = 200;
    let body;
    if (url.pathname === '/market/fund') {
      const symbol = url.searchParams.get('symbol');
      if (symbol === slowFundSymbol) await new Promise((r) => setTimeout(r, 3000));
      if (fundMode === 'error') { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable', requestId: null } }; }
      else body = FUNDS[symbol] ?? { ...FUNDS.AAPL, symbol, name: symbol };
    } else if (url.pathname === '/market/search') {
      body = SEARCH_RESULTS;
    } else if (url.pathname === '/market/templates') {
      body = TEMPLATES;
    } else if (url.pathname === '/profile' && method === 'get') {
      body = PROFILE;
    } else if (url.pathname === '/portfolio/holdings') {
      if (holdingsMode === 'unlinked') { status = 409; body = { error: { code: 'NOT_LINKED', message: 'Link account', requestId: null } }; }
      else body = HOLDINGS;
    } else if (url.pathname === '/portfolio/risk') {
      body = RISK;
    } else {
      body = structuredClone(contract.paths[url.pathname]?.[method]?.responses?.['200']?.content?.['application/json']?.example ?? {});
      if (url.pathname === '/market/history') {
        const symbol = url.searchParams.get('symbols');
        const template = body.series[0];
        body = { ...body, series: [{ ...template, symbol }], refresh: undefined, refreshing: false };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const overflow = () => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  const results = [];
  const record = async (label, width) => {
    const o = await overflow();
    results.push({ label, width, ...o });
    assert(o.scrollWidth <= o.innerWidth, `${label} at ${width}px overflows: ${o.scrollWidth} > ${o.innerWidth}`);
  };

  for (const width of [320, 375, 393]) {
    await page.setViewportSize({ width, height: 812 });
    fundMode = 'ok'; slowFundSymbol = null; holdingsMode = 'ok';

    await page.goto(`${previewUrl}/portfolio`);
    await page.getByRole('heading', { name: 'What you really own' }).waitFor();
    await page.locator('[data-identity-row]').waitFor();
    await record('portfolio base', width);

    // #xray is the first thing in the main column, above Security research (DESIGN.md §4.14).
    // (The literal `[data-identity-row]` also appears earlier, inside a <style> block's selector
    // text, so match the rendered attribute `data-identity-row="true"`, not the bare string.)
    const html = await page.content();
    const xrayIdx = html.indexOf('id="xray"');
    const identityIdx = html.indexOf('data-identity-row="true"');
    assert(xrayIdx > -1 && xrayIdx < identityIdx, '#xray must render before Security research');

    const xrayText = await page.locator('#xray').innerText();
    const appleMatch = xrayText.match(/Apple is (?:about )?(\d+)% of your money/);
    assert(appleMatch, `xray headline should mention Apple and a percentage: ${xrayText.slice(0, 200)}`);
    assert(Number(appleMatch[1]) >= 15, `Apple share should be >= 15%, got ${appleMatch[1]}%`);
    assert(xrayText.includes('3 of 3 funds checked'), 'coverage caption should say 3 of 3 funds checked');
    assert(xrayText.includes('$') && /a year/.test(xrayText), 'fee panel should show a dollar figure and "a year"');
    await record('xray headline + fees', width);

    // Plan vs. today: age 25 / long horizon / high risk tolerance -> Buffett 90/10 is suggested.
    const planEl = page.locator('[data-plan-vs-actual]');
    await planEl.waitFor();
    const planText = await planEl.innerText();
    assert(planText.includes('Suggested for you'), 'default plan pick should carry the Suggested badge');
    assert(planText.includes('%'), 'plan legend should show percents');
    assert(planText.toLowerCase().includes('plan'), 'drift sentence should mention the plan');
    await record('plan vs today', width);
    if (width === 375) await page.screenshot({ path: path.join(output, 'portfolio-xray-375.png'), fullPage: true });

    // Switching plans updates the drift sentence (stable anchor: it changes, not what it says).
    await page.getByLabel('Compare with').selectOption({ label: 'Classic 60/40' });
    await page.waitForFunction((prev) => document.querySelector('[data-plan-vs-actual]')?.innerText !== prev, planText);
    const planTextAfter = await planEl.innerText();
    assert.notEqual(planTextAfter, planText, 'changing the plan should change the drift sentence');
    await record('plan switched', width);

    // Hide portfolio values: every $ disappears from the xray card except the "every $10,000" fee
    // rate line (a rate, not the client's dollars; same rule as OwnershipXray.test.ts); percents remain.
    await page.getByRole('button', { name: 'Hide portfolio values' }).click();
    const hiddenText = await page.locator('#xray').innerText();
    const RATE_LINE = /(?:That's about \$[\d,]+|Under \$1) a year on every \$10,000\./;
    assert(RATE_LINE.test(hiddenText), 'hidden values should keep the "every $10,000" fee rate line');
    assert(!hiddenText.replace(RATE_LINE, '').includes('$'), 'hidden values should remove every other $ from the xray card');
    assert(hiddenText.includes('%'), 'hidden values should keep percents');
    await record('hidden values', width);
    await page.getByRole('button', { name: 'Show portfolio values' }).click();
  }

  // Degraded: every fund lookup fails -> "couldn't look inside your funds" + Retry, not a headline.
  fundMode = 'error';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${previewUrl}/portfolio`);
  await page.getByText("We couldn't look inside your funds right now.").waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Retry' }).waitFor();
  await record('funds unavailable', 375);
  fundMode = 'ok';

  // Pending: one fund takes ~3s. "Adding up fees…" must show first; never "Fee not available"
  // while it's merely still loading.
  slowFundSymbol = 'VGT';
  await page.goto(`${previewUrl}/portfolio`);
  await page.getByText('Adding up fees…').waitFor();
  assert.equal(await page.getByText('Fee not available', { exact: false }).count(), 0, 'a loading fund must never read as unavailable');
  await page.getByText('Adding up fees…').waitFor({ state: 'detached', timeout: 8000 });
  await record('fees settle after pending', 375);
  slowFundSymbol = null;

  // What-if, linked: /markets?symbol=NVDA.
  for (const width of [320, 375, 393]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(`${previewUrl}/markets?symbol=NVDA`);
    await page.getByRole('group', { name: 'NVDA interactive price chart' }).waitFor();
    const whatIf = page.locator('[data-what-if="NVDA"]');
    await whatIf.waitFor();
    const before = await whatIf.innerText();
    assert(before.includes('risk score'), 'what-if sentence should mention risk score');
    assert(before.includes('of your money'), 'what-if sentence should say "of your money"');
    assert(/%/.test(before) && /\$/.test(before), 'what-if card should show dollar and percent figures');
    await record('what-if NVDA', width);
    if (width === 375) await page.screenshot({ path: path.join(output, 'what-if-nvda-375.png'), fullPage: false });

    await whatIf.getByRole('group', { name: 'Amount to add' }).getByRole('button', { name: '$5,000', exact: true }).click();
    await page.waitForFunction((prev) => document.querySelector('[data-what-if="NVDA"]')?.innerText !== prev, before);
    const after = await whatIf.innerText();
    assert.notEqual(after, before, 'choosing $5,000 should change the numbers');
    await record('what-if $5,000', width);
  }

  // Unlinked on Markets: the research card renders (chart intact) with the one-line invite to
  // /portfolio instead of the what-if card (DESIGN.md §4.15). The portfolio page itself passes
  // invite={false} (covered by PortfolioPage.test.ts).
  holdingsMode = 'unlinked';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${previewUrl}/markets?symbol=NVDA`);
  await page.getByRole('group', { name: 'NVDA interactive price chart' }).waitFor();
  const invite = page.locator('[data-what-if-invite]');
  await invite.waitFor({ state: 'visible' });
  assert.equal(await invite.getAttribute('href'), '/portfolio', 'the invite should link to /portfolio');
  assert.equal(await page.locator('[data-what-if="NVDA"]').count(), 0, 'an unlinked account should not see the what-if card');
  await record('unlinked markets', 375);
  holdingsMode = 'ok';

  assert.deepEqual(errors, []);
  console.table(results);
  console.log('PASS: xray headline/fees/coverage, plan vs. today (suggested + switch), hidden values (rate line kept), degraded/pending fund states, ticker what-if (linked + amount change), unlinked markets invite. No overflow at 320/375/393. No page errors.');
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
