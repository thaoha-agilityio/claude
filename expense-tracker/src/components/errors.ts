import { ValidationError } from '../storage/repository'

export const SAVE_FAILED = 'Could not save changes. Browser storage may be full or unavailable.'

/** User-facing message for an error thrown by a store action, preferring the given field's validation message. */
export function errorMessage(err: unknown, field?: string): string {
  if (err instanceof ValidationError) {
    const errors = err.errors as Record<string, string | undefined>
    return (field && errors[field]) || err.message
  }
  console.error(err)
  return SAVE_FAILED
}
