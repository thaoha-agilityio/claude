import { addExpense, expect, rowTexts, test } from './fixtures'

test('create, edit and delete an expense; changes survive a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Month', { exact: true })).toHaveValue('2026-10')
  await expect(page.getByText('No expenses this month.')).toBeVisible()

  // Create: amount is grouped as typed, date defaults to today in HCM.
  const form = page.getByRole('form', { name: 'Add expense' })
  await expect(form.getByLabel('Date')).toHaveValue('2026-10-15')
  await form.getByLabel('Amount (VND)').pressSequentially('1250000')
  await expect(form.getByLabel('Amount (VND)')).toHaveValue('1.250.000')
  await form.getByLabel('Category').selectOption({ label: 'Food' })
  await form.getByLabel('Notes').fill('Dinner')
  await form.getByRole('button', { name: 'Add expense' }).click()

  const table = page.getByRole('table', { name: 'Expenses' })
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect.poll(() => rowTexts(table)).toEqual([['15/10/2026', 'Food', '1.250.000 ₫', 'Dinner']])

  await page.reload()
  await expect.poll(() => rowTexts(table)).toEqual([['15/10/2026', 'Food', '1.250.000 ₫', 'Dinner']])

  // Edit
  await page.getByRole('button', { name: /^Edit Food/ }).click()
  const edit = page.getByRole('form', { name: 'Edit expense' })
  await expect(edit.getByLabel('Amount (VND)')).toHaveValue('1.250.000')
  await edit.getByLabel('Amount (VND)').fill('99000')
  await edit.getByLabel('Category').selectOption({ label: 'Transport' })
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('form', { name: 'Add expense' })).toBeVisible()
  await expect.poll(() => rowTexts(table)).toEqual([['15/10/2026', 'Transport', '99.000 ₫', 'Dinner']])

  await page.reload()
  await expect.poll(() => rowTexts(table)).toEqual([['15/10/2026', 'Transport', '99.000 ₫', 'Dinner']])

  // Delete
  await page.getByRole('button', { name: /^Delete Transport/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No expenses this month.')).toBeVisible()

  await page.reload()
  await expect(page.getByText('No expenses this month.')).toBeVisible()
})

test('shows validation errors and does not save invalid input', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add expense' }).click()
  const amount = page.getByLabel('Amount (VND)')
  await expect(amount).toBeFocused()
  await expect(amount).toHaveAccessibleDescription('Enter an amount in whole VND, e.g. 50.000')
  await expect(page.getByLabel('Category')).toHaveAccessibleDescription('Choose a category')
  await expect(page.getByText('No expenses this month.')).toBeVisible()
})

test('lists only the selected month, newest first', async ({ page }) => {
  await page.goto('/')
  await addExpense(page, { amount: '30000', date: '2026-10-01', category: 'Food', notes: 'early' })
  await addExpense(page, { amount: '20000', date: '2026-10-14', category: 'Food', notes: 'late' })
  await addExpense(page, { amount: '10000', date: '2026-09-30', category: 'Food', notes: 'sept' })

  // Adding the September expense switched the list to September.
  const table = page.getByRole('table', { name: 'Expenses' })
  await expect(page.getByLabel('Month', { exact: true })).toHaveValue('2026-09')
  await expect.poll(() => rowTexts(table)).toEqual([['30/09/2026', 'Food', '10.000 ₫', 'sept']])

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect.poll(() => rowTexts(table)).toEqual([
    ['14/10/2026', 'Food', '20.000 ₫', 'late'],
    ['01/10/2026', 'Food', '30.000 ₫', 'early'],
  ])
})
