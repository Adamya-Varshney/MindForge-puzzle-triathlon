/* Browser test: plays every puzzle type at Level 1 and Level 10 and checks the attempt log and level gate.
   Usage: node build.js && npm run test:e2e   (needs Playwright: npm i -D playwright && npx playwright install chromium) */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const fail = msg => { errors.push(msg); };
  async function open(width, height, scheme) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('pageerror', e => fail('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) fail('console: ' + m.text()); });
    await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
    await page.waitForFunction(() => window.__pt && window.__pt.S.ready);
    return page;
  }
  const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const types = await (await open(400, 400, 'light')).evaluate(() => Object.keys(window.PT.TYPES));

  async function play(page, type, level) {
    await page.evaluate(([t, l]) => window.__pt.startPuzzle(t, l), [type, level]);
    await page.waitForFunction(() => window.__pt.S.cur && window.__pt.S.cur.view, null, { timeout: 20000 });
    const ov = await overflow(page);
    if (ov > 0) fail(`${type} L${level}: page scrolls sideways by ${ov}px`);
    await page.evaluate(() => window.__pt.S.cur.view.solve());
    const a = await page.evaluate(() => window.__pt.S.attempts[0]);
    if (a.puzzle_type !== type || a.outcome !== 'solved') fail(`${type} L${level}: outcome ${a.outcome}`);
    await page.click('#res-home');
    return a;
  }

  // Desktop, light: every type at Level 1. Two solves per lane unlock Level 2.
  const desk = await open(1200, 900, 'light');
  for (const t of types) await play(desk, t, 1);
  const level = await desk.evaluate(() => window.__pt.S.level);
  if (level !== 2) fail('expected Level 2 after clearing every lane, got ' + level);
  console.log('Level 1 cleared in every lane -> now Level', level);

  // Real input on Cross Math: wrong entry, Check, Hint, keyboard entry.
  await desk.click('.pz[data-type="crossmath"]');
  await desk.waitForFunction(() => window.__pt.S.cur && window.__pt.S.cur.view);
  const info = await desk.evaluate(() => { const p = window.__pt.S.cur.gen.puzzle, i = p.givens.indexOf(0); return { i, wrong: p.solution[i] === 9 ? 8 : 9 }; });
  await desk.locator('.cm .cell').nth(info.i).click();
  await desk.locator('#pad .btn').nth(info.wrong - 1).click();
  await desk.click('#t-check');
  if (await desk.locator('.cm .cell.wrong').count() !== 1) fail('Check did not mark the wrong Cross Math entry');
  await desk.click('#t-hint');
  await desk.click('#btn-back'); await desk.click('#btn-leave-yes');
  const left = await desk.evaluate(() => window.__pt.S.attempts[0]);
  if (left.outcome !== 'abandoned' || left.hints_used !== 1 || left.check_count !== 1) fail('abandoned attempt not logged correctly');
  console.log('Cross Math input, Check, Hint and abandon logged');

  // Phone, dark: every type at Level 10.
  const phone = await open(390, 800, 'dark');
  await phone.evaluate(() => { window.__pt.S.level = 10; });
  for (const t of types) { const a = await play(phone, t, 10); console.log(`L10 ${t.padEnd(10)} ok  ${a.difficulty_label}`); }

  await browser.close();
  if (errors.length) { console.error('\nFAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('\nAll browser checks passed');
})().catch(e => { console.error(e); process.exit(1); });
