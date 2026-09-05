import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:54321/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: '[]'
    })
  );
});
for (const width of [375, 768, 1440])
  test(`homepage is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to ResearchHub BNHS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recently Added Research' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'A growing collection of knowledge' })
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    if (width < 1000) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    }
    await page.screenshot({ path: `test-results/homepage-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Browse Research', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Browse Research', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
test('information routes, login and private routes behave correctly', async ({ page }) => {
  for (const [path, title] of [
    ['/about', 'About ResearchHub BNHS'],
    ['/guidelines', 'Submission Guidelines'],
    ['/contact', 'Contact the School']
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await page.goto('/student/progress');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
test('catalogue failure is visible and retry recovers', async ({ page }) => {
  let failed = true;
  await page.route('**/rest/v1/public_research_previews**', (route) =>
    route.fulfill({
      status: failed ? 500 : 200,
      contentType: 'application/json',
      body: failed ? '{"message":"offline"}' : '[]'
    })
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  failed = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'A growing collection of knowledge' })
  ).toBeVisible();
});
