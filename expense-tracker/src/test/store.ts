import { createLocalApi } from '../api/api'
import { createRepository, type Repository } from '../storage/repository'

/**
 * StoreProvider props that keep data in this test's localStorage instead of calling the server,
 * with the data already loaded so pages render straight away.
 */
export function localStore(repo: Repository = createRepository()) {
  return { api: createLocalApi(repo), initialData: repo.getData() }
}
