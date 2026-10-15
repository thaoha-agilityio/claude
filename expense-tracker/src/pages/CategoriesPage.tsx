import { useMemo } from 'react'
import CategoryForm from '../components/CategoryForm'
import CategoryList from '../components/CategoryList'
import { useStore } from '../state/store'

export default function CategoriesPage() {
  const { data, addCategory, renameCategory, deleteCategory } = useStore()

  const sorted = useMemo(
    () => [...data.categories].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [data.categories],
  )
  const usage = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of data.expenses) counts[e.categoryId] = (counts[e.categoryId] ?? 0) + 1
    return counts
  }, [data.expenses])

  return (
    <>
      <h2>Categories</h2>
      <CategoryForm onAdd={addCategory} />
      <CategoryList categories={sorted} usage={usage} onRename={renameCategory} onDelete={deleteCategory} />
    </>
  )
}
