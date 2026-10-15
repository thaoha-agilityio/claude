import { addExpense, expect, NOW, rowTexts, test } from './fixtures'

test('expenses added in two tabs are both kept, and each tab shows the other’s', async ({ page, context }) => {
  await page.goto('/')
  const tabB = await context.newPage()
  await tabB.clock.setFixedTime(NOW)
  await tabB.goto('/')

  await addExpense(page, { amount: '50000', date: '2026-10-14', category: 'Food', notes: 'From A' })
  await addExpense(tabB, { amount: '30000', date: '2026-10-13', category: 'Transport', notes: 'From B' })

  const expected = [
    ['14/10/2026', 'Food', '50.000 ₫', 'From A'],
    ['13/10/2026', 'Transport', '30.000 ₫', 'From B'],
  ]
  for (const p of [page, tabB]) {
    await expect.poll(() => rowTexts(p.getByRole('table', { name: 'Expenses' }))).toEqual(expected)
  }

  await page.reload()
  await expect.poll(() => rowTexts(page.getByRole('table', { name: 'Expenses' }))).toEqual(expected)
})
