// Tap-to-explain jargon in advisor replies (DESIGN.md §4.14).
// Run with Vite on :5173 and the Prism mock on :4010 (npm run mock), or set CLEARVEST_PREVIEW_URL.
const { chromium } = require('playwright');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true });
  const errors = [];
  for (const [w, tag] of [[1440, 'desk'], [390, 'mob']]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    p.on('pageerror', e => errors.push(e.message));
    await p.route('http://127.0.0.1:4010/advisor/chat', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      reply: 'Start simple. **Index funds** spread your money across hundreds of companies, which gives you diversification in one purchase. Check the expense ratio: lower fees leave more for you.\n\n- An ETF trades like a stock during the day.\n- If you have a job with an employer match, a 401(k) is often the first stop.\n- A Roth IRA suits people who expect a higher tax rate later.\n\nWhen you research a single company, compare its P/E ratio with similar businesses.',
      disclaimer: 'ClearVest provides educational information, not financial advice.' }) }));
    await p.goto(base + '/advisor');
    await p.getByRole('textbox', { name: 'Your question' }).fill('How should a beginner start?');
    await p.keyboard.press('Enter');
    await p.getByRole('button', { name: 'Index funds: what does this mean?' }).waitFor({ timeout: 15000 });
    const related = p.getByRole('link', { name: /Related lesson/ });
    assert.equal(await related.getAttribute('href'), '/learn/funds');
    await p.getByRole('button', { name: 'expense ratio: what does this mean?' }).click();
    const dialog = p.getByRole('dialog', { name: 'Expense ratio explained' });
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('link').getAttribute('href'), '/learn/funds');
    const box = await dialog.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= w, 'popover inside viewport');
    await p.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert(await p.getByRole('button', { name: 'expense ratio: what does this mean?' }).evaluate(el => el === document.activeElement), 'focus returns');
    await p.getByRole('button', { name: 'P/E ratio: what does this mean?' }).click();
    assert.equal(await p.getByRole('dialog', { name: 'P/E ratio explained' }).getByRole('link').getAttribute('href'), '/markets?symbol=AAPL&guided=1');
    await p.mouse.click(5, 5); await p.getByRole('dialog').waitFor({ state: 'detached' });
    assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no overflow');
    await p.close();
  }
  assert.deepEqual(errors, []);
  console.log('Tap-to-explain checks passed: advisor terms, popover in viewport (desktop + 390px), lesson and research links, Escape/outside close, focus return, related lesson.'); await b.close();
})().catch(e => { console.error(e.message.slice(0, 600)); process.exit(1) });
