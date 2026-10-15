import { addExpense, expect, test } from './fixtures'

test('category CRUD, with delete blocked while in use', async ({ page }) => {
  await page.goto('/categories')
  const list = page.getByRole('list', { name: 'Categories' })
  await expect(list.getByRole('listitem')).toHaveCount(8)

  // Add, and reject a case-insensitive duplicate.
  await page.getByLabel('New category').fill('Pets')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(list.getByText('Pets', { exact: true })).toBeVisible()
  await page.getByLabel('New category').fill('pets')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('alert')).toHaveText('A category with this name already exists')

  // Rename
  await page.getByRole('button', { name: 'Rename Pets' }).click()
  await page.getByRole('textbox', { name: 'New name for Pets' }).fill('Animals')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(list.getByText('Animals', { exact: true })).toBeVisible()

  // Use it in an expense; the expense list shows the renamed category.
  await page.getByRole('link', { name: 'Expenses' }).click()
  await addExpense(page, { amount: '50000', date: '2026-10-15', category: 'Animals' })
  await expect(page.getByRole('table', { name: 'Expenses' })).toContainText('Animals')

  // Delete is blocked while in use.
  await page.getByRole('link', { name: 'Categories' }).click()
  await page.getByRole('button', { name: 'Delete Animals' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveText('Used by 1 expense — reassign them first.')

  // Remove the expense, then delete succeeds and survives a reload.
  await page.getByRole('link', { name: 'Expenses' }).click()
  await page.getByRole('button', { name: /^Delete Animals/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('link', { name: 'Categories' }).click()
  await page.getByRole('button', { name: 'Delete Animals' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(list.getByText('Animals', { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(list.getByRole('listitem')).toHaveCount(8)
  await expect(list.getByText('Animals', { exact: true })).toHaveCount(0)
})
