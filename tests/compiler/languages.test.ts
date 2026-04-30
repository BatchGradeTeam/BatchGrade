import { describe, it, expect, vi } from 'vitest'
import {
  getLanguage,
  detectJavaMainClass,
  detectPythonMainFile,
  cppConfig,
  pythonConfig,
  javaConfig
} from '../../src/main/compiler/languages'

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

function mockPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true
  })
}

function restorePlatform(): void {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
  }
}

describe('Language Configurations', () => {
  describe('getLanguage', () => {
    it('Should return C++ configuration', () => {
      const config = getLanguage('cpp')
      expect(config.id).toBe('cpp')
      expect(config.name).toBe('C++')
      expect(config.extensions).toContain('.cpp')
      expect(config.dockerImage).toBe('gcc:14')
      expect(config.compiler).toBe('g++')
      expect(config.needsCompilation).toBe(true)
    })

    it('Should return Python configuration', () => {
      const config = getLanguage('python')
      expect(config.id).toBe('python')
      expect(config.name).toBe('Python')
      expect(config.extensions).toContain('.py')
      expect(config.dockerImage).toBe('python:3.12-slim')
      expect(config.compiler).toBe('python3')
      expect(config.needsCompilation).toBe(false)
    })

    it('Should return Java configuration', () => {
      const config = getLanguage('java')
      expect(config.id).toBe('java')
      expect(config.name).toBe('Java')
      expect(config.extensions).toContain('.java')
      expect(config.dockerImage).toBe('eclipse-temurin:21-jdk-alpine')
      expect(config.compiler).toBe('javac')
      expect(config.needsCompilation).toBe(true)
    })
  })

  describe('detectJavaMainClass', () => {
    it('Should detect main class from Java source', async () => {
      const mockRead = async (path: string): Promise<string> => {
        if (path.includes('Main.java')) {
          return 'public class Main { public static void main(String[] args) {} }'
        }
        throw new Error('File not found')
      }

      // Mock fs/promises
      vi.doMock('fs/promises', () => {
        return {
          readFile: mockRead
        }
      })

      const result = await detectJavaMainClass(['/project/Main.java'])
      expect(result).toBe('Main')
    })

    it('Should return null when no Java files are selected', async () => {
      const result = await detectJavaMainClass(['main.py', 'README.md'])
      expect(result).toBeNull()
    })

    it('Should continue after unreadable Java files', async () => {
      vi.doMock('fs/promises', () => {
        return {
          readFile: async (path: string): Promise<string> => {
            if (path.includes('Broken.java')) {
              throw new Error('File not found')
            }
            return 'class Runner { public static void main(String[] args) {} }'
          }
        }
      })

      const result = await detectJavaMainClass(['/project/Broken.java', '/project/Runner.java'])
      expect(result).toBe('Runner')
    })

    it('Should skip Java files without a main method', async () => {
      vi.doMock('fs/promises', () => {
        return {
          readFile: async (): Promise<string> => {
            return 'class Helper { void run() {} }'
          }
        }
      })

      const result = await detectJavaMainClass(['/project/Helper.java'])
      expect(result).toBeNull()
    })

    it('Should skip Java files without a class declaration', async () => {
      vi.doMock('fs/promises', () => {
        return {
          readFile: async (): Promise<string> => {
            return 'public static void main(String[] args) {}'
          }
        }
      })

      const result = await detectJavaMainClass(['/project/Main.java'])
      expect(result).toBeNull()
    })

    it('Should return null if no main class found', async () => {
      const result = await detectJavaMainClass(['nonexistent.java', 'test.txt'])
      expect(result).toBeNull()
    })

    it('Should return null for empty file list', async () => {
      const result = await detectJavaMainClass([])
      expect(result).toBeNull()
    })
  })

  describe('detectPythonMainFile', () => {
    it('Should prefer main.py if present', () => {
      const files = ['utils.py', 'main.py', 'helper.py']
      const result = detectPythonMainFile(files)
      expect(result).toBe('main.py')
    })

    it('Should return first Python file if main.py not present', () => {
      const files = ['utils.py', 'helper.py']
      const result = detectPythonMainFile(files)
      expect(result).toBe('utils.py')
    })

    it('Should return null if no Python files found', () => {
      const files = ['test.txt', 'README.md']
      const result = detectPythonMainFile(files)
      expect(result).toBeNull()
    })

    it('Should return null for empty file list', () => {
      const result = detectPythonMainFile([])
      expect(result).toBeNull()
    })

    it('Should handle nested paths correctly', () => {
      const files = ['/project/subdir/main.py', '/project/utils.py']
      const result = detectPythonMainFile(files)
      expect(result).toBe('/project/subdir/main.py')
    })

    it('Should handle Windows paths correctly', () => {
      const files = ['C:\\project\\utils.py', 'C:\\project\\main.py']
      const result = detectPythonMainFile(files)
      expect(result).toBe('C:\\project\\main.py')
    })
  })

  describe('Language configurations validation', () => {
    it('C++ config should support multiple extensions', () => {
      expect(cppConfig.extensions).toEqual(
        expect.arrayContaining(['.cpp', '.cc', '.cxx', '.cp', '.h', '.hpp'])
      )
    })

    it('All configs should have required properties', () => {
      const configs = [cppConfig, pythonConfig, javaConfig]
      configs.forEach((config) => {
        expect(config).toHaveProperty('id')
        expect(config).toHaveProperty('name')
        expect(config).toHaveProperty('extensions')
        expect(config).toHaveProperty('dockerImage')
        expect(config).toHaveProperty('compiler')
        expect(config).toHaveProperty('exeExtension')
        expect(config).toHaveProperty('needsCompilation')
      })
    })

    it('Should specify correct compilation needs', () => {
      expect(cppConfig.needsCompilation).toBe(true)
      expect(pythonConfig.needsCompilation).toBe(false)
      expect(javaConfig.needsCompilation).toBe(true)
    })

    it('Should use exe extension for C++ on Windows', async () => {
      mockPlatform('win32')

      try {
        vi.resetModules()
        const { cppConfig: windowsCppConfig } = await import('../../src/main/compiler/languages')

        expect(windowsCppConfig.exeExtension).toBe('.exe')
      } finally {
        restorePlatform()
        vi.resetModules()
      }
    })
  })
})
