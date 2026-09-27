// Browser contract/UX checks with fixtures, not a live Bedrock quality evaluation.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const url = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    let release, submitted, response;
    await context.route('http://127.0.0.1:4010/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let body = contract.paths[pathname]?.[route.request().method().toLowerCase()]?.responses?.['200']?.content?.['application/json']?.example || {};
      if (pathname === '/advisor/chat') {
        submitted = route.request().postDataJSON();
        await new Promise(resolve => { release = resolve; });
        body = response;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    const waitForCall = async () => {
      const deadline = Date.now() + 5000;
      while (!release && Date.now() < deadline) await page.waitForTimeout(20);
      assert(release, 'Expected an advisor request within five seconds');
    };
    await page.goto(url);
    await page.getByRole('button', { name: 'Ask Scout', exact: true }).click();
    await page.getByRole('button', { name: 'Explain my portfolio' }).click();
    await page.waitForFunction(() => document.querySelector('[data-state="thinking"]'));
    await waitForCall();
    assert.equal(submitted.grounded, true);
    response = { reply: 'NVDA makes up 60% of your saved portfolio.', userMessage: submitted.message,
      disclaimer: 'Educational information.', safety: { status: 'passed', grounding: 'checked' },
      sources: [{ label: 'Saved portfolio and computed risk', asOf: '2026-09-26', text: 'NVDA: 60% of portfolio value. Risk score: 70/100.' }] };
    release(); release = null;
    await page.getByText('Checked against your portfolio · [1] View source').click();
    await page.getByText('NVDA: 60% of portfolio value. Risk score: 70/100.', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Open full Advisor' }).click();
    await page.getByText('Checked against your portfolio · [1] View source').waitFor();
    await page.getByRole('navigation', { name: 'Primary' }).first().getByRole('link', {name:'Home',exact:true}).click();
    await page.getByRole('button', { name: 'Ask Scout', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Your question for Scout' });
    await input.fill('My email is private@example.com. Explain an ETF.');
    await input.press('Enter');
    await waitForCall();
    assert.equal(submitted.grounded, false, 'A follow-up is ordinary chat, not falsely certified grounding');
    assert(!await page.evaluate(() => JSON.stringify(localStorage).includes('private@example.com')), 'Pending raw text must not reach storage');
    response = {reply:'An ETF holds a collection of investments.', userMessage:'My email is {EMAIL}. Explain an ETF.',
      disclaimer:'Educational information.', safety:{status:'passed',grounding:'not_requested'}};
    release(); release = null;
    await page.getByText('My email is {EMAIL}. Explain an ETF.',{exact:true}).waitFor();
    assert(!await page.evaluate(() => JSON.stringify(localStorage).includes('private@example.com')));
    await input.fill('Should I put all my savings in NVDA?');
    await input.press('Enter');
    await waitForCall();
    response={reply:'I can explain risk, but cannot choose a stock for your savings.',userMessage:submitted.message,
      disclaimer:'Educational information.',safety:{status:'intervened',grounding:'not_requested'}};
    release(); release=null;
    await page.getByText('Safety boundary applied', {exact:true}).waitFor();
    assert.equal(await page.getByText('Checked against your portfolio · [1] View source').count(),1);
    await input.fill('Do not persist unchecked@example.com');
    await input.press('Enter');
    await waitForCall();
    response={reply:'The advisor is unavailable right now.',disclaimer:'Educational information.',safety:{status:'unavailable',grounding:'unavailable'}};
    release();
    await page.getByText('Safety checks unavailable · no model answer shown',{exact:true}).waitFor();
    assert(!await page.evaluate(() => JSON.stringify(localStorage).includes('unchecked@example.com')));
    console.log('PASS: explicit source QA; inspectable source; Advisor handoff; ordinary follow-up; masked storage; intervention receipt; unavailable check fails closed. Fixtures only.');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exit(1); });
