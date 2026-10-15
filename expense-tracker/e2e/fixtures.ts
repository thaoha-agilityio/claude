import { test as base, expect, type Locator, type Page } from '@playwright/test'

/** 10:00 on 15 Oct 2026 in Ho Chi Minh City; every test starts with this clock and empty storage. */
export const NOW = new Date('2026-10-15T10:00:00+07:00')

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW)
    await use(page)
  },
})

export { expect }

export async function addExpense(
  page: Page,
  { amount, date, category, notes = '' }: { amount: string; date: string; category: string; notes?: string },
) {
  const form = page.getByRole('form', { name: 'Add expense' })
  await form.getByLabel('Amount (VND)').fill(amount)
  await form.getByLabel('Date').fill(date)
  await form.getByLabel('Category').selectOption({ label: category })
  await form.getByLabel('Notes').fill(notes)
  await form.getByRole('button', { name: 'Add expense' }).click()
}

/** Text of each body row's cells, e.g. ["14/10/2026", "Food", "50.000 ₫", "Lunch"]. NBSPs become spaces. */
export async function rowTexts(table: Locator, cells = 4): Promise<string[][]> {
  const rows = await table.locator('tbody tr').all()
  return Promise.all(
    rows.map(async (row) =>
      (await row.locator('th, td').allTextContents()).slice(0, cells).map((t) => t.replace(/\u00a0/g, ' ').trim()),
    ),
  )
}
