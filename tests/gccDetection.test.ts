import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create a mock function before modules are imported (hoisted)
const { execFileAsyncMock } = vi.hoisted(() => {
  return { execFileAsyncMock: vi.fn() }
})

// Mock child_process module so the real computer doesn't actually try to run g++
vi.mock('node:child_process', () => {
  return { execFile: vi.fn() }
})
// Mock promisify so gccDetection.ts uses the face async function instead
vi.mock('node:util', async () => {
  return { promisify: () => execFileAsyncMock }
})

let testPlatform = '' // Need this to simulate other OS'
const realPlatform = process.platform // Save the real platform so we can put it back later after tests finish

// Reimport after changing the platform
async function loadGccModule(): Promise<typeof import('../src/main/compiler/gccDetection')> {
  vi.resetModules()

  Object.defineProperty(process, 'platform', {
    value: testPlatform,
    configurable: true
  })

  return await import('../src/main/compiler/gccDetection')
}

beforeEach(() => {
  execFileAsyncMock.mockReset()

  Object.defineProperty(process, 'platform', {
    value: testPlatform,
    configurable: true
  })
}) 
afterEach(() => {
  execFileAsyncMock.mockReset()

  Object.defineProperty(process, 'platform', {
    value: realPlatform,
    configurable: true
  })
})

// Test gccCommand through detectGccInstallation
describe('gccCommand', () => {
  it('Uses g++.exe on Windows', async() => {
    testPlatform = 'win32'
    execFileAsyncMock.mockResolvedValue({
      stdout: 'g++ version 20',
      stderr: ''
    })

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()
    
    expect(result.status).toBe('ready')
    expect(result.path).toBe('g++.exe')
  })

  it('Return missing if no compiler works', async () => {
    execFileAsyncMock.mockRejectedValue(new Error('not found'))

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.status).toBe('missing')
    expect(result.path).toBe(null)
  })

  it('Falls back to clang++ on macOS if g++ and c++ fail', async () => { // Just in case
    testPlatform = 'darwin'

    execFileAsyncMock
      .mockRejectedValueOnce(new Error('g++ not found'))
      .mockRejectedValueOnce(new Error('c++ not found'))
      .mockResolvedValue({
        stdout: 'Apple clang version 21.0.0',
        stderr: ''
      })

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.status).toBe('ready')
    expect(result.platform).toBe('darwin')
    expect(result.path).toBe('clang++')
  })

  it('Returns missing if compiler command has no output', async () => {
    execFileAsyncMock.mockResolvedValue({
      stdout: '',
      stderr: ''
    })

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.status).toBe('missing')
    expect(result.path).toBe(null)
  })
})

describe('detectGccInstallation', () => {
  // Already did the first part in gccCommand so we just test for install instructions
  it('Returns Windows install instructions', async () => { 
    testPlatform = 'win32'
    execFileAsyncMock.mockRejectedValue(new Error('not found'))

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.platform).toBe('win32')
    expect(result.status).toBe('missing')
    expect(result.installInstruction).toContain('Install GCC using MinGW (e.g., via MSYS2 or mingw-w64), then restart BatchGrade.')
  })

  it('Returns macOS install instructions', async () => {
    testPlatform = 'darwin'
    execFileAsyncMock.mockRejectedValue(new Error('not found'))

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.platform).toBe('darwin')
    expect(result.status).toBe('missing')
    expect(result.installInstruction).toContain('Install Xcode Command Line Tools by running `xcode-select --install`, then restart BatchGrade.')
  })
  
  it('Returns Linux install instructions', async () => {
    testPlatform = 'linux'
    execFileAsyncMock.mockRejectedValue(new Error('not found'))

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.platform).toBe('linux')
    expect(result.status).toBe('missing')
    expect(result.installInstruction).toContain('Install GCC using your package manager (e.g., `sudo apt install build-essential` or `sudo yum install gcc`), then restart BatchGrade.')
  })

  it('Returns install instructions for unknown OS', async () => {
    testPlatform = ''
    execFileAsyncMock.mockRejectedValue(new Error('not found'))

    const { detectGccInstallation } = await loadGccModule()
    const result = await detectGccInstallation()

    expect(result.platform).toBe('unknown')
    expect(result.status).toBe('missing')
    expect(result.installInstruction).toContain('Install GCC for your operating system, then restart BatchGrade.')
  })
})

describe('validateGccPath', () => {
  it('Return false if C++ compiler command is not valid', async () => {
    const { validateGccPath } = await loadGccModule()
    expect(await validateGccPath('python')).toBe(false)
  })

  it('Returns false if valid C++ compiler command fails', async () => {
    execFileAsyncMock.mockRejectedValue(new Error('failed'))

    const { validateGccPath } = await loadGccModule()
    const result = await validateGccPath('/usr/bin/g++')

    expect(result).toBe(false)
  })

  it('Returns true if valid C++ compiler path', async () => {
    execFileAsyncMock.mockResolvedValue({ 
      stdout: 'g++ version 20', 
      stderr: '' 
    })

    const { validateGccPath } = await loadGccModule()
    const result = await validateGccPath('/usr/bin/g++')

    expect(result).toBe(true)
  })

  it('Returns true for versioned g++ command names', async () => {
    execFileAsyncMock.mockResolvedValue({
      stdout: 'g++ version 13',
      stderr: ''
    })

    const { validateGccPath } = await loadGccModule()
    const result = await validateGccPath('/usr/bin/g++-13')

    expect(result).toBe(true)
  })

  it('Returns true for versioned clang++ command names', async () => {
    execFileAsyncMock.mockResolvedValue({
      stdout: 'Apple clang version 13.0.0',
      stderr: ''
    })

    const { validateGccPath } = await loadGccModule()
    const result = await validateGccPath('/usr/bin/clang++-13')

    expect(result).toBe(true)
  })

  it('Returns false if valid compiler command gives no output', async () => {
    execFileAsyncMock.mockResolvedValue({
      stdout: '',
      stderr: ''
    })

    const { validateGccPath } = await loadGccModule()
    const result = await validateGccPath('/usr/bin/g++')

    expect(result).toBe(false)
  })
})
