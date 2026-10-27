import { addExpense, expect, test } from './fixtures'

test.use({ viewport: { width: 360, height: 740 } })

test('pages fit a phone-width screen without horizontal page scroll', async ({ page }) => {
  await page.goto('/')
  await addExpense(page, {
    amount: '1000000000',
    date: '2026-10-15',
    category: 'Entertainment',
    notes: 'A fairly long note that should wrap inside its cell rather than widen the page',
  })
  for (const path of ['/', '/categories', '/reports']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})
