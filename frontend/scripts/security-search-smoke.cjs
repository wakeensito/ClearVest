// Unified beginner search phone check (DESIGN.md §4.17). Start a dev server first, e.g.
//   npx vite --port 5176 --strictPort   (from frontend/)
//   CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 node scripts/security-search-smoke.cjs
// Every API call is intercepted: contract examples, plus /market/fund and /market/search fixtures.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const previewUrl = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5176';
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
  symbol: 'VOO', name: 'Vanguard S&P 500 ETF', kind: 'etf', isIndexFund: true, leveraged: false, tracks: "Standard & Poor's 500 Index",
  expenseRatio: 0.0003, topHoldings: TOP_TEN,
  summary: 'VOO is a fund that owns shares of about 500 of the biggest U.S. companies. When they do well, it does well.',
  summarySource: 'template', asOf: '2026-09-26', stale: false, fundFamily: 'Vanguard', category: 'Large Blend', sector: null,
};
const AAPL = { symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', isIndexFund: false, leveraged: false, tracks: null, expenseRatio: null, topHoldings: [], summary: 'Apple makes the iPhone, Mac and other devices.', summarySource: 'model', asOf: '2026-09-26', stale: false, fundFamily: null, category: null, sector: 'Technology' };
const FUNDS = {
  VOO,
  FXAIX: { ...VOO, symbol: 'FXAIX', name: 'Fidelity 500 Index Fund', kind: 'mutual_fund', expenseRatio: 0.00015, fundFamily: 'Fidelity', summary: 'FXAIX is a mutual fund that owns shares of about 500 of the biggest U.S. companies.' },
  AAPL,
};
// Any other fund the list offers: a plain index fund, so the identity line and explainer load.
const fundFor = symbol => FUNDS[symbol] ?? (/^[A-Z]{4}X$/.test(symbol)
  ? { ...FUNDS.FXAIX, symbol, name: `${symbol} Index Fund`, fundFamily: null }
  : { ...VOO, symbol, name: `${symbol} ETF`, fundFamily: null });

const hit = (symbol, name, kind, extra = {}) => ({ symbol, name, exchange: 'NASDAQ', kind, leveraged: false, source: 'both', ...extra });
const SEARCH = {
  apple: [hit('AAPL', 'Apple Inc.', 'stock'), hit('APLE', 'Apple Hospitality REIT, Inc.', 'stock', { exchange: 'NYSE' })],
  fidelity: [hit('FIS', 'Fidelity National Information Services, Inc.', 'stock', { exchange: 'NYSE' }), hit('FNF', 'Fidelity National Financial, Inc.', 'stock', { exchange: 'NYSE' })],
  vanguard: [hit('VOO', 'Vanguard S&P 500 ETF', 'etf', { exchange: 'NYSE Arca' }), hit('VGRD', 'Vanguard Holdings Corp', 'stock')],
  microsoft: [hit('MSFT', 'Microsoft Corporation', 'stock')],
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const searches = [];
  await context.route('http://127.0.0.1:4010/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method().toLowerCase();
    let body;
    if (url.pathname === '/market/fund') body = fundFor(url.searchParams.get('symbol'));
    else if (url.pathname === '/market/search') {
      const query = (url.searchParams.get('query') || '').trim().toLowerCase();
      searches.push(query);
      const exact = /^[a-z0-9.^-]{1,6}$/.test(query) ? [hit(query.toUpperCase(), query.toUpperCase(), /^[A-Z]{4}X$/.test(query.toUpperCase()) ? 'mutual_fund' : 'stock')] : [];
      body = { results: SEARCH[query] ?? exact, unavailable: [], stale: false };
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
  const results = [];
  const record = async (label, width) => {
    const o = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    results.push({ label, width, ...o });
    assert(o.scrollWidth <= o.innerWidth, `${label} at ${width}px overflows: ${o.scrollWidth} > ${o.innerWidth}`);
  };
  // Markets titles the panel "Price history"; Portfolio keeps the default "Security research".
  const panel = () => page.getByRole('region', { name: /^(Price history|Security research)$/ });
  const box = () => panel().getByRole('combobox', { name: 'Find a stock or fund' });
  const dialog = page.locator('dialog[open]');
  const param = name => new URL(page.url()).searchParams.get(name);

  for (const width of [320, 375, 393]) {
    await page.setViewportSize({ width, height: 812 });

    // 8 rows + the explainer open: nothing widens the page; the list is in flow and never scrolls.
    await page.goto(`${previewUrl}/markets?symbol=VOO&explain=1`);
    await page.locator('[data-fund-explainer="VOO"]').waitFor();
    await page.getByText('VOO · Index fund (ETF)').waitFor();
    await box().fill('index fund');
    const listbox = panel().getByRole('listbox');
    await listbox.waitFor();
    assert.equal(await listbox.getByRole('option').count(), 8, '"index fund" fills the list');
    const families = await listbox.getByRole('option').evaluateAll(options => [...new Set(options.map(o => o.textContent.match(/Vanguard|Fidelity|Schwab|iShares|SPDR|Invesco/)?.[0]).filter(Boolean))]);
    assert(families.length >= 3, `"index fund" spans fund families: ${families}`);
    const layout = await listbox.evaluate(list => {
      const input = list.parentElement.querySelector('input').getBoundingClientRect();
      return { position: getComputedStyle(list).position, below: list.getBoundingClientRect().top >= input.bottom, scrolls: list.scrollHeight > list.clientHeight };
    });
    assert.deepEqual(layout, { position: 'static', below: true, scrolls: false }, 'inline list under the input');
    const rowHeights = await listbox.getByRole('option').evaluateAll(options => options.map(o => o.getBoundingClientRect().height));
    assert(rowHeights.every(h => h >= 44), `44px rows: ${rowHeights}`);
    assert.equal(await page.locator('[data-fund-explainer="VOO"]').count(), 1, 'the explainer stays open');
    await record('8 rows + explainer open', width);
    if (width === 375) await listbox.screenshot({ path: path.join(output, 'security-search-index-fund-375.png') });
    await page.getByRole('status').filter({ hasText: '8 results for “index fund”' }).waitFor({ state: 'attached' });

    // Two groups ("Fidelity": curated funds, then provider companies) get headers.
    await box().fill('fidelity');
    await listbox.getByText('Companies', { exact: true }).waitFor();
    if (width === 320) await listbox.screenshot({ path: path.join(output, 'security-search-fidelity-320.png') });
    assert.equal(await listbox.getByText('Funds', { exact: true }).count(), 1);
    await record('grouped list (fidelity)', width);

    // ArrowDown twice + Enter researches the second row and updates ?symbol=.
    await box().fill('index fund');
    await listbox.waitFor();
    const second = await listbox.getByRole('option').nth(1).locator('.t-mono, [class*="symbol"]').first().textContent();
    await box().press('ArrowDown'); await box().press('ArrowDown');
    assert.match(await box().getAttribute('aria-activedescendant'), /-1$/);
    await box().press('Enter');
    await page.waitForFunction(symbol => new URL(location.href).searchParams.get('symbol') === symbol, second);
    await page.locator(`[data-fund-explainer="${second}"]`).waitFor();
    assert.equal(await box().inputValue(), second);
    // Markets re-keys the panel on a new symbol and moves focus to the research heading (existing §4.9 rule).
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-research-heading')), true);
    await page.locator('[data-fund-identity]').filter({ hasText: second }).waitFor();

    // Done in the explainer puts focus back in the search.
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('[data-fund-explainer]').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'combobox', 'Done refocuses the search');

    // Shift+Enter on FXAIX: the compare dialog, compare=FXAIX, and the difference strip.
    await page.goto(`${previewUrl}/markets?symbol=VOO`);
    await page.getByText('VOO · Index fund (ETF)').waitFor();
    await box().fill('fxaix');
    await listbox.getByRole('option', { name: /FXAIX/ }).waitFor();
    await listbox.getByText('Same index as VOO').waitFor();
    if (width === 320) await listbox.screenshot({ path: path.join(output, 'security-search-fxaix-320.png') });
    const compareButton = listbox.getByRole('button', { name: 'Compare with VOO' }).first();
    assert.equal(await compareButton.getAttribute('tabindex'), '-1');
    await box().press('ArrowDown');
    await box().press('Shift+Enter');
    await dialog.waitFor();
    assert.equal(param('compare'), 'FXAIX');
    assert.equal(param('symbol'), 'VOO');
    await page.getByRole('region', { name: 'What’s the real difference?' }).waitFor();
    await page.getByText('the same top companies', { exact: false }).first().waitFor();
    await record('compare dialog (search)', width);
    if (width === 375) await page.screenshot({ path: path.join(output, 'security-search-compare-375.png'), fullPage: false });

    // Esc inside the dialog's own search closes the list, then clears, and never closes the dialog.
    const inner = page.getByRole('region', { name: 'Second security' }).getByRole('combobox');
    await inner.fill('index fund');
    await page.getByRole('region', { name: 'Second security' }).getByRole('listbox').waitFor();
    await inner.press('Escape');
    assert.equal(await page.getByRole('region', { name: 'Second security' }).getByRole('listbox').count(), 0);
    await inner.press('Escape');
    assert.equal(await inner.inputValue(), '');
    assert.equal(await dialog.count(), 1, 'Esc in the search never closes the dialog');

    // Back closes it and drops the param.
    await page.goBack();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(param('compare'), null);
    assert.equal(param('symbol'), 'VOO');

    // Esc twice on the page: close the list, then clear the box; the explainer stays open.
    await page.goto(`${previewUrl}/markets?symbol=VOO&explain=1`);
    await page.locator('[data-fund-explainer="VOO"]').waitFor();
    await box().fill('bonds');
    await listbox.waitFor();
    await box().press('Escape');
    await listbox.waitFor({ state: 'detached' });
    assert.equal(await box().inputValue(), 'bonds');
    await box().press('Escape');
    assert.equal(await box().inputValue(), '');
    assert.equal(await page.locator('[data-fund-explainer="VOO"]').count(), 1, 'Esc in the search never closes the explainer');
    // Empty box: chips, each 44px, wrapping at 320 without overflow.
    const chips = panel().getByRole('button', { name: 'index fund', exact: true });
    await chips.waitFor();
    const chipHeights = await panel().locator('[data-search-chips] button').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    assert(chipHeights.length === 5 && chipHeights.every(h => h >= 44), `chips: ${chipHeights}`);
    await record('chips (empty box)', width);
    await chips.click();
    await listbox.waitFor();
    assert.equal(await box().inputValue(), 'index fund');

    // Portfolio has no dialog: Compare goes to Markets, which opens it from ?compare=.
    await page.goto(`${previewUrl}/portfolio`);
    await page.getByText('VOO · Index fund (ETF)').waitFor();
    await box().fill('fxaix');
    await panel().getByRole('button', { name: 'Compare with VOO' }).first().click();
    await page.waitForURL(url => url.pathname === '/markets' && url.searchParams.get('compare') === 'FXAIX' && url.searchParams.get('symbol') === 'VOO');
    await dialog.waitFor();
    await page.getByRole('region', { name: 'What’s the real difference?' }).waitFor();
    await record('compare dialog (from portfolio)', width);
    // Exit (no pushed entry here) replaces the URL without compare.
    await page.getByRole('button', { name: 'Exit comparison' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(param('compare'), null);

    // Compare companies lists companies only.
    await page.goto(`${previewUrl}/markets?view=companies`);
    const finder = page.getByRole('combobox', { name: 'Find a company by name or ticker' });
    await finder.waitFor();
    assert.equal(await page.getByRole('button', { name: 'index fund', exact: true }).count(), 0, 'no fund chips');
    await finder.fill('vanguard');
    const companyList = page.getByRole('listbox');
    await companyList.getByRole('option', { name: /VGRD/ }).waitFor();
    assert.equal(await companyList.getByRole('option', { name: /VOO/ }).count(), 0, 'no fund rows');
    assert.equal(await companyList.getByText('Compare with', { exact: false }).count(), 0);
    await record('compare companies list', width);
  }

  // Gating: a one-letter box or a question never calls the provider.
  await page.goto(`${previewUrl}/markets?symbol=VOO`);
  await page.getByText('VOO · Index fund (ETF)').waitFor();
  await page.waitForTimeout(500);
  searches.length = 0;
  await box().fill('v');
  await panel().getByRole('option', { name: 'Look up V as a ticker' }).waitFor();
  await box().fill('what is an index fund?');
  await panel().getByRole('option', { name: /Ask the advisor/ }).waitFor();
  await page.waitForTimeout(500);
  assert.deepEqual(searches, [], 'no provider call for one letter or a question');
  await box().press('Enter');
  await page.waitForURL(url => url.pathname === '/advisor' && url.searchParams.get('q') === 'what is an index fund?');

  assert.deepEqual(errors, []);
  console.table(results);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
