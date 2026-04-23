import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDbPath } from '../../src/main/database/utils/getDbPath'
import path from 'path'

// ai-gen start (Gemini-3, 1)

// Mock electron module
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/user/data'),
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('Test getDbPath', () => {
  it('notElectron_getDbPath_returnsLocalDevPath', () => {
    // Simulate non-electron environment
    Object.defineProperty(process.versions, 'electron', {
      value: undefined,
      configurable: true
    })
    
    const expected = path.resolve('./dev.db')
    expect(getDbPath()).toBe(expected)
  })
})
// ai-gen end
