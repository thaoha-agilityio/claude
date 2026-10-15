import { CategoryInUseError, createRepository, NotFoundError, ValidationError, type ExpenseInput } from './repository'
import { STORAGE_KEY } from './storage'

let clock: Date
let counter: number
const deps = () => ({ now: () => clock, newId: () => `id-${++counter}` })

beforeEach(() => {
  clock = new Date('2026-10-14T03:00:00.000Z')
  counter = 0
})

const setup = () => {
  const repo = createRepository(deps())
  const food = repo.getData().categories.find((c) => c.name === 'Food')!
  const input = (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({
    amount: 50000,
    date: '2026-10-14',
    categoryId: food.id,
    notes: '',
    ...overrides,
  })
  return { repo, food, input }
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!)

describe('expenses', () => {
  it('adds an expense with id, timestamps and trimmed notes, and persists it', () => {
    const { repo, input } = setup()
    const expense = repo.addExpense(input({ notes: '  Phở bò  ' }))

    expect(expense).toMatchObject({ amount: 50000, notes: 'Phở bò', createdAt: clock.toISOString() })
    expect(expense.updatedAt).toBe(expense.createdAt)
    expect(repo.getData().expenses).toEqual([expense])
    expect(stored().expenses).toEqual([expense])
  })

  it('survives a reload', () => {
    const { repo, input } = setup()
    const expense = repo.addExpense(input())
    expect(createRepository(deps()).getData().expenses).toEqual([expense])
  })

  it('updates fields and updatedAt but keeps id and createdAt', () => {
    const { repo, input } = setup()
    const original = repo.addExpense(input())
    clock = new Date('2026-10-15T00:00:00.000Z')

    const updated = repo.updateExpense(original.id, input({ amount: 75000, notes: 'edited' }))

    expect(updated).toMatchObject({ id: original.id, amount: 75000, notes: 'edited', createdAt: original.createdAt })
    expect(updated.updatedAt).toBe(clock.toISOString())
    expect(stored().expenses).toEqual([updated])
  })

  it('ignores extra fields when adding, so duplicating an expense gets a new id', () => {
    const { repo, input } = setup()
    const original = repo.addExpense(input())
    clock = new Date('2026-10-15T00:00:00.000Z')

    const copy = repo.addExpense({ ...original })

    expect(copy.id).not.toBe(original.id)
    expect(copy.createdAt).toBe(clock.toISOString())
    expect(stored().expenses).toEqual([original, copy])
  })

  it('ignores extra fields when updating, keeping createdAt and dropping unknown keys', () => {
    const { repo, input } = setup()
    const original = repo.addExpense(input())
    clock = new Date('2026-10-15T00:00:00.000Z')

    const tampered = { ...original, amount: 75000, id: 'other', createdAt: '2000-01-01T00:00:00.000Z', extra: 1 }
    const updated = repo.updateExpense(original.id, tampered)

    expect(updated).toEqual({ ...original, amount: 75000, updatedAt: clock.toISOString() })
    expect(stored().expenses).toEqual([updated])
  })

  it('deletes an expense', () => {
    const { repo, input } = setup()
    const a = repo.addExpense(input())
    const b = repo.addExpense(input({ amount: 1 }))
    repo.deleteExpense(a.id)
    expect(repo.getData().expenses).toEqual([b])
    expect(stored().expenses).toEqual([b])
  })

  it('rejects invalid input with field errors and changes nothing', () => {
    const { repo, input } = setup()
    const before = repo.getData()

    const err = catchError(() => repo.addExpense(input({ amount: 0, categoryId: 'missing' })))

    expect(err).toBeInstanceOf(ValidationError)
    expect(Object.keys((err as ValidationError<string>).errors).sort()).toEqual(['amount', 'categoryId'])
    expect(repo.getData()).toBe(before)
  })

  it('throws NotFoundError for unknown ids', () => {
    const { repo, input } = setup()
    expect(() => repo.updateExpense('nope', input())).toThrow(NotFoundError)
    expect(() => repo.deleteExpense('nope')).toThrow(NotFoundError)
  })
})

describe('categories', () => {
  it('adds a category with a trimmed name', () => {
    const { repo } = setup()
    const cat = repo.addCategory('  Education ')
    expect(cat).toMatchObject({ name: 'Education', createdAt: clock.toISOString() })
    expect(stored().categories).toContainEqual(cat)
  })

  it('rejects duplicate names, ignoring case', () => {
    const { repo } = setup()
    expect(() => repo.addCategory('food')).toThrow(ValidationError)
  })

  it('renames, allowing a change of case to its own name', () => {
    const { repo, food } = setup()
    expect(repo.renameCategory(food.id, 'FOOD').name).toBe('FOOD')
    expect(repo.renameCategory(food.id, ' Ăn uống ')).toEqual({ ...food, name: 'Ăn uống' })
  })

  it('rejects renaming to another category’s name', () => {
    const { repo, food } = setup()
    expect(() => repo.renameCategory(food.id, 'transport')).toThrow(/already exists/)
    expect(() => repo.renameCategory('nope', 'X')).toThrow(NotFoundError)
  })

  it('deletes an unused category', () => {
    const { repo } = setup()
    const cat = repo.addCategory('Temp')
    repo.deleteCategory(cat.id)
    expect(repo.getData().categories).not.toContainEqual(cat)
    expect(() => repo.deleteCategory(cat.id)).toThrow(NotFoundError)
  })

  it('blocks deleting a category in use, reporting the count', () => {
    const { repo, food, input } = setup()
    repo.addExpense(input())
    repo.addExpense(input())

    const err = catchError(() => repo.deleteCategory(food.id))

    expect(err).toBeInstanceOf(CategoryInUseError)
    expect((err as CategoryInUseError).count).toBe(2)
    expect((err as Error).message).toBe('Used by 2 expenses — reassign them first.')
    expect(repo.getData().categories).toContainEqual(food)
  })

  it('uses the singular for one expense', () => {
    expect(new CategoryInUseError(1).message).toBe('Used by 1 expense — reassign them first.')
  })
})

describe('two tabs sharing storage', () => {
  it('saves the seeded defaults on first run, so a second tab gets the same categories', () => {
    const a = createRepository(deps())
    expect(stored().categories).toEqual(a.getData().categories)
    expect(createRepository(deps()).getData().categories).toEqual(a.getData().categories)
  })

  it('keeps changes made in both tabs', () => {
    const { repo: tabA, input } = setup()
    const tabB = createRepository(deps())

    const fromA = tabA.addExpense(input({ notes: 'A' }))
    const fromB = tabB.addExpense(input({ notes: 'B' }))

    expect(tabB.getData().expenses).toEqual([fromA, fromB])
    expect(stored().expenses).toEqual([fromA, fromB])
  })

  it('validates against the other tab’s latest data', () => {
    const { repo: tabA, food, input } = setup()
    const tabB = createRepository(deps())
    tabA.addExpense(input())

    expect(() => tabB.deleteCategory(food.id)).toThrow(CategoryInUseError)
    expect(tabB.getData().expenses).toHaveLength(1)
  })

  it('reload() picks up another tab’s save and keeps the snapshot otherwise', () => {
    const { repo: tabA } = setup()
    const tabB = createRepository(deps())
    const before = tabB.getData()
    expect(tabB.reload()).toBe(before)

    tabA.addCategory('Pets')
    expect(tabB.reload().categories.map((c) => c.name)).toContain('Pets')
  })
})

describe('persistence failures', () => {
  it('leaves in-memory data unchanged and rethrows when saving fails', () => {
    const { repo, input } = setup()
    const before = repo.getData()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(() => repo.addExpense(input())).toThrow('full')
    expect(repo.getData()).toBe(before)
    setItem.mockRestore()
  })
})

function catchError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  throw new Error('Expected function to throw')
}
