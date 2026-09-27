// Fund explainer phone check (DESIGN.md §4.13). Start a dev server first, e.g.
//   npx vite --port 5174 --strictPort   (from frontend/)
//   CLEARVEST_PREVIEW_URL=http://127.0.0.1:5174 node scripts/fund-explainer-smoke.cjs
// Every API call is intercepted: contract examples, plus /market/fund fixtures matching
// src/lib/fundExplainer.fixtures.ts (the route is not in openapi.yaml yet).
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const previewUrl = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5174';
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
const output = path.resolve(__dirname, '../node_modules/.cache/clearvest-review');
fs.mkdirSync(output, { recursive: true });

const TOP_TEN = [
  ['NVDA', 'NVIDIA Corp', 0.08082], ['AAPL', 'Apple Inc', 0.070339], ['MSFT', 'Microsoft Corp', 0.056958],
  ['AMZN', 'Amazon.com Inc', 0.038], ['META', 'Meta Platforms Inc Class A', 0.029], ['AVGO', 'Broadcom Inc', 0.025],
  ['GOOGL', 'Alphabet Inc Class A', 0.021], ['TSLA', 'Tesla Inc', 0.019], ['GOOG', 'Alphabet Inc Class C', 0.017],
  ['BRK-B', 'Berkshire Hathaway Inc Class B', 0.016],
].map(([symbol, name, weight]) => ({ symbol, name, weight }));
const VOO = {
  symbol: 'VOO', name: 'Vanguard S&P 500 ETF', kind: 'etf', isIndexFund: true, tracks: "Standard & Poor's 500 Index",
  expenseRatio: 0.0003, holdingsCount: 504, topHoldings: TOP_TEN,
  summary: 'VOO is a fund that owns shares of about 500 of the biggest U.S. companies. When they do well, it does well.',
  summarySource: 'template', asOf: '2026-09-26', fundFamily: 'Vanguard', category: 'Large Blend', sector: null,
};
const FUNDS = {
  VOO,
  VFIAX: { ...VOO, symbol: 'VFIAX', name: 'Vanguard 500 Index Admiral', kind: 'mutual_fund', expenseRatio: 0.0004, summary: 'VFIAX is a mutual fund that owns shares of about 500 of the biggest U.S. companies.' },
  AAPL: { symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', isIndexFund: false, tracks: null, expenseRatio: null, holdingsCount: null, topHoldings: [], summary: 'Apple makes the iPhone, Mac and other devices, and sells services like iCloud.', summarySource: 'model', asOf: '2026-09-26', fundFamily: null, category: null, sector: 'Technology' },
  // The longest provider wording we have seen, to prove the identity line wraps at 320px.
  VTI: { ...VOO, symbol: 'VTI', name: 'Vanguard Total Stock Market Index Fund ETF Shares', tracks: 'CRSP US Total Market Index Including Micro-Capitalization Companies', holdingsCount: 3600 },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  let fundMode = 'ok';
  await context.route('http://127.0.0.1:4010/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method().toLowerCase();
    let status = 200;
    let body;
    if (url.pathname === '/market/fund') {
      const symbol = url.searchParams.get('symbol');
      if (fundMode === 'error') { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable', requestId: null } }; }
      else body = FUNDS[symbol] ?? { ...FUNDS.AAPL, symbol, name: symbol };
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
  page.on('pageerror', e => errors.push(e.message));
  const overflow = () => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  const results = [];
  const record = async (label, width) => {
    const o = await overflow();
    results.push({ label, width, ...o });
    assert(o.scrollWidth <= o.innerWidth, `${label} at ${width}px overflows: ${o.scrollWidth} > ${o.innerWidth}`);
  };
  const explainer = page.locator('[data-fund-explainer]');

  for (const width of [320, 375, 393]) {
    await page.setViewportSize({ width, height: 812 });
    // Closed: identity line only.
    await page.goto(`${previewUrl}/markets?symbol=VOO`);
    await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor();
    await page.getByText('VOO · Index fund (ETF)').waitFor();
    assert.equal(await explainer.count(), 0);
    await record('closed', width);

    // Open with the first chip answer, then with the comparison table.
    await page.getByRole('button', { name: 'What is this?' }).click();
    await explainer.waitFor();
    assert.equal(new URL(page.url()).searchParams.get('explain'), '1');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'VOO explained');
    await record('open', width);
    const closedHeight = await explainer.evaluate(el => el.getBoundingClientRect().height);
    await page.getByRole('button', { name: 'Who runs it?' }).click();
    await page.getByText('Vanguard runs it.', { exact: false }).waitFor();
    await record('open + chip answer', width);
    const answerHeight = await explainer.evaluate(el => el.getBoundingClientRect().height);
    const lines = await explainer.evaluate(el => [...el.querySelectorAll('ol > li')].map(li => {
      const ps = [...li.querySelectorAll('p')];
      return ps.reduce((sum, p) => sum + Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)), 0);
    }));
    if (width === 375) {
      results.push({ label: 'explainer height (no answer / with "Who runs it?")', width, closedHeight: Math.round(closedHeight), answerHeight: Math.round(answerHeight), textLinesPerStep: lines.join('/') });
      await page.screenshot({ path: path.join(output, 'fund-explainer-375.png'), fullPage: false });
    }
    await page.getByRole('button', { name: 'Next: Where is the money?' }).click();
    await page.getByText('Your money goes into big U.S. companies', { exact: false }).waitFor();
    assert.equal(await page.locator('[data-topic]').count(), 1, 'one answer at a time');
    await page.getByRole('button', { name: 'ETF or mutual fund?' }).click();
    await page.getByRole('table').filter({ hasText: 'When the price updates' }).waitFor();
    await record('open + comparison table', width);
    if (width === 320) await page.locator('[data-topic="compare"]').screenshot({ path: path.join(output, 'fund-explainer-table-320.png') });

    // Done clears the param and returns focus to the search input.
    await page.getByRole('button', { name: 'Done' }).click();
    await explainer.waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).searchParams.get('explain'), null);
    assert.equal(new URL(page.url()).searchParams.get('symbol'), 'VOO');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'INPUT');

    // Back closes; Escape closes.
    await page.getByRole('button', { name: 'What is this?' }).click();
    await explainer.waitFor();
    await page.goBack();
    await explainer.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'What is this?' }).click();
    await page.getByRole('button', { name: 'Who runs it?' }).focus();
    await page.keyboard.press('Escape');
    await explainer.waitFor({ state: 'detached' });

    // Changing the ticker keeps the explainer open for the new security.
    await page.getByRole('button', { name: 'What is this?' }).click();
    await explainer.waitFor();
    const search = page.getByLabel('Research a ticker symbol');
    await search.fill('VFIAX'); await search.press('Enter');
    await page.locator('[data-fund-explainer="VFIAX"]').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('explain'), '1');
    await page.getByText('VFIAX · Index fund (mutual fund)').waitFor();

    // A stock: step 1 and the jump to company financials.
    await page.goto(`${previewUrl}/markets?symbol=AAPL&explain=1`);
    await page.locator('[data-fund-explainer="AAPL"]').waitFor();
    assert.equal(await page.locator('[data-dollar-strip]').count(), 0);
    await record('stock open', width);
    await page.getByRole('button', { name: /See what this company earns/ }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-company-financials')), 'AAPL');

    // Long provider wording wraps.
    await page.goto(`${previewUrl}/markets?symbol=VTI&explain=1`);
    await page.locator('[data-fund-explainer="VTI"]').waitFor();
    await record('long names open', width);

    // Portfolio uses the same research panel.
    await page.goto(`${previewUrl}/portfolio?explain=1`);
    await page.locator('[data-fund-explainer="VOO"]').waitFor();
    await record('portfolio open', width);

    // Compare securities: compact explainers and the difference strip.
    await page.goto(`${previewUrl}/markets?symbol=VOO`);
    await page.getByRole('button', { name: 'Compare securities' }).click();
    const second = page.getByRole('region', { name: 'Second security' }).getByLabel('Research a ticker symbol');
    await second.fill('VFIAX'); await second.press('Enter');
    await page.getByText('What’s the real difference?').waitFor();
    await page.locator('[data-compact-explainer="VFIAX"]').waitFor();
    const dialogOverflow = await page.getByRole('dialog', { name: 'Compare securities' }).evaluate(d => ({ scrollWidth: d.scrollWidth, clientWidth: d.clientWidth }));
    await record('compare dialog', width);
    results.push({ label: 'compare dialog inner', width, ...dialogOverflow });
    assert(dialogOverflow.scrollWidth <= dialogOverflow.clientWidth, 'dialog overflows');
    if (width === 375) { await page.getByRole('region', { name: 'What’s the real difference?' }).screenshot({ path: path.join(output, 'fund-difference-375.png') }); await page.locator('[data-compact-explainer="VFIAX"]').screenshot({ path: path.join(output, 'fund-compare-375.png') }); }
  }

  // A 502 hides the identity line and never blocks the chart.
  fundMode = 'error';
  await page.goto(`${previewUrl}/markets?symbol=VOO`);
  await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor();
  // One retry for a 5xx (queries.ts), then the line disappears; the chart was there all along.
  await page.locator('[data-fund-identity]').waitFor({ state: 'detached', timeout: 10000 });
  assert(await page.getByRole('group', { name: 'VOO interactive price chart' }).isVisible());

  await page.setViewportSize({ width: 1280, height: 900 });
  fundMode = 'ok';
  await page.goto(`${previewUrl}/markets?symbol=VOO&explain=1`);
  await explainer.waitFor();
  await page.getByRole('button', { name: 'Who runs it?' }).click();
  await page.screenshot({ path: path.join(output, 'fund-explainer-desktop.png'), fullPage: false });

  assert.deepEqual(errors, []);
  console.table(results);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
