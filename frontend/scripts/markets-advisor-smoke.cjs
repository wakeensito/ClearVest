// Markets discovery phone check (DESIGN.md phone-first rules). Start a dev server first, e.g.
//   npx vite --port 5174 --strictPort --host 127.0.0.1   (from frontend/)
//   CLEARVEST_PREVIEW_URL=http://127.0.0.1:5174 node scripts/markets-advisor-smoke.cjs
// Every API call is intercepted: contract examples for every path, plus /market/fund fixtures
// matching src/lib/fundExplainer.fixtures.ts (mirrored, see fund-explainer-smoke.cjs) and a fixed
// /market/search result set (AAPL and APLE both match "apple").
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const previewUrl = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5174';
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
const output = path.resolve(__dirname, '../node_modules/.cache/clearvest-review');
fs.mkdirSync(output, { recursive: true });

// Minimal /market/fund fixtures for the symbols this script researches (mirrors
// src/lib/fundExplainer.fixtures.ts NVDA and AAPL; the identity line fetches every symbol shown).
const FUNDS = {
  AAPL: { symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', isIndexFund: false, leveraged: false, tracks: null, expenseRatio: null, topHoldings: [], summary: 'Apple makes the iPhone, Mac and other devices, and sells services like iCloud.', summarySource: 'model', asOf: '2026-09-26', stale: false, fundFamily: null, category: null, sector: 'Technology' },
  NVDA: { symbol: 'NVDA', name: 'NVIDIA Corp', kind: 'stock', isIndexFund: false, leveraged: false, tracks: null, expenseRatio: null, topHoldings: [], summary: 'NVIDIA designs graphics chips used for gaming, data centers and artificial intelligence.', summarySource: 'template', asOf: '2026-09-26', stale: false, fundFamily: null, category: null, sector: 'Technology' },
};

const SEARCH_RESULTS = { results: [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }, { symbol: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYSE' }], stale: false };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  await context.route('http://127.0.0.1:4010/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method().toLowerCase();
    let body;
    if (url.pathname === '/market/fund') {
      const symbol = url.searchParams.get('symbol');
      body = FUNDS[symbol] ?? { ...FUNDS.AAPL, symbol, name: symbol };
    } else if (url.pathname === '/market/search') {
      body = SEARCH_RESULTS;
    } else {
      body = structuredClone(contract.paths[url.pathname]?.[method]?.responses?.['200']?.content?.['application/json']?.example ?? {});
      if (url.pathname === '/market/history') {
        const symbol = url.searchParams.get('symbols');
        const template = body.series[0];
        body = { ...body, series: [{ ...template, symbol }], refresh: undefined, refreshing: false };
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const overflow = () => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  const results = [];
  const record = async (label, width) => {
    const o = await overflow();
    results.push({ label, width, ...o });
    assert(o.scrollWidth <= o.innerWidth, `${label} at ${width}px overflows: ${o.scrollWidth} > ${o.innerWidth}`);
  };
  const clearWatchlist = () => page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  for (const width of [320, 375, 393]) {
    await page.setViewportSize({ width, height: 812 });

    // Fresh watchlist for every width: starring NVDA in an earlier pass must not leak into this one.
    await page.goto(`${previewUrl}/markets?symbol=NVDA`);
    await clearWatchlist();
    await page.reload();
    await page.getByRole('group', { name: 'NVDA interactive price chart' }).waitFor();
    await record('closed / empty watchlist', width);

    // The star toggles to "Watching" and back.
    const star = page.getByRole('button', { name: 'Watch', exact: true });
    await star.click();
    await page.getByRole('button', { name: 'Watching' }).waitFor();
    await record('starred', width);
    await page.getByRole('button', { name: 'Watching' }).click();
    await page.getByRole('button', { name: 'Watch', exact: true }).waitFor();
    await record('unstarred', width);

    // Star NVDA again: the watchlist card at the top of /markets lists it with a signed 1-year return.
    await star.click();
    await page.getByRole('button', { name: 'Watching' }).waitFor();
    const watchlist = page.getByRole('list', { name: 'Watched securities' });
    const nvdaRow = watchlist.locator('li').filter({ hasText: 'NVDA' });
    await nvdaRow.waitFor();
    const returnText = await nvdaRow.innerText();
    assert.match(returnText, /[+−]\d/, `watchlist NVDA row has no signed return: ${returnText}`);
    await record('watchlist has NVDA', width);

    // Typing "apple" lists AAPL and APLE; Enter selects AAPL (the URL symbol changes).
    const search = page.getByLabel('Find a stock or fund');
    await search.fill('apple');
    await page.getByRole('option', { name: /AAPL/ }).waitFor();
    const optionText = await page.getByRole('listbox', { name: 'Suggestions' }).innerText();
    assert(optionText.includes('AAPL'), 'suggestions missing AAPL');
    assert(optionText.includes('APLE'), 'suggestions missing APLE');
    await record('search suggestions open', width);
    await search.press('Enter');
    await page.getByRole('group', { name: 'AAPL interactive price chart' }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('symbol'), 'AAPL');
    await record('search selected AAPL', width);

    // "Market activity" starts closed; opening it mounts the board.
    const activitySummary = page.getByText('Market activity: most active, gainers and losers');
    const activityDetails = page.locator('details', { has: activitySummary });
    assert.equal(await activityDetails.evaluate(el => el.open), false, 'Market activity should start closed');
    assert.equal(await page.getByRole('heading', { name: 'Top 10 most active' }).count(), 0, 'board should not be mounted while closed');
    await activitySummary.click();
    await page.getByRole('heading', { name: 'Top 10 most active' }).waitFor();
    assert.equal(await activityDetails.evaluate(el => el.open), true);
    await record('market activity open', width);
    if (width === 375) await page.screenshot({ path: path.join(output, 'markets-activity-375.png'), fullPage: false });

    // AAPL company financials: the "Next earnings report" line and the "Does it pay you to wait?" step.
    await page.getByText('Next earnings report (when it shares its results):', { exact: false }).waitFor();
    await page.getByRole('button', { name: /Payouts/ }).click();
    await page.getByRole('heading', { name: 'Does it pay you to wait?' }).waitFor();
    await record('company financials payouts step', width);
    if (width === 375) await page.screenshot({ path: path.join(output, 'markets-company-financials-375.png'), fullPage: false });
    if (width === 320) await page.screenshot({ path: path.join(output, 'markets-320.png'), fullPage: false });
  }

  assert.deepEqual(errors, []);
  console.table(results);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
