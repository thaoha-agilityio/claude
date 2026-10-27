import { NavLink, Outlet } from 'react-router-dom'
import styles from './Layout.module.css'

const links = [
  { to: '/', label: 'Expenses' },
  { to: '/categories', label: 'Categories' },
  { to: '/reports', label: 'Reports' },
]

export default function Layout() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Expense Tracker</h1>
        <nav className={styles.nav} aria-label="Main">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}
