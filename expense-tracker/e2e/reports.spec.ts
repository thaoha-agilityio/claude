import { addExpense, expect, rowTexts, test } from './fixtures'

test('monthly report across two months', async ({ page }) => {
  await page.goto('/')
  await addExpense(page, { amount: '100000', date: '2026-10-01', category: 'Food' })
  await addExpense(page, { amount: '50000', date: '2026-10-31', category: 'Food' })
  await addExpense(page, { amount: '50000', date: '2026-10-15', category: 'Transport' })
  await addExpense(page, { amount: '300000', date: '2026-09-30', category: 'Housing' })

  await page.getByRole('link', { name: 'Reports' }).click()
  await expect(page.getByLabel('Month', { exact: true })).toHaveValue('2026-10')
  await expect(page.getByText(/^Total:/)).toHaveText(/Total: 200\.000\s₫/)

  const table = page.getByRole('table', { name: 'Expenses by category' })
  await expect.poll(() => rowTexts(table)).toEqual([
    ['Food', '2', '150.000 ₫', '75%'],
    ['Transport', '1', '50.000 ₫', '25%'],
  ])
  await expect(table.locator('tfoot')).toContainText('100%')

  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByText(/^Total:/)).toHaveText(/Total: 300\.000\s₫/)
  await expect.poll(() => rowTexts(table)).toEqual([['Housing', '1', '300.000 ₫', '100%']])

  await page.getByLabel('Month', { exact: true }).fill('2026-08')
  await expect(page.getByText('No expenses this month.')).toBeVisible()

  await page.reload()
  await expect(page.getByText(/^Total:/)).toHaveText(/Total: 200\.000\s₫/)
})
