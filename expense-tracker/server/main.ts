import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createRepository } from '../src/storage/repository'
import { createApp } from './app'
import { listenAddress } from './config'
import { FileStorage } from './fileStorage'

const { host, port } = listenAddress(process.env)
const dataDir = resolve(process.env.DATA_DIR ?? 'data')
// For end-to-end tests only: POST /api/__reset deletes all data and starts again from the seeded defaults.
const allowReset = process.env.API_RESET === '1'

const storage = new FileStorage(dataDir)
let handle = createApp(createRepository({ storage }))

const server = createServer((req, res) => {
  if (allowReset && req.method === 'POST' && req.url === '/api/__reset') {
    storage.clear()
    handle = createApp(createRepository({ storage }))
    res.writeHead(204).end()
    return
  }
  void handle(req, res)
})

server.listen(port, host, () => {
  console.log(`Expense API on http://${host.includes(':') ? `[${host}]` : host}:${port}/api (data in ${dataDir})${allowReset ? ', reset enabled' : ''}`)
})
