export type Category = { id: string; name: string; createdAt: string }

export type Expense = {
  id: string
  amount: number // integer VND
  date: string // YYYY-MM-DD calendar date
  categoryId: string
  notes: string
  createdAt: string // UTC ISO timestamp
  updatedAt: string // UTC ISO timestamp
}

export type StoreData = { version: 1; categories: Category[]; expenses: Expense[] }
