// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('ADDITIONAL UI findings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#resetBtn');
    await page.waitForTimeout(200);
    await expect(page.locator('#analyticsRows tr').first()).toBeVisible({ timeout: 10000 });
  });

  // ADDITIONAL B — UI · analytics columns bound to the wrong fields
  // public/app.js loadAnalytics: renders avgMinutes, totalHours, totalMinutes under
  // headings Total Minutes, Total Hours, Avg Minutes/Entry (cols 3 and 5 transposed).
  test('ADDITIONAL B: analytics columns must match heading field names', async ({ page }) => {
    const apiRows = await page.request.get('/api/analytics').then((r) => r.json());
    const headings = await page
      .locator('section.card')
      .filter({ has: page.locator('#analyticsRows') })
      .locator('thead th')
      .allTextContents();

    expect(headings.map((h) => h.trim())).toEqual([
      'Agent',
      'Entries',
      'Total Minutes',
      'Total Hours',
      'Avg Minutes/Entry',
    ]);

    for (let i = 0; i < apiRows.length; i++) {
      const r = apiRows[i];
      const cells = page.locator('#analyticsRows tr').nth(i).locator('td');
      const texts = [];
      for (let c = 0; c < 5; c++) {
        texts.push(((await cells.nth(c).textContent()) || '').trim());
      }

      expect(
        texts[0],
        `ADDITIONAL B — Agent cell should be name ${r.name}, got ${texts[0]}`,
      ).toBe(r.name);
      expect(
        texts[1],
        `ADDITIONAL B — Entries should be ${r.entryCount}, got ${texts[1]}`,
      ).toBe(String(r.entryCount));
      expect(
        Math.abs(Number(texts[2]) - Number(r.totalMinutes)) < 0.05,
        `ADDITIONAL B — Total Minutes cell "${texts[2]}" !== API totalMinutes ${r.totalMinutes}. ` +
          `app.js binds avgMinutes into this column (transposed with Avg Minutes/Entry).`,
      ).toBe(true);
      expect(
        Math.abs(Number(texts[3]) - Number(r.totalHours)) < 0.05,
        `ADDITIONAL B — Total Hours cell "${texts[3]}" !== API totalHours ${r.totalHours}`,
      ).toBe(true);
      expect(
        Math.abs(Number(texts[4]) - Number(r.avgMinutes)) < 0.05,
        `ADDITIONAL B — Avg Minutes/Entry cell "${texts[4]}" !== API avgMinutes ${r.avgMinutes}. ` +
          `app.js binds totalMinutes into this column.`,
      ).toBe(true);
    }
  });

  // ADDITIONAL E — UI · no client-side validation on the form
  // public/index.html: #minutes has placeholder only — no min/max/step/required.
  test('ADDITIONAL E: #minutes must expose min/max/step/required; empty submit fires no POST', async ({
    page,
  }) => {
    const minutes = page.locator('#minutes');
    await expect(minutes, 'ADDITIONAL E — missing min="1"').toHaveAttribute('min', '1');
    await expect(minutes, 'ADDITIONAL E — missing max="480"').toHaveAttribute('max', '480');
    await expect(minutes, 'ADDITIONAL E — missing step="1"').toHaveAttribute('step', '1');
    await expect(minutes, 'ADDITIONAL E — missing required').toHaveAttribute('required', '');

    let postCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/logs') && req.method() === 'POST') postCount += 1;
    });

    await page.locator('#minutes').fill('');
    await page.click('#logForm button[type="submit"]');
    await page.waitForTimeout(300);
    expect(
      postCount,
      'ADDITIONAL E — empty form submitted a POST; browser should block when required/min constraints are present',
    ).toBe(0);
  });

  // ADDITIONAL F — UI · the date field defaults to a hardcoded date
  // public/index.html: <input type="date" id="date" value="2026-07-24">
  test('ADDITIONAL F: #date must default to today or empty, not a hardcoded literal', async ({
    page,
  }) => {
    const value = await page.locator('#date').inputValue();
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const ok = value === '' || value === todayStr;
    expect(
      ok,
      `ADDITIONAL F — #date value="${value}" is a hardcoded literal (index.html ships value="2026-07-24"). ` +
        `Expected today's ${todayStr} or empty.`,
    ).toBe(true);
  });

  // ADDITIONAL H — UI · the Date column is not reformatted
  // public/app.js: <td>${log.date}</td> — raw YYYY-MM-DD; distinct from bug 8 (Hours).
  test('ADDITIONAL H: Date column must be DD-MM-YYYY, not raw API YYYY-MM-DD', async ({
    page,
  }) => {
    const rows = page.locator('#logRows tr');
    const n = await rows.count();
    expect(n, 'precondition: seeded entries visible').toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      const dateText = ((await rows.nth(i).locator('td').nth(2).textContent()) || '').trim();
      expect(
        /^\d{2}-\d{2}-\d{4}$/.test(dateText),
        `ADDITIONAL H — Date cell "${dateText}" does not match DD-MM-YYYY. ` +
          `app.js renders raw log.date; distinct from reported bug 8 (Hours column).`,
      ).toBe(true);
    }
  });
});
