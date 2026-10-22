import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHttpApi } from '../src/api/http'
import { createMcpServer } from './server'

// stdout carries the MCP protocol, so anything else goes to stderr.
const apiUrl = process.env.EXPENSE_API_URL ?? 'http://127.0.0.1:3001/api'
const server = createMcpServer(createHttpApi(apiUrl), { apiUrl })
await server.connect(new StdioServerTransport())
console.error(`expense-tracker MCP server ready (API: ${apiUrl})`)
