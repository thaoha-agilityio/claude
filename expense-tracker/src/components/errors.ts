import { NotFoundError, ValidationError } from '../storage/repository'

export const SAVE_FAILED = 'Could not save changes. Check your connection and try again.'
export const NOT_FOUND = 'This item no longer exists. It may have been deleted in another tab.'

/** User-facing message for an error thrown by a store action, preferring the given field's validation message. */
export function errorMessage(err: unknown, field?: string): string {
  if (err instanceof ValidationError) {
    const errors = err.errors as Record<string, string | undefined>
    return (field && errors[field]) || err.message
  }
  if (err instanceof NotFoundError) return NOT_FOUND
  console.error(err)
  return SAVE_FAILED
}
