import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  // Server tests run in the node environment, which has no localStorage.
  globalThis.localStorage?.clear()
})

afterEach(() => {
  cleanup()
})
