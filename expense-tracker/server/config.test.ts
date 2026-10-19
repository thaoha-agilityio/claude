// @vitest-environment node
import { listenAddress } from './config'

describe('listenAddress', () => {
  it('listens only on loopback by default, because the API has no login', () => {
    expect(listenAddress({})).toEqual({ host: '127.0.0.1', port: 3001 })
  })

  it('treats a blank HOST as unset', () => {
    expect(listenAddress({ HOST: '  ' }).host).toBe('127.0.0.1')
  })

  it('listens on another address only when HOST is set', () => {
    expect(listenAddress({ HOST: '0.0.0.0', PORT: '4000' })).toEqual({ host: '0.0.0.0', port: 4000 })
  })
})
