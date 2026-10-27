import type { ComponentProps } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CategoriesPage from './pages/CategoriesPage'
import ExpensesPage from './pages/ExpensesPage'
import ReportsPage from './pages/ReportsPage'
import { StoreProvider } from './state/StoreContext'

type Props = Omit<ComponentProps<typeof StoreProvider>, 'children'>

/** `api` and `initialData` go to the StoreProvider; leave them out to use the REST server. */
export default function App(props: Props) {
  return (
    <StoreProvider {...props}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ExpensesPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
