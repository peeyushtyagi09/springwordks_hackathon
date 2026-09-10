// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('reported UI defects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Reset via the app control so the sid cookie stays on this browser session
    await page.click('#resetBtn');
    await page.waitForTimeout(200);
    await expect(page.locator('#logRows tr').first()).toBeVisible({ timeout: 10000 });
  });

  // BUG 8 — UI · wrong-format-display
  // public/app.js: (log.minutes / 60).toFixed(0) rounds Hours to a whole number.
  test('bug 8: Hours column must show minutes/60 to one decimal place, not toFixed(0)', async ({
    page,
  }) => {
    const logs = await page.request.get('/api/logs').then((r) => r.json());
    const rowCount = await page.locator('#logRows tr').count();
    expect(rowCount, 'precondition: entries table should render seeded rows').toBe(
      logs.data.length,
    );

    for (let i = 0; i < logs.data.length; i++) {
      const minutes = logs.data[i].minutes;
      const expected = (minutes / 60).toFixed(1);
      const hoursCell = page.locator('#logRows tr').nth(i).locator('td').nth(4);
      const actual = (await hoursCell.textContent())?.trim();
      expect(
        actual,
        `bug 8 — row ${i}: minutes=${minutes} → Hours should be "${expected}" but was "${actual}". ` +
          `(log.minutes / 60).toFixed(0) rounds to a whole number.`,
      ).toBe(expected);
    }
  });

  // BUG 9 — UI · wrong-ui-copy-or-label
  // public/index.html: <h2>Anlytics</h2>
  test('bug 9: analytics panel heading must spell "Analytics"', async ({ page }) => {
    const heading = page.locator('h2').filter({ hasText: /An?lytics/i });
    await expect(heading).toBeVisible();
    const text = (await heading.textContent())?.trim();
    expect(
      text,
      `bug 9 — analytics heading is "${text}". index.html has <h2>Anlytics</h2> (missing 'a').`,
    ).toBe('Analytics');
  });

  // BUG 12 — UI · missing-ui-feedback-guard
  // public/app.js: showToast('Log added!') runs unconditionally; status never read.
  // Dispatch submit event (not a button click) so HTML5 max=480 from finding E does not
  // swallow the request — we still exercise the server 400 + toast path.
  test('bug 12: rejected POST must show an error toast, not unconditional "Log added!"', async ({
    page,
  }) => {
    await page.locator('#agentId').selectOption('AG1');
    await page.locator('#candidateId').selectOption('C1');
    await page.locator('#date').fill('2026-07-20');
    await page.locator('#minutes').fill('900');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/logs') && r.request().method() === 'POST'),
      page.locator('#logForm').evaluate((form) => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }),
    ]);
    expect(response.status(), 'precondition: 900 minutes must be rejected by server').toBe(400);

    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    const msg = (await toast.textContent())?.trim() || '';
    expect(
      msg === 'Log added!',
      `bug 12 — server returned 400 but toast was "${msg}". ` +
        `showToast('Log added!') runs unconditionally; fetch does not throw on 4xx and status is never read.`,
    ).toBe(false);
    expect(msg.length, 'error toast should carry a non-empty message').toBeGreaterThan(0);
  });

  // BUG 13 — UI · state-not-persisted
  // public/app.js: submit handler calls loadLogs() but never loadAnalytics().
  test('bug 13: successful submit must refresh analytics (call loadAnalytics)', async ({
    page,
  }) => {
    const before = await page.request.get('/api/analytics').then((r) => r.json());
    const ag1Before = before.find((a) => a.agentId === 'AG1');
    const entriesBefore = Number(
      (
        await page
          .locator('#analyticsRows tr')
          .filter({ hasText: ag1Before.name })
          .locator('td')
          .nth(1)
          .textContent()
      )?.trim(),
    );

    await page.locator('#agentId').selectOption('AG1');
    await page.locator('#candidateId').selectOption('C1');
    await page.locator('#date').fill('2026-07-23');
    await page.locator('#minutes').fill('30');

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/logs') &&
          r.request().method() === 'POST' &&
          r.status() < 300,
      ),
      page.click('#logForm button[type="submit"]'),
    ]);

    await page.waitForTimeout(500);

    const shown = Number(
      (
        await page
          .locator('#analyticsRows tr')
          .filter({ hasText: ag1Before.name })
          .locator('td')
          .nth(1)
          .textContent()
      )?.trim(),
    );
    const expectedCount = entriesBefore + 1;

    expect(
      shown,
      `bug 13 — after adding a log for ${ag1Before.name}, analytics Entries shows ${shown} but should be ${expectedCount} ` +
        `(was ${entriesBefore}). Submit handler calls loadLogs() but never loadAnalytics().`,
    ).toBe(expectedCount);
  });
});
