import { ApiRequestError, createHttpApi } from './http'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('sends JSON to the right URL and returns the parsed body', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(200, { id: 'a b', name: 'Trips', createdAt: '' }))
  const api = createHttpApi('/api', fetchImpl)

  await expect(api.renameCategory('a b', 'Trips')).resolves.toMatchObject({ name: 'Trips' })
  expect(fetchImpl).toHaveBeenCalledWith('/api/categories/a%20b', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name":"Trips"}',
  })
})

test('resolves to undefined for 204 No Content', async () => {
  const api = createHttpApi('/api', async () => new Response(null, { status: 204 }))
  await expect(api.deleteExpense('x')).resolves.toBeUndefined()
})

test('reports an unreachable server as ApiRequestError', async () => {
  const api = createHttpApi('/api', async () => {
    throw new TypeError('Failed to fetch')
  })
  await expect(api.getData()).rejects.toThrow(new ApiRequestError('Could not reach the server: Failed to fetch'))
})

test('reports an unexpected error response with its status', async () => {
  const api = createHttpApi('/api', async () => new Response('<html>Bad gateway</html>', { status: 502 }))
  await expect(api.getData()).rejects.toMatchObject({ name: 'ApiRequestError', status: 502 })
})

test('reports an unreadable success response', async () => {
  const api = createHttpApi('/api', async () => new Response('not json', { status: 200 }))
  await expect(api.getData()).rejects.toThrow('unreadable response')
})
